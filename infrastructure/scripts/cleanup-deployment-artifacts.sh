#!/bin/bash

# Deployment Artifact Cleanup Script
# This script cleans up old deployment artifacts from S3 to prevent bucket bloat
# while preserving recent artifacts for rollback purposes

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default configuration
DEFAULT_RETENTION_DAYS=7
DEFAULT_KEEP_COUNT=5
DRY_RUN=false
BUCKET_NAME=""
PR_NUMBER=""

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Clean up old deployment artifacts from S3 bucket.

OPTIONS:
    -b, --bucket BUCKET_NAME    S3 bucket name (required)
    -p, --pr PR_NUMBER         Clean artifacts for specific PR only
    -d, --days DAYS            Keep artifacts newer than DAYS (default: $DEFAULT_RETENTION_DAYS)
    -k, --keep COUNT           Keep at least COUNT recent artifacts per PR (default: $DEFAULT_KEEP_COUNT)
    -n, --dry-run              Show what would be deleted without actually deleting
    -h, --help                 Show this help message

EXAMPLES:
    # Clean all artifacts older than 7 days (dry run)
    $0 --bucket macro-ai-deployment-artifacts-123456789 --dry-run

    # Clean artifacts for PR 51, keeping last 3 versions
    $0 --bucket macro-ai-deployment-artifacts-123456789 --pr 51 --keep 3

    # Clean all artifacts older than 3 days
    $0 --bucket macro-ai-deployment-artifacts-123456789 --days 3

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--bucket)
                BUCKET_NAME="$2"
                shift 2
                ;;
            -p|--pr)
                PR_NUMBER="$2"
                shift 2
                ;;
            -d|--days)
                DEFAULT_RETENTION_DAYS="$2"
                shift 2
                ;;
            -k|--keep)
                DEFAULT_KEEP_COUNT="$2"
                shift 2
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$BUCKET_NAME" ]]; then
        log_error "Bucket name is required"
        usage
        exit 1
    fi
}

# Check if bucket exists and is accessible
verify_bucket_access() {
    log_info "Verifying bucket access: $BUCKET_NAME"
    
    if ! aws s3 ls "s3://$BUCKET_NAME" >/dev/null 2>&1; then
        log_error "Cannot access bucket: $BUCKET_NAME"
        log_error "Check bucket name and AWS credentials"
        exit 1
    fi
    
    log_success "Bucket access verified"
}

# Get list of artifacts to clean up
get_artifacts_to_cleanup() {
    local pr_filter="$1"
    local retention_days="$2"
    local keep_count="$3"
    
    log_info "Scanning for artifacts to cleanup..."
    log_info "  PR filter: ${pr_filter:-"all PRs"}"
    log_info "  Retention: $retention_days days"
    log_info "  Keep count: $keep_count per PR"
    
    # Calculate cutoff date
    local cutoff_date
    cutoff_date=$(date -d "$retention_days days ago" -u +%Y-%m-%dT%H:%M:%SZ)
    log_info "  Cutoff date: $cutoff_date"
    
    # Build S3 prefix filter
    local prefix="express-api/"
    if [[ -n "$pr_filter" ]]; then
        prefix="express-api/pr-$pr_filter/"
    fi
    
    # Get all artifacts with metadata
    local temp_file
    temp_file=$(mktemp)
    
    aws s3api list-objects-v2 \
        --bucket "$BUCKET_NAME" \
        --prefix "$prefix" \
        --query 'Contents[?LastModified<`'"$cutoff_date"'`].[Key,LastModified,Size]' \
        --output text > "$temp_file"
    
    if [[ ! -s "$temp_file" ]]; then
        log_info "No artifacts found matching cleanup criteria"
        rm -f "$temp_file"
        return 0
    fi
    
    # Process artifacts by PR
    local cleanup_list
    cleanup_list=$(mktemp)
    
    # Group by PR and apply keep count logic
    if [[ -n "$pr_filter" ]]; then
        # Single PR - apply keep count
        tail -n +$((keep_count + 1)) "$temp_file" >> "$cleanup_list"
    else
        # Multiple PRs - apply keep count per PR
        awk '{
            # Extract PR number from key
            if (match($1, /pr-([0-9]+)\//, pr_match)) {
                pr = pr_match[1]
                artifacts[pr][++count[pr]] = $0
            }
        }
        END {
            for (pr in artifacts) {
                if (count[pr] > '"$keep_count"') {
                    for (i = '"$keep_count"' + 1; i <= count[pr]; i++) {
                        print artifacts[pr][i]
                    }
                }
            }
        }' "$temp_file" >> "$cleanup_list"
    fi
    
    # Display cleanup summary
    local cleanup_count
    cleanup_count=$(wc -l < "$cleanup_list")
    
    if [[ $cleanup_count -eq 0 ]]; then
        log_info "No artifacts need cleanup after applying retention policies"
    else
        log_warning "Found $cleanup_count artifacts to cleanup:"
        
        # Calculate total size
        local total_size
        total_size=$(awk '{sum += $3} END {print sum}' "$cleanup_list")
        local total_size_mb=$((total_size / 1024 / 1024))
        
        log_info "  Total size to cleanup: ${total_size_mb}MB"
        
        if [[ $DRY_RUN == true ]]; then
            log_info "Artifacts that would be deleted:"
            while IFS=$'\t' read -r key modified size; do
                local size_mb=$((size / 1024 / 1024))
                echo "  - $key (${size_mb}MB, $modified)"
            done < "$cleanup_list"
        fi
    fi
    
    # Store cleanup list for actual deletion
    echo "$cleanup_list"
    
    rm -f "$temp_file"
}

# Perform cleanup
perform_cleanup() {
    local cleanup_list="$1"
    
    if [[ ! -s "$cleanup_list" ]]; then
        log_info "No cleanup needed"
        return 0
    fi
    
    local cleanup_count
    cleanup_count=$(wc -l < "$cleanup_list")
    
    if [[ $DRY_RUN == true ]]; then
        log_info "DRY RUN: Would delete $cleanup_count artifacts"
        return 0
    fi
    
    log_warning "Deleting $cleanup_count artifacts..."
    
    local deleted_count=0
    local failed_count=0
    
    while IFS=$'\t' read -r key modified size; do
        if aws s3 rm "s3://$BUCKET_NAME/$key" >/dev/null 2>&1; then
            ((deleted_count++))
            log_info "Deleted: $key"
        else
            ((failed_count++))
            log_error "Failed to delete: $key"
        fi
    done < "$cleanup_list"
    
    log_success "Cleanup completed:"
    log_success "  Deleted: $deleted_count artifacts"
    if [[ $failed_count -gt 0 ]]; then
        log_warning "  Failed: $failed_count artifacts"
    fi
}

# Main execution
main() {
    log_info "Starting deployment artifact cleanup"
    log_info "=================================="
    
    parse_args "$@"
    verify_bucket_access
    
    local cleanup_list
    cleanup_list=$(get_artifacts_to_cleanup "$PR_NUMBER" "$DEFAULT_RETENTION_DAYS" "$DEFAULT_KEEP_COUNT")
    
    perform_cleanup "$cleanup_list"
    
    # Cleanup temporary files
    rm -f "$cleanup_list"
    
    log_success "Deployment artifact cleanup completed!"
}

# Execute main function
main "$@"

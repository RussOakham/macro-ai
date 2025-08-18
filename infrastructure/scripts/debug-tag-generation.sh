#!/bin/bash

# Debug Tag Generation Script
# This script helps debug tag conflicts during CDK deployments
# by showing exactly what tags are being generated and applied

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PR_NUMBER=""
BRANCH_NAME=""
ENVIRONMENT=""
VERBOSE=false

# Function to print usage
print_usage() {
    cat << EOF
Debug Tag Generation Script

This script helps debug tag conflicts during CDK deployments by showing
exactly what tags are being generated and applied.

Usage: $0 [OPTIONS]

Options:
    --pr-number NUMBER      PR number for the deployment
    --branch BRANCH         Branch name for the deployment  
    --environment ENV       Environment name (e.g., pr-35, staging, production)
    --verbose              Enable verbose output
    --help                 Show this help message

Examples:
    $0 --pr-number 35 --branch "feature/fix-tags" --environment "pr-35"
    $0 --environment "staging" --verbose

EOF
}

# Function to log messages
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} ${timestamp} - $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp} - $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp} - $message"
            ;;
    esac
}

# Function to simulate TaggingStrategy.createPrTags
simulate_pr_tags() {
    local pr_number=$1
    local branch_name=$2
    local environment=$3
    
    log "INFO" "Simulating PR tags generation..."
    
    # Base tags (from createBaseTags)
    local expiry_date
    expiry_date=$(date -v+7d '+%Y-%m-%dT%H:%M:%SZ')

    if [[ -n "$branch_name" ]]; then
        cat << EOF
{
  "Project": "MacroAI",
  "Environment": "$environment",
  "EnvironmentType": "ephemeral",
  "Component": "preview-environment",
  "Purpose": "PreviewEnvironment",
  "CostCenter": "development",
  "Owner": "${environment}-deployment",
  "Scale": "hobby",
  "ManagedBy": "CDK",
  "CreatedBy": "cdk-deploy-preview",
  "CreatedDate": "$(date '+%Y-%m-%d')",
  "MonitoringLevel": "basic",
  "DataClassification": "Internal",
  "ComplianceScope": "Development",
  "PRNumber": "$pr_number",
  "ExpiryDate": "$expiry_date",
  "Branch": "$branch_name"
}
EOF
    else
        cat << EOF
{
  "Project": "MacroAI",
  "Environment": "$environment",
  "EnvironmentType": "ephemeral",
  "Component": "preview-environment",
  "Purpose": "PreviewEnvironment",
  "CostCenter": "development",
  "Owner": "${environment}-deployment",
  "Scale": "hobby",
  "ManagedBy": "CDK",
  "CreatedBy": "cdk-deploy-preview",
  "CreatedDate": "$(date '+%Y-%m-%d')",
  "MonitoringLevel": "basic",
  "DataClassification": "Internal",
  "ComplianceScope": "Development",
  "PRNumber": "$pr_number",
  "ExpiryDate": "$expiry_date"
}
EOF
    fi
}

# Function to check for tag conflicts
check_tag_conflicts() {
    local tags_json=$1
    
    log "INFO" "Checking for potential tag conflicts..."
    
    # Extract tag keys and check for case variants
    local tag_keys
    tag_keys=$(echo "$tags_json" | jq -r 'keys[]' | sort)
    
    # Check for common case conflicts
    local conflicts=()
    
    while IFS= read -r key; do
        local lower_key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
        
        # Check if there are other keys that would conflict (case-insensitive)
        while IFS= read -r other_key; do
            if [[ "$key" != "$other_key" ]]; then
                local other_lower=$(echo "$other_key" | tr '[:upper:]' '[:lower:]')
                if [[ "$lower_key" == "$other_lower" ]]; then
                    conflicts+=("$key vs $other_key")
                fi
            fi
        done <<< "$tag_keys"
    done <<< "$tag_keys"
    
    if [[ ${#conflicts[@]} -gt 0 ]]; then
        log "ERROR" "Tag conflicts detected:"
        for conflict in "${conflicts[@]}"; do
            log "ERROR" "  - $conflict"
        done
        return 1
    else
        log "SUCCESS" "No tag conflicts detected"
        return 0
    fi
}

# Function to check existing AWS resources for conflicts
check_existing_resources() {
    local pr_number=$1
    
    log "INFO" "Checking existing AWS resources for tag conflicts..."
    
    # Check IAM roles
    log "INFO" "Checking IAM roles..."
    local roles
    roles=$(aws iam list-roles --query 'Roles[?starts_with(RoleName, `MacroAi`)].RoleName' --output text 2>/dev/null || echo "")
    
    for role in $roles; do
        if [[ -n "$role" ]]; then
            local pr_tag old_tag
            pr_tag=$(aws iam list-role-tags --role-name "$role" --query 'Tags[?Key==`PRNumber`].Value' --output text 2>/dev/null || echo "None")
            old_tag=$(aws iam list-role-tags --role-name "$role" --query 'Tags[?Key==`PrNumber`].Value' --output text 2>/dev/null || echo "None")
            
            if [[ "$old_tag" != "None" && "$old_tag" != "" ]]; then
                log "WARN" "Role $role still has old PrNumber tag: $old_tag"
            elif [[ "$pr_tag" != "None" && "$pr_tag" != "" ]]; then
                log "INFO" "Role $role has correct PRNumber tag: $pr_tag"
            fi
        fi
    done
    
    # Check Lambda functions
    log "INFO" "Checking Lambda functions..."
    local functions
    functions=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `macro-ai`)].FunctionName' --output text 2>/dev/null || echo "")
    
    for func in $functions; do
        if [[ -n "$func" ]]; then
            local pr_tag old_tag
            pr_tag=$(aws lambda list-tags --resource "arn:aws:lambda:us-east-1:861909001362:function:$func" --query 'Tags.PRNumber' --output text 2>/dev/null || echo "None")
            old_tag=$(aws lambda list-tags --resource "arn:aws:lambda:us-east-1:861909001362:function:$func" --query 'Tags.PrNumber' --output text 2>/dev/null || echo "None")
            
            if [[ "$old_tag" != "None" && "$old_tag" != "" ]]; then
                log "WARN" "Function $func still has old PrNumber tag: $old_tag"
            elif [[ "$pr_tag" != "None" && "$pr_tag" != "" ]]; then
                log "INFO" "Function $func has correct PRNumber tag: $pr_tag"
            fi
        fi
    done
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --pr-number)
            PR_NUMBER="$2"
            shift 2
            ;;
        --branch)
            BRANCH_NAME="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            print_usage
            exit 0
            ;;
        *)
            log "ERROR" "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    log "INFO" "Starting tag generation debugging..."
    
    # Set environment if not provided
    if [[ -n "$PR_NUMBER" && -z "$ENVIRONMENT" ]]; then
        ENVIRONMENT="pr-$PR_NUMBER"
    fi
    
    if [[ -z "$ENVIRONMENT" ]]; then
        log "ERROR" "Environment must be specified (either directly or via --pr-number)"
        exit 1
    fi
    
    log "INFO" "Configuration:"
    log "INFO" "  Environment: $ENVIRONMENT"
    log "INFO" "  PR Number: ${PR_NUMBER:-'N/A'}"
    log "INFO" "  Branch: ${BRANCH_NAME:-'N/A'}"
    
    # Generate and display tags
    if [[ -n "$PR_NUMBER" ]]; then
        log "INFO" "Generating PR-specific tags..."
        local tags_json
        tags_json=$(simulate_pr_tags "$PR_NUMBER" "$BRANCH_NAME" "$ENVIRONMENT")
        
        echo ""
        log "INFO" "Generated tags:"
        echo "$tags_json" | jq .
        echo ""
        
        # Check for conflicts in generated tags
        check_tag_conflicts "$tags_json"
        
        # Check existing resources
        check_existing_resources "$PR_NUMBER"
    else
        log "INFO" "No PR number provided, skipping PR tag generation"
        check_existing_resources ""
    fi
    
    log "SUCCESS" "Tag debugging completed"
}

# Run main function
main "$@"

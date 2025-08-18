#!/bin/bash

# =============================================================================
# Preview Environment Discovery and Validation Script
# =============================================================================
# 
# This script discovers all active preview environments and validates their
# age and status to determine which should be cleaned up.
#
# Discovery Features:
# 1. Find all MacroAiPr*Stack CloudFormation stacks
# 2. Evaluate environment age based on stack creation time
# 3. Check stack status and health
# 4. Validate associated EC2 resources
# 5. Generate cleanup recommendations
# 6. Export results in multiple formats (JSON, CSV, summary)
#
# Usage:
#   ./discover-preview-environments.sh --max-age 24
#   ./discover-preview-environments.sh --output-format json --output-file environments.json
#   ./discover-preview-environments.sh --validate-resources --verbose
#
# Exit Codes:
#   0 - Discovery completed successfully
#   1 - Discovery failed or errors encountered
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERBOSE=false
MAX_AGE_HOURS=24
OUTPUT_FORMAT="summary"  # summary, json, csv
OUTPUT_FILE=""
VALIDATE_RESOURCES=false
INCLUDE_HEALTHY_ONLY=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}🔍 DEBUG: $1${NC}"
    fi
}

# Help function
show_help() {
    cat << EOF
Preview Environment Discovery and Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --max-age HOURS             Maximum age in hours for environments (default: 24)
    --output-format FORMAT      Output format: summary, json, csv (default: summary)
    --output-file FILE          Save results to file (optional)
    --validate-resources        Validate associated EC2 resources
    --include-healthy-only      Only include healthy/active environments
    --region REGION             AWS region (default: us-east-1)
    --verbose                   Enable verbose logging
    --help                      Show this help message

OUTPUT FORMATS:
    summary     Human-readable summary with recommendations
    json        Structured JSON output for programmatic use
    csv         CSV format for spreadsheet analysis

EXAMPLES:
    $0 --max-age 48 --verbose
    $0 --output-format json --output-file environments.json
    $0 --validate-resources --include-healthy-only
    $0 --max-age 12 --output-format csv --output-file cleanup-candidates.csv

DISCOVERY PROCESS:
    ✓ Find all MacroAiPr*Stack CloudFormation stacks
    ✓ Evaluate stack age and status
    ✓ Extract PR numbers and environment names
    ✓ Optionally validate EC2 resources
    ✓ Generate cleanup recommendations
    ✓ Export results in requested format

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --max-age)
                MAX_AGE_HOURS="$2"
                shift 2
                ;;
            --output-format)
                OUTPUT_FORMAT="$2"
                if [[ ! "$OUTPUT_FORMAT" =~ ^(summary|json|csv)$ ]]; then
                    log_error "Invalid output format: $OUTPUT_FORMAT"
                    show_help
                    exit 2
                fi
                shift 2
                ;;
            --output-file)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --validate-resources)
                VALIDATE_RESOURCES=true
                shift
                ;;
            --include-healthy-only)
                INCLUDE_HEALTHY_ONLY=true
                shift
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 2
                ;;
        esac
    done

    # Validate numeric inputs
    if ! [[ "$MAX_AGE_HOURS" =~ ^[0-9]+$ ]]; then
        log_error "Max age must be a positive integer"
        exit 2
    fi
}

# Discover CloudFormation stacks
discover_stacks() {
    log_info "Discovering preview environment stacks in region: $AWS_REGION"
    
    local stack_statuses="CREATE_COMPLETE UPDATE_COMPLETE"
    if [[ "$INCLUDE_HEALTHY_ONLY" == "false" ]]; then
        stack_statuses="$stack_statuses CREATE_FAILED UPDATE_FAILED ROLLBACK_COMPLETE"
    fi
    
    log_debug "Stack statuses to include: $stack_statuses"
    
    # Convert space-separated statuses to array for AWS CLI
    local status_filters=()
    for status in $stack_statuses; do
        status_filters+=("$status")
    done
    
    local stacks_json
    stacks_json=$(aws cloudformation list-stacks \
        --region "$AWS_REGION" \
        --stack-status-filter "${status_filters[@]}" \
        --query 'StackSummaries[?contains(StackName, `MacroAiPr`) && contains(StackName, `Stack`)].{Name:StackName,Status:StackStatus,CreationTime:CreationTime,LastUpdatedTime:LastUpdatedTime}' \
        --output json)
    
    echo "$stacks_json"
}

# Validate EC2 resources for a stack
validate_stack_resources() {
    local stack_name="$1"
    local env_name="$2"
    
    log_debug "Validating EC2 resources for stack: $stack_name"
    
    # Check Auto Scaling Groups
    local asg_count
    asg_count=$(aws autoscaling describe-auto-scaling-groups \
        --region "$AWS_REGION" \
        --query "AutoScalingGroups[?contains(AutoScalingGroupName, '$env_name')].AutoScalingGroupName" \
        --output text 2>/dev/null | wc -w || echo "0")
    
    # Check Load Balancers
    local alb_count
    alb_count=$(aws elbv2 describe-load-balancers \
        --region "$AWS_REGION" \
        --query "LoadBalancers[?contains(LoadBalancerName, '$env_name')].LoadBalancerName" \
        --output text 2>/dev/null | wc -w || echo "0")
    
    # Check EC2 instances
    local instance_count
    instance_count=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$env_name" "Name=instance-state-name,Values=running,pending,stopping,stopped" \
        --query 'Reservations[].Instances[].InstanceId' \
        --output text 2>/dev/null | wc -w || echo "0")
    
    local resource_health="healthy"
    local resource_details=""
    
    if [[ "$asg_count" -eq 0 && "$alb_count" -eq 0 && "$instance_count" -eq 0 ]]; then
        resource_health="no-resources"
        resource_details="No EC2 resources found (may be cleaned up already)"
    elif [[ "$asg_count" -gt 0 || "$alb_count" -gt 0 || "$instance_count" -gt 0 ]]; then
        resource_health="active"
        resource_details="ASG: $asg_count, ALB: $alb_count, EC2: $instance_count"
    fi
    
    echo "$resource_health|$resource_details"
}

# Process discovered stacks
process_stacks() {
    local stacks_json="$1"
    local current_time
    current_time=$(date +%s)
    local max_age_seconds=$((MAX_AGE_HOURS * 3600))
    
    local environments="[]"
    local total_count
    total_count=$(echo "$stacks_json" | jq length)
    
    log_info "Processing $total_count discovered stacks..."
    
    if [[ "$total_count" -eq 0 ]]; then
        log_info "No preview environment stacks found"
        echo "$environments"
        return 0
    fi
    
    for stack in $(echo "$stacks_json" | jq -r '.[] | @base64'); do
        local stack_data
        stack_data=$(echo "$stack" | base64 --decode)
        
        local stack_name
        stack_name=$(echo "$stack_data" | jq -r '.Name')
        
        local stack_status
        stack_status=$(echo "$stack_data" | jq -r '.Status')
        
        local creation_time
        creation_time=$(echo "$stack_data" | jq -r '.CreationTime')
        
        local last_updated_time
        last_updated_time=$(echo "$stack_data" | jq -r '.LastUpdatedTime // .CreationTime')
        
        # Extract PR number from stack name
        local pr_number
        pr_number=$(echo "$stack_name" | sed 's/MacroAiPr\([0-9]*\)Stack/\1/')
        
        local env_name="pr-$pr_number"
        
        # Calculate age
        local creation_epoch
        creation_epoch=$(date -d "$creation_time" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${creation_time%.*}" +%s 2>/dev/null || echo "0")
        
        local age_seconds=$((current_time - creation_epoch))
        local age_hours=$((age_seconds / 3600))
        
        # Determine cleanup recommendation
        local should_cleanup=false
        local cleanup_reason=""
        
        if [[ "$age_seconds" -gt "$max_age_seconds" ]]; then
            should_cleanup=true
            cleanup_reason="Age exceeds $MAX_AGE_HOURS hours"
        elif [[ "$stack_status" =~ (FAILED|ROLLBACK) ]]; then
            should_cleanup=true
            cleanup_reason="Stack in failed state: $stack_status"
        else
            cleanup_reason="Within age limit and healthy"
        fi
        
        # Validate resources if requested
        local resource_health="unknown"
        local resource_details=""
        
        if [[ "$VALIDATE_RESOURCES" == "true" ]]; then
            local validation_result
            validation_result=$(validate_stack_resources "$stack_name" "$env_name")
            resource_health=$(echo "$validation_result" | cut -d'|' -f1)
            resource_details=$(echo "$validation_result" | cut -d'|' -f2)
        fi
        
        log_debug "Stack: $stack_name, Age: ${age_hours}h, Status: $stack_status, Cleanup: $should_cleanup"
        
        # Create environment object
        local env_obj
        env_obj=$(jq -n \
            --arg stack_name "$stack_name" \
            --arg pr_number "$pr_number" \
            --arg env_name "$env_name" \
            --arg stack_status "$stack_status" \
            --arg creation_time "$creation_time" \
            --arg last_updated_time "$last_updated_time" \
            --arg age_hours "$age_hours" \
            --argjson should_cleanup "$should_cleanup" \
            --arg cleanup_reason "$cleanup_reason" \
            --arg resource_health "$resource_health" \
            --arg resource_details "$resource_details" \
            '{
                stack_name: $stack_name,
                pr_number: ($pr_number | tonumber),
                env_name: $env_name,
                stack_status: $stack_status,
                creation_time: $creation_time,
                last_updated_time: $last_updated_time,
                age_hours: ($age_hours | tonumber),
                should_cleanup: $should_cleanup,
                cleanup_reason: $cleanup_reason,
                resource_health: $resource_health,
                resource_details: $resource_details
            }')
        
        environments=$(echo "$environments" | jq ". + [$env_obj]")
    done
    
    echo "$environments"
}

# Output results in summary format
output_summary() {
    local environments="$1"

    local total_count
    total_count=$(echo "$environments" | jq length)

    local cleanup_count
    cleanup_count=$(echo "$environments" | jq '[.[] | select(.should_cleanup == true)] | length')

    local healthy_count
    healthy_count=$(echo "$environments" | jq '[.[] | select(.should_cleanup == false)] | length')

    echo "🔍 Preview Environment Discovery Report"
    echo "======================================"
    echo "🕐 Discovery Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "🌍 AWS Region: $AWS_REGION"
    echo "⏰ Max Age Limit: $MAX_AGE_HOURS hours"
    echo ""
    echo "📊 Summary:"
    echo "  Total Environments: $total_count"
    echo "  Cleanup Candidates: $cleanup_count"
    echo "  Healthy Environments: $healthy_count"
    echo ""

    if [[ "$cleanup_count" -gt 0 ]]; then
        echo "🗑️ Environments Recommended for Cleanup:"
        echo "$environments" | jq -r '.[] | select(.should_cleanup == true) | "  - \(.env_name) (PR #\(.pr_number)) - Age: \(.age_hours)h - \(.cleanup_reason)"'
        echo ""
    fi

    if [[ "$healthy_count" -gt 0 ]]; then
        echo "✅ Healthy Environments (No Cleanup Needed):"
        echo "$environments" | jq -r '.[] | select(.should_cleanup == false) | "  - \(.env_name) (PR #\(.pr_number)) - Age: \(.age_hours)h - \(.stack_status)"'
        echo ""
    fi

    if [[ "$VALIDATE_RESOURCES" == "true" ]]; then
        echo "🔧 Resource Validation Results:"
        echo "$environments" | jq -r '.[] | "  - \(.env_name): \(.resource_health) - \(.resource_details)"'
        echo ""
    fi

    echo "💰 Cost Optimization Potential:"
    if [[ "$cleanup_count" -gt 0 ]]; then
        local estimated_daily_savings=$((cleanup_count * 3))
        local estimated_monthly_savings=$((estimated_daily_savings * 30))
        echo "  Estimated daily savings: ~\$${estimated_daily_savings}"
        echo "  Estimated monthly savings: ~\$${estimated_monthly_savings}"
    else
        echo "  All environments are within age limits - excellent cost management!"
    fi

    echo ""
    echo "📋 Next Steps:"
    if [[ "$cleanup_count" -gt 0 ]]; then
        echo "  1. Review cleanup candidates above"
        echo "  2. Run scheduled cleanup workflow or manual teardown"
        echo "  3. Monitor cost savings after cleanup"
    else
        echo "  1. No immediate action required"
        echo "  2. Continue monitoring with scheduled discovery"
    fi
}

# Output results in JSON format
output_json() {
    local environments="$1"

    local total_count
    total_count=$(echo "$environments" | jq length)

    local cleanup_count
    cleanup_count=$(echo "$environments" | jq '[.[] | select(.should_cleanup == true)] | length')

    local report
    report=$(jq -n \
        --argjson environments "$environments" \
        --arg discovery_time "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" \
        --arg aws_region "$AWS_REGION" \
        --arg max_age_hours "$MAX_AGE_HOURS" \
        --arg total_count "$total_count" \
        --arg cleanup_count "$cleanup_count" \
        --arg validate_resources "$VALIDATE_RESOURCES" \
        '{
            discovery_time: $discovery_time,
            aws_region: $aws_region,
            max_age_hours: ($max_age_hours | tonumber),
            validate_resources: ($validate_resources | test("true")),
            summary: {
                total_environments: ($total_count | tonumber),
                cleanup_candidates: ($cleanup_count | tonumber),
                healthy_environments: (($total_count | tonumber) - ($cleanup_count | tonumber))
            },
            environments: $environments
        }')

    echo "$report"
}

# Output results in CSV format
output_csv() {
    local environments="$1"

    echo "stack_name,pr_number,env_name,stack_status,age_hours,should_cleanup,cleanup_reason,resource_health,resource_details,creation_time"
    echo "$environments" | jq -r '.[] | [.stack_name, .pr_number, .env_name, .stack_status, .age_hours, .should_cleanup, .cleanup_reason, .resource_health, .resource_details, .creation_time] | @csv'
}

# Main function
main() {
    log_info "🔍 Starting preview environment discovery"
    log_info "Region: $AWS_REGION"
    log_info "Max Age: $MAX_AGE_HOURS hours"
    log_info "Output Format: $OUTPUT_FORMAT"
    if [[ -n "$OUTPUT_FILE" ]]; then
        log_info "Output File: $OUTPUT_FILE"
    fi
    echo ""

    # Discover stacks
    local stacks_json
    stacks_json=$(discover_stacks)

    # Process stacks
    local environments
    environments=$(process_stacks "$stacks_json")

    # Generate output
    local output=""
    case "$OUTPUT_FORMAT" in
        "summary")
            output=$(output_summary "$environments")
            ;;
        "json")
            output=$(output_json "$environments")
            ;;
        "csv")
            output=$(output_csv "$environments")
            ;;
    esac

    # Output to file or stdout
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo "$output" > "$OUTPUT_FILE"
        log_success "Results saved to: $OUTPUT_FILE"

        # Also show summary to stdout for user feedback
        if [[ "$OUTPUT_FORMAT" != "summary" ]]; then
            echo ""
            output_summary "$environments"
        fi
    else
        echo "$output"
    fi

    # Exit with appropriate code
    local cleanup_count
    cleanup_count=$(echo "$environments" | jq '[.[] | select(.should_cleanup == true)] | length')

    if [[ "$cleanup_count" -gt 0 ]]; then
        log_info "Discovery completed - $cleanup_count environments recommended for cleanup"
        exit 0
    else
        log_success "Discovery completed - all environments are healthy"
        exit 0
    fi
}

# Parse arguments and run main function
parse_arguments "$@"
main

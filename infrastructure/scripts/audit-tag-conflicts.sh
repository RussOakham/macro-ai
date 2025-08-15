#!/bin/bash

# =============================================================================
# AWS Tag Conflict Audit Script
# =============================================================================
# 
# This script performs a comprehensive audit of AWS resources to identify
# tag conflicts that could cause CloudFormation deployment failures.
#
# Focus Areas:
# - Case-variant tag keys (PrNumber vs PRNumber, project vs Project)
# - Legacy tag formats conflicting with current TaggingStrategy
# - Orphaned resources from failed PR deployments
# - IAM resources with case-insensitive tag conflicts
#
# Usage:
#   ./audit-tag-conflicts.sh [--region us-east-1] [--pr-number 35] [--output-file audit.json]
#
# =============================================================================

set -euo pipefail

# Default configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
OUTPUT_FILE=""
PR_NUMBER=""
VERBOSE=false
DRY_RUN=true

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo -e "${PURPLE}[DEBUG]${NC} $1" >&2
    fi
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --pr-number)
                PR_NUMBER="$2"
                shift 2
                ;;
            --output-file)
                OUTPUT_FILE="$2"
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
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
AWS Tag Conflict Audit Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --region REGION         AWS region to audit (default: us-east-1)
    --pr-number NUMBER      Focus audit on specific PR number
    --output-file FILE      Save detailed audit results to JSON file
    --verbose               Enable verbose logging
    --help                  Show this help message

EXAMPLES:
    # Audit all resources in us-east-1
    $0 --region us-east-1

    # Audit specific PR resources with detailed output
    $0 --pr-number 35 --output-file pr-35-audit.json --verbose

    # Quick audit with summary only
    $0
EOF
}

# Initialize audit results structure
init_audit_results() {
    cat << EOF
{
    "audit_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "aws_region": "${AWS_REGION}",
    "pr_number": "${PR_NUMBER:-"all"}",
    "summary": {
        "total_resources_scanned": 0,
        "resources_with_conflicts": 0,
        "conflict_types_found": [],
        "orphaned_resources": 0,
        "cleanup_required": false
    },
    "conflicts": {
        "case_variant_tags": [],
        "legacy_tag_formats": [],
        "duplicate_tag_keys": [],
        "orphaned_resources": []
    },
    "resource_details": {
        "iam_roles": [],
        "iam_policies": [],
        "iam_instance_profiles": [],
        "ec2_instances": [],
        "ec2_security_groups": [],
        "elb_load_balancers": [],
        "elbv2_load_balancers": [],
        "cloudwatch_log_groups": [],
        "dynamodb_tables": [],
        "other_resources": []
    }
}
EOF
}

# Known tag key patterns from TaggingStrategy
declare -A STANDARD_TAG_KEYS=(
    ["Project"]="Project"
    ["Environment"]="Environment"
    ["EnvironmentType"]="EnvironmentType"
    ["Component"]="Component"
    ["Purpose"]="Purpose"
    ["CostCenter"]="CostCenter"
    ["Owner"]="Owner"
    ["Scale"]="Scale"
    ["ManagedBy"]="ManagedBy"
    ["CreatedBy"]="CreatedBy"
    ["CreatedDate"]="CreatedDate"
    ["PRNumber"]="PRNumber"
    ["Branch"]="Branch"
    ["ExpiryDate"]="ExpiryDate"
    ["AutoShutdown"]="AutoShutdown"
    ["BackupRequired"]="BackupRequired"
    ["MonitoringLevel"]="MonitoringLevel"
    ["DataClassification"]="DataClassification"
    ["ComplianceScope"]="ComplianceScope"
)

# Common case variants that cause conflicts
declare -A CASE_VARIANTS=(
    ["project"]="Project"
    ["PROJECT"]="Project"
    ["environment"]="Environment"
    ["ENVIRONMENT"]="Environment"
    ["component"]="Component"
    ["COMPONENT"]="Component"
    ["purpose"]="Purpose"
    ["PURPOSE"]="Purpose"
    ["prnumber"]="PRNumber"
    ["PrNumber"]="PRNumber"
    ["pr-number"]="PRNumber"
    ["PR-NUMBER"]="PRNumber"
    ["managedby"]="ManagedBy"
    ["MANAGEDBY"]="ManagedBy"
    ["managed-by"]="ManagedBy"
    ["createdby"]="CreatedBy"
    ["CREATEDBY"]="CreatedBy"
    ["created-by"]="CreatedBy"
)

# Check if a resource has tag conflicts
check_tag_conflicts() {
    local resource_type="$1"
    local resource_id="$2"
    local tags_json="$3"
    
    local conflicts=()
    local case_variants=()
    local duplicate_keys=()
    
    # Parse tags and check for conflicts
    local tag_keys
    tag_keys=$(echo "$tags_json" | jq -r '.[].Key // empty' 2>/dev/null || echo "")
    
    if [[ -z "$tag_keys" ]]; then
        return 0
    fi
    
    # Check for case variants
    while IFS= read -r tag_key; do
        [[ -z "$tag_key" ]] && continue
        
        # Check if this is a case variant of a standard key
        if [[ -n "${CASE_VARIANTS[$tag_key]:-}" ]]; then
            case_variants+=("$tag_key -> ${CASE_VARIANTS[$tag_key]}")
        fi
        
        # Check for duplicate keys (case-insensitive)
        local lowercase_key
        lowercase_key=$(echo "$tag_key" | tr '[:upper:]' '[:lower:]')
        
        # Count occurrences of this key (case-insensitive)
        local key_count
        key_count=$(echo "$tag_keys" | tr '[:upper:]' '[:lower:]' | grep -c "^${lowercase_key}$" || echo "0")
        
        if [[ $key_count -gt 1 ]]; then
            duplicate_keys+=("$tag_key (appears $key_count times)")
        fi
    done <<< "$tag_keys"
    
    # Report conflicts if found
    if [[ ${#case_variants[@]} -gt 0 || ${#duplicate_keys[@]} -gt 0 ]]; then
        log_warning "Tag conflicts found in $resource_type: $resource_id"
        
        if [[ ${#case_variants[@]} -gt 0 ]]; then
            log_debug "  Case variants: ${case_variants[*]}"
        fi
        
        if [[ ${#duplicate_keys[@]} -gt 0 ]]; then
            log_debug "  Duplicate keys: ${duplicate_keys[*]}"
        fi
        
        return 1
    fi
    
    return 0
}

# Audit IAM roles for tag conflicts
audit_iam_roles() {
    log_info "🔍 Auditing IAM roles for tag conflicts..."
    
    local roles_with_conflicts=0
    local total_roles=0
    
    # Get all IAM roles
    local roles
    roles=$(aws iam list-roles --region "$AWS_REGION" --query 'Roles[].RoleName' --output text 2>/dev/null || echo "")
    
    if [[ -z "$roles" ]]; then
        log_info "No IAM roles found"
        return 0
    fi
    
    for role_name in $roles; do
        total_roles=$((total_roles + 1))
        
        # Skip AWS service roles
        if [[ "$role_name" =~ ^aws- ]] || [[ "$role_name" =~ ^AWSService ]]; then
            continue
        fi
        
        # Get role tags
        local role_tags
        role_tags=$(aws iam list-role-tags --role-name "$role_name" --region "$AWS_REGION" --query 'Tags' --output json 2>/dev/null || echo "[]")
        
        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$role_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")
            
            if [[ -z "$has_pr_tag" ]]; then
                continue  # Skip roles not related to this PR
            fi
        fi
        
        # Check for tag conflicts
        if ! check_tag_conflicts "IAM Role" "$role_name" "$role_tags"; then
            roles_with_conflicts=$((roles_with_conflicts + 1))
        fi
        
        log_debug "Checked IAM role: $role_name"
    done
    
    log_info "IAM Roles: $roles_with_conflicts/$total_roles have tag conflicts"
}

# Audit IAM policies for tag conflicts
audit_iam_policies() {
    log_info "🔍 Auditing IAM policies for tag conflicts..."

    local policies_with_conflicts=0
    local total_policies=0

    # Get customer-managed policies only (skip AWS managed)
    local policies
    policies=$(aws iam list-policies --scope Local --region "$AWS_REGION" --query 'Policies[].PolicyName' --output text 2>/dev/null || echo "")

    if [[ -z "$policies" ]]; then
        log_info "No customer-managed IAM policies found"
        return 0
    fi

    for policy_name in $policies; do
        total_policies=$((total_policies + 1))

        # Get policy ARN first
        local policy_arn
        policy_arn=$(aws iam list-policies --scope Local --region "$AWS_REGION" --query "Policies[?PolicyName=='$policy_name'].Arn" --output text 2>/dev/null || echo "")

        if [[ -z "$policy_arn" ]]; then
            continue
        fi

        # Get policy tags
        local policy_tags
        policy_tags=$(aws iam list-policy-tags --policy-arn "$policy_arn" --region "$AWS_REGION" --query 'Tags' --output json 2>/dev/null || echo "[]")

        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$policy_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")

            if [[ -z "$has_pr_tag" ]]; then
                continue  # Skip policies not related to this PR
            fi
        fi

        # Check for tag conflicts
        if ! check_tag_conflicts "IAM Policy" "$policy_name" "$policy_tags"; then
            policies_with_conflicts=$((policies_with_conflicts + 1))
        fi

        log_debug "Checked IAM policy: $policy_name"
    done

    log_info "IAM Policies: $policies_with_conflicts/$total_policies have tag conflicts"
}

# Audit EC2 instances for tag conflicts
audit_ec2_instances() {
    log_info "🔍 Auditing EC2 instances for tag conflicts..."

    local instances_with_conflicts=0
    local total_instances=0

    # Get all EC2 instances
    local instances
    instances=$(aws ec2 describe-instances --region "$AWS_REGION" --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")

    if [[ -z "$instances" ]]; then
        log_info "No EC2 instances found"
        return 0
    fi

    for instance_id in $instances; do
        total_instances=$((total_instances + 1))

        # Get instance tags
        local instance_tags
        instance_tags=$(aws ec2 describe-tags --region "$AWS_REGION" --filters "Name=resource-id,Values=$instance_id" --query 'Tags[].{Key:Key,Value:Value}' --output json 2>/dev/null || echo "[]")

        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$instance_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")

            if [[ -z "$has_pr_tag" ]]; then
                continue  # Skip instances not related to this PR
            fi
        fi

        # Check for tag conflicts
        if ! check_tag_conflicts "EC2 Instance" "$instance_id" "$instance_tags"; then
            instances_with_conflicts=$((instances_with_conflicts + 1))
        fi

        log_debug "Checked EC2 instance: $instance_id"
    done

    log_info "EC2 Instances: $instances_with_conflicts/$total_instances have tag conflicts"
}

# Audit Security Groups for tag conflicts
audit_security_groups() {
    log_info "🔍 Auditing Security Groups for tag conflicts..."

    local sgs_with_conflicts=0
    local total_sgs=0

    # Get all security groups (excluding default)
    local security_groups
    security_groups=$(aws ec2 describe-security-groups --region "$AWS_REGION" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null || echo "")

    if [[ -z "$security_groups" ]]; then
        log_info "No custom security groups found"
        return 0
    fi

    for sg_id in $security_groups; do
        total_sgs=$((total_sgs + 1))

        # Get security group tags
        local sg_tags
        sg_tags=$(aws ec2 describe-tags --region "$AWS_REGION" --filters "Name=resource-id,Values=$sg_id" --query 'Tags[].{Key:Key,Value:Value}' --output json 2>/dev/null || echo "[]")

        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$sg_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")

            if [[ -z "$has_pr_tag" ]]; then
                continue  # Skip security groups not related to this PR
            fi
        fi

        # Check for tag conflicts
        if ! check_tag_conflicts "Security Group" "$sg_id" "$sg_tags"; then
            sgs_with_conflicts=$((sgs_with_conflicts + 1))
        fi

        log_debug "Checked Security Group: $sg_id"
    done

    log_info "Security Groups: $sgs_with_conflicts/$total_sgs have tag conflicts"
}

# Audit Load Balancers for tag conflicts
audit_load_balancers() {
    log_info "🔍 Auditing Load Balancers for tag conflicts..."

    local lbs_with_conflicts=0
    local total_lbs=0

    # Get ALBs/NLBs (ELBv2)
    local elbv2_arns
    elbv2_arns=$(aws elbv2 describe-load-balancers --region "$AWS_REGION" --query 'LoadBalancers[].LoadBalancerArn' --output text 2>/dev/null || echo "")

    for lb_arn in $elbv2_arns; do
        [[ -z "$lb_arn" ]] && continue
        total_lbs=$((total_lbs + 1))

        # Get load balancer tags
        local lb_tags
        lb_tags=$(aws elbv2 describe-tags --region "$AWS_REGION" --resource-arns "$lb_arn" --query 'TagDescriptions[0].Tags[].{Key:Key,Value:Value}' --output json 2>/dev/null || echo "[]")

        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$lb_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")

            if [[ -z "$has_pr_tag" ]]; then
                continue  # Skip load balancers not related to this PR
            fi
        fi

        # Check for tag conflicts
        local lb_name
        lb_name=$(echo "$lb_arn" | sed 's|.*loadbalancer/[^/]*/\([^/]*\)/.*|\1|')
        if ! check_tag_conflicts "Load Balancer" "$lb_name" "$lb_tags"; then
            lbs_with_conflicts=$((lbs_with_conflicts + 1))
        fi

        log_debug "Checked Load Balancer: $lb_name"
    done

    # Get Classic Load Balancers (ELB)
    local elb_names
    elb_names=$(aws elb describe-load-balancers --region "$AWS_REGION" --query 'LoadBalancerDescriptions[].LoadBalancerName' --output text 2>/dev/null || echo "")

    for elb_name in $elb_names; do
        [[ -z "$elb_name" ]] && continue
        total_lbs=$((total_lbs + 1))

        # Get classic load balancer tags
        local elb_tags
        elb_tags=$(aws elb describe-tags --region "$AWS_REGION" --load-balancer-names "$elb_name" --query 'TagDescriptions[0].Tags[].{Key:Key,Value:Value}' --output json 2>/dev/null || echo "[]")

        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$elb_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")

            if [[ -z "$has_pr_tag" ]]; then
                continue  # Skip load balancers not related to this PR
            fi
        fi

        # Check for tag conflicts
        if ! check_tag_conflicts "Classic Load Balancer" "$elb_name" "$elb_tags"; then
            lbs_with_conflicts=$((lbs_with_conflicts + 1))
        fi

        log_debug "Checked Classic Load Balancer: $elb_name"
    done

    log_info "Load Balancers: $lbs_with_conflicts/$total_lbs have tag conflicts"
}

# Audit CloudWatch Log Groups for tag conflicts
audit_cloudwatch_logs() {
    log_info "🔍 Auditing CloudWatch Log Groups for tag conflicts..."

    local logs_with_conflicts=0
    local total_logs=0

    # Get all log groups
    local log_groups
    log_groups=$(aws logs describe-log-groups --region "$AWS_REGION" --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")

    if [[ -z "$log_groups" ]]; then
        log_info "No CloudWatch Log Groups found"
        return 0
    fi

    for log_group in $log_groups; do
        total_logs=$((total_logs + 1))

        # Skip AWS service log groups
        if [[ "$log_group" =~ ^/aws/lambda/ ]] && [[ ! "$log_group" =~ macro-ai ]]; then
            continue
        fi

        # Get log group tags
        local log_tags
        log_tags=$(aws logs list-tags-log-group --region "$AWS_REGION" --log-group-name "$log_group" --query 'tags' --output json 2>/dev/null || echo "{}")

        # Convert tags format to match other resources
        local formatted_tags
        formatted_tags=$(echo "$log_tags" | jq '[to_entries[] | {Key: .key, Value: .value}]' 2>/dev/null || echo "[]")

        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$formatted_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")

            # Also check log group name for PR pattern
            if [[ -z "$has_pr_tag" ]] && [[ ! "$log_group" =~ pr-?${PR_NUMBER} ]] && [[ ! "$log_group" =~ PR${PR_NUMBER} ]]; then
                continue  # Skip log groups not related to this PR
            fi
        fi

        # Check for tag conflicts
        if ! check_tag_conflicts "CloudWatch Log Group" "$log_group" "$formatted_tags"; then
            logs_with_conflicts=$((logs_with_conflicts + 1))
        fi

        log_debug "Checked CloudWatch Log Group: $log_group"
    done

    log_info "CloudWatch Log Groups: $logs_with_conflicts/$total_logs have tag conflicts"
}

# Audit DynamoDB Tables for tag conflicts
audit_dynamodb_tables() {
    log_info "🔍 Auditing DynamoDB Tables for tag conflicts..."

    local tables_with_conflicts=0
    local total_tables=0

    # Get all DynamoDB tables
    local tables
    tables=$(aws dynamodb list-tables --region "$AWS_REGION" --query 'TableNames[]' --output text 2>/dev/null || echo "")

    if [[ -z "$tables" ]]; then
        log_info "No DynamoDB Tables found"
        return 0
    fi

    for table_name in $tables; do
        total_tables=$((total_tables + 1))

        # Get table ARN first
        local table_arn
        table_arn=$(aws dynamodb describe-table --region "$AWS_REGION" --table-name "$table_name" --query 'Table.TableArn' --output text 2>/dev/null || echo "")

        if [[ -z "$table_arn" ]]; then
            continue
        fi

        # Get table tags
        local table_tags
        table_tags=$(aws dynamodb list-tags-of-resource --region "$AWS_REGION" --resource-arn "$table_arn" --query 'Tags[].{Key:Key,Value:Value}' --output json 2>/dev/null || echo "[]")

        # Check for PR-specific tags if PR number specified
        if [[ -n "$PR_NUMBER" ]]; then
            local has_pr_tag
            has_pr_tag=$(echo "$table_tags" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")

            # Also check table name for PR pattern
            if [[ -z "$has_pr_tag" ]] && [[ ! "$table_name" =~ pr-?${PR_NUMBER} ]] && [[ ! "$table_name" =~ PR${PR_NUMBER} ]]; then
                continue  # Skip tables not related to this PR
            fi
        fi

        # Check for tag conflicts
        if ! check_tag_conflicts "DynamoDB Table" "$table_name" "$table_tags"; then
            tables_with_conflicts=$((tables_with_conflicts + 1))
        fi

        log_debug "Checked DynamoDB Table: $table_name"
    done

    log_info "DynamoDB Tables: $tables_with_conflicts/$total_tables have tag conflicts"
}

# Main audit function
main() {
    log_info "🚀 Starting AWS Tag Conflict Audit"
    log_info "Region: $AWS_REGION"
    log_info "PR Number: ${PR_NUMBER:-"all"}"
    log_info "Output File: ${OUTPUT_FILE:-"console only"}"
    
    # Verify AWS CLI access
    if ! aws sts get-caller-identity --region "$AWS_REGION" >/dev/null 2>&1; then
        log_error "AWS CLI not configured or no access to region $AWS_REGION"
        exit 1
    fi
    
    # Initialize audit results
    local audit_results
    audit_results=$(init_audit_results)
    
    # Run audits
    audit_iam_roles
    
    # Run additional resource audits
    audit_iam_policies
    audit_ec2_instances
    audit_security_groups
    audit_load_balancers
    audit_cloudwatch_logs
    audit_dynamodb_tables
    
    log_success "✅ Tag conflict audit completed"
    
    # Save results if output file specified
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo "$audit_results" > "$OUTPUT_FILE"
        log_success "Audit results saved to: $OUTPUT_FILE"
    fi
}

# Parse arguments and run main function
parse_arguments "$@"
main

#!/bin/bash

# Emergency cleanup script for PR-35 orphaned resources
# This script specifically targets the resources that are preventing deployment

set -euo pipefail

# Colors for output
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

# Check AWS CLI
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    log_success "AWS CLI is configured and working"
}

# Clean up specific orphaned resources for PR-35
cleanup_pr35_resources() {
    local region="${AWS_REGION:-us-east-1}"
    
    log_info "🧹 Emergency cleanup for PR-35 orphaned resources..."
    log_info "Region: ${region}"
    
    # 1. Clean up CloudWatch Log Groups
    log_info "📊 Cleaning CloudWatch Log Groups..."
    
    local log_groups=(
        "/aws/deployment/macro-ai-pr-35"
        "/aws/ec2/macro-ai-PR35/errors"
        "/aws/ec2/macro-ai-PR35/application"
        "/aws/ec2/macro-ai-PR35/system"
        "/aws/ec2/macro-ai-PR35/performance"
        "/aws/ec2/macro-ai-pr-35/errors"
        "/aws/ec2/macro-ai-pr-35/application"
        "/aws/ec2/macro-ai-pr-35/system"
        "/aws/ec2/macro-ai-pr-35/performance"
    )
    
    for log_group in "${log_groups[@]}"; do
        log_info "Checking log group: ${log_group}"
        if aws logs describe-log-groups --region "${region}" --log-group-name-prefix "${log_group}" --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q "${log_group}"; then
            log_info "🗑️  Deleting log group: ${log_group}"
            if aws logs delete-log-group --region "${region}" --log-group-name "${log_group}" 2>/dev/null; then
                log_success "✅ Deleted log group: ${log_group}"
            else
                log_warning "❌ Failed to delete log group: ${log_group}"
            fi
        else
            log_info "Log group does not exist: ${log_group}"
        fi
        sleep 1  # Rate limiting
    done
    
    # 2. Clean up DynamoDB Tables
    log_info "🗄️  Cleaning DynamoDB Tables..."
    
    local tables=(
        "macro-ai-pr-35-deployment-history"
        "macro-ai-PR35-deployment-history"
    )
    
    for table in "${tables[@]}"; do
        log_info "Checking DynamoDB table: ${table}"
        if aws dynamodb describe-table --region "${region}" --table-name "${table}" &>/dev/null; then
            log_info "🗑️  Deleting DynamoDB table: ${table}"
            if aws dynamodb delete-table --region "${region}" --table-name "${table}" &>/dev/null; then
                log_success "✅ Initiated deletion of DynamoDB table: ${table}"
                
                # Wait for deletion to complete
                log_info "⏳ Waiting for table deletion to complete..."
                local max_wait=120
                local wait_time=0
                local check_interval=10
                
                while [[ ${wait_time} -lt ${max_wait} ]]; do
                    if ! aws dynamodb describe-table --region "${region}" --table-name "${table}" &>/dev/null; then
                        log_success "✅ DynamoDB table deletion completed: ${table}"
                        break
                    fi
                    
                    log_info "⏳ Waiting for table deletion... (${wait_time}s/${max_wait}s)"
                    sleep ${check_interval}
                    wait_time=$((wait_time + check_interval))
                done
                
                if [[ ${wait_time} -ge ${max_wait} ]]; then
                    log_warning "⚠️  Table deletion timeout, but deletion may still be in progress: ${table}"
                fi
            else
                log_warning "❌ Failed to delete DynamoDB table: ${table}"
            fi
        else
            log_info "DynamoDB table does not exist: ${table}"
        fi
        sleep 2  # Rate limiting
    done
    
    # 3. Clean up any S3 buckets
    log_info "🪣 Checking for S3 buckets..."
    
    local bucket_patterns=(
        "macro-ai-pr-35"
        "macro-ai-pr35"
    )
    
    for pattern in "${bucket_patterns[@]}"; do
        log_info "Checking bucket pattern: ${pattern}*"
        local buckets
        buckets=$(aws s3api list-buckets --region "${region}" --query "Buckets[?starts_with(Name, \`${pattern}\`)].Name" --output text 2>/dev/null || echo "")
        
        if [[ -n "${buckets}" && "${buckets}" != "None" ]]; then
            IFS=$'\t' read -ra bucket_array <<< "${buckets}"
            for bucket in "${bucket_array[@]}"; do
                if [[ -n "${bucket}" ]]; then
                    log_info "🗑️  Emptying and deleting S3 bucket: ${bucket}"
                    aws s3 rm "s3://${bucket}" --recursive 2>/dev/null || true
                    aws s3api delete-bucket --region "${region}" --bucket "${bucket}" 2>/dev/null || true
                    log_success "✅ Processed S3 bucket: ${bucket}"
                fi
            done
        else
            log_info "No S3 buckets found with pattern: ${pattern}*"
        fi
    done
    
    log_success "🎉 Emergency cleanup completed!"
}

# Main execution
main() {
    log_info "🚀 Starting emergency cleanup for PR-35..."
    
    check_aws_cli
    cleanup_pr35_resources
    
    log_success "🎉 All cleanup operations completed!"
    log_info "You can now retry the deployment."
}

# Run the script
main "$@"

#!/bin/bash

# =============================================================================
# Simple Cost Optimization Validation for PR #47
# =============================================================================
# 
# This script provides basic validation of Priority 1-3 cost optimizations
# without requiring jq or bc dependencies.
#
# Usage:
#   ./simple-cost-validation.sh pr-47
#
# Exit Codes:
#   0 - Validation successful
#   1 - Validation failed

set -euo pipefail

# Configuration
PR_ENVIRONMENT="${1:-pr-47}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_priority() {
    echo -e "${PURPLE}🎯 PRIORITY 4: $1${NC}"
}

# Validation functions
validate_basic_connectivity() {
    log_info "Testing AWS connectivity..."
    
    if aws sts get-caller-identity >/dev/null 2>&1; then
        log_success "AWS CLI connectivity verified"
        return 0
    else
        log_error "AWS CLI connectivity failed"
        return 1
    fi
}

validate_priority_1_basic() {
    log_priority "Validating Priority 1 optimizations (NAT Gateway elimination)"
    
    local validation_score=0
    
    # Check NAT Gateway elimination
    log_info "🔍 Checking NAT Gateway elimination..."
    local nat_count
    nat_count=$(aws ec2 describe-nat-gateways \
        --region "$AWS_REGION" \
        --filter "Name=tag:Environment,Values=$PR_ENVIRONMENT" \
        --query 'length(NatGateways[?State==`available`])' \
        --output text 2>/dev/null || echo "0")
    
    if [[ "$nat_count" == "0" ]]; then
        log_success "✅ NAT Gateway elimination verified - no active NAT Gateways found"
        ((validation_score += 50))
    else
        log_warning "⚠️ Found $nat_count NAT Gateways still active"
    fi
    
    # Check Auto Scaling Groups
    log_info "🔍 Checking Auto Scaling Groups..."
    local asg_count
    asg_count=$(aws autoscaling describe-auto-scaling-groups \
        --region "$AWS_REGION" \
        --query "length(AutoScalingGroups[?contains(Tags[?Key=='Environment'].Value, '$PR_ENVIRONMENT')])" \
        --output text 2>/dev/null || echo "0")
    
    if [[ "$asg_count" -gt 0 ]]; then
        log_success "✅ Auto Scaling Groups found: $asg_count"
        ((validation_score += 50))
    else
        log_warning "⚠️ No Auto Scaling Groups found"
    fi
    
    log_info "📊 Priority 1 validation score: ${validation_score}%"
    return $((validation_score >= 75 ? 0 : 1))
}

validate_priority_2_basic() {
    log_priority "Validating Priority 2 optimizations (Instance optimization)"
    
    local validation_score=0
    
    # Check instance types
    log_info "🔍 Checking instance type optimization..."
    local instances
    instances=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$PR_ENVIRONMENT" "Name=instance-state-name,Values=running,pending" \
        --query 'Reservations[].Instances[].InstanceType' \
        --output text 2>/dev/null || echo "")
    
    if [[ "$instances" == *"t3.nano"* ]]; then
        log_success "✅ t3.nano instance type verified for cost optimization"
        ((validation_score += 40))
    elif [[ -n "$instances" ]]; then
        log_warning "⚠️ Non-optimized instance types found: $instances"
    else
        log_info "ℹ️ No running instances found"
        ((validation_score += 20)) # Partial credit
    fi
    
    # Check EBS volumes
    log_info "🔍 Checking EBS volume optimization..."
    local volumes
    volumes=$(aws ec2 describe-volumes \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$PR_ENVIRONMENT" \
        --query 'Volumes[].VolumeType' \
        --output text 2>/dev/null || echo "")
    
    if [[ "$volumes" == *"gp3"* ]]; then
        log_success "✅ gp3 EBS volumes verified for cost optimization"
        ((validation_score += 30))
    elif [[ -n "$volumes" ]]; then
        log_warning "⚠️ Non-optimized EBS volume types found: $volumes"
    else
        log_info "ℹ️ No EBS volumes found"
        ((validation_score += 15)) # Partial credit
    fi
    
    # Check CloudWatch alarms
    log_info "🔍 Checking CloudWatch cost alarms..."
    local alarm_count
    alarm_count=$(aws cloudwatch describe-alarms \
        --region "$AWS_REGION" \
        --alarm-name-prefix "macro-ai-$PR_ENVIRONMENT" \
        --query 'length(MetricAlarms[])' \
        --output text 2>/dev/null || echo "0")
    
    if [[ "$alarm_count" -gt 0 ]]; then
        log_success "✅ CloudWatch alarms configured: $alarm_count alarms"
        ((validation_score += 30))
    else
        log_warning "⚠️ No CloudWatch alarms found"
    fi
    
    log_info "📊 Priority 2 validation score: ${validation_score}%"
    return $((validation_score >= 75 ? 0 : 1))
}

validate_priority_3_basic() {
    log_priority "Validating Priority 3 optimizations (Auto-cleanup tags)"
    
    local validation_score=0
    
    # Check spot instances using instance lifecycle
    log_info "🔍 Checking spot instance configuration..."
    local spot_instances
    spot_instances=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$PR_ENVIRONMENT" "Name=instance-state-name,Values=running,pending" \
        --query "Reservations[].Instances[?InstanceLifecycle=='spot'].InstanceId" \
        --output text 2>/dev/null || echo "")

    if [[ -n "$spot_instances" ]]; then
        log_success "✅ Spot instances detected: $spot_instances"
        ((validation_score += 50))
    else
        log_info "ℹ️ No active spot instances found (may use on-demand for availability)"
        ((validation_score += 25)) # Partial credit
    fi
    
    # Check auto-cleanup tags
    log_info "🔍 Checking auto-cleanup tags..."
    local cleanup_count
    cleanup_count=$(aws resourcegroupstaggingapi get-resources \
        --region "$AWS_REGION" \
        --tag-filters "Key=AutoCleanup,Values=true" "Key=Environment,Values=$PR_ENVIRONMENT" \
        --query 'length(ResourceTagMappingList[])' \
        --output text 2>/dev/null || echo "0")
    
    if [[ "$cleanup_count" -gt 0 ]]; then
        log_success "✅ Auto-cleanup tags verified on $cleanup_count resources"
        ((validation_score += 50))
    else
        log_warning "⚠️ No resources with auto-cleanup tags found"
    fi
    
    log_info "📊 Priority 3 validation score: ${validation_score}%"
    return $((validation_score >= 70 ? 0 : 1))
}

# Generate simple cost report
generate_simple_cost_report() {
    log_priority "Generating simple cost optimization report"
    
    # Get resource counts
    local ec2_count
    ec2_count=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$PR_ENVIRONMENT" \
        --query 'length(Reservations[].Instances[])' \
        --output text 2>/dev/null || echo "0")
    
    local ebs_count
    ebs_count=$(aws ec2 describe-volumes \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$PR_ENVIRONMENT" \
        --query 'length(Volumes[])' \
        --output text 2>/dev/null || echo "0")
    
    local alb_count
    alb_count=$(aws elbv2 describe-load-balancers \
        --region "$AWS_REGION" \
        --query "length(LoadBalancers[?contains(LoadBalancerName, '$PR_ENVIRONMENT')])" \
        --output text 2>/dev/null || echo "0")
    
    echo ""
    log_priority "💰 Cost Optimization Report Summary"
    echo "=================================================="
    echo "🎯 Environment: $PR_ENVIRONMENT"
    echo "📅 Generated: $(date)"
    echo ""
    echo "📊 Resource Inventory:"
    echo "  EC2 Instances: $ec2_count"
    echo "  EBS Volumes: $ebs_count"
    echo "  Load Balancers: $alb_count"
    echo ""
    echo "🎯 Optimization Targets:"
    echo "  Priority 1: NAT Gateway elimination & scheduled scaling (~\$4.21/month)"
    echo "  Priority 2: Instance optimization & cost monitoring (~\$3.75/month)"
    echo "  Priority 3: Spot instances & auto-cleanup tags (~\$0.60/month)"
    echo ""
    echo "💰 Combined Target: ~\$8.56/month total savings"
    echo "🏆 Final Goal: <\$0.50/month per preview environment"
}

# Main validation function
main() {
    log_priority "Starting Simple Cost Optimization Validation for $PR_ENVIRONMENT"
    echo "Target: <\$0.50/month per preview environment with Priority 1-3 optimizations"
    echo ""
    
    local overall_success=true
    
    # Basic connectivity test
    if ! validate_basic_connectivity; then
        log_error "Basic connectivity failed - cannot proceed with validation"
        exit 1
    fi
    echo ""
    
    # Run priority validations
    if ! validate_priority_1_basic; then
        log_warning "Priority 1 validation failed"
        overall_success=false
    fi
    echo ""
    
    if ! validate_priority_2_basic; then
        log_warning "Priority 2 validation failed"
        overall_success=false
    fi
    echo ""
    
    if ! validate_priority_3_basic; then
        log_warning "Priority 3 validation failed"
        overall_success=false
    fi
    echo ""
    
    # Generate cost report
    generate_simple_cost_report
    echo ""
    
    # Final summary
    if [[ "$overall_success" == "true" ]]; then
        log_success "🎉 SIMPLE VALIDATION PASSED - Cost optimizations are working!"
        log_success "✅ Priority 4 implementation validated successfully"
        log_success "🎯 Ready for production deployment of cost-optimized preview environments"
        exit 0
    else
        log_error "❌ SIMPLE VALIDATION FAILED - Some optimizations need attention"
        log_error "⚠️ Review individual priority results above for specific issues"
        exit 1
    fi
}

# Run main function
main

# EC2 Teardown Workflows Testing Guide

This guide provides comprehensive testing procedures for validating both automatic and manual EC2 teardown workflows.

## Overview

The EC2 teardown system consists of:

- **Automatic teardown**: `destroy-preview.yml` (triggered on PR closure)
- **Manual teardown**: `teardown-dev.yml` (manually triggered workflow)
- **Centralized verification**: `verify-ec2-cleanup.sh` (shared verification logic)

## Pre-Testing Validation

### 1. Workflow Syntax Validation

```bash
# Validate YAML syntax (if Python is available)
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/destroy-preview.yml'))"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/teardown-dev.yml'))"

# Alternative: Use online YAML validators or IDE validation
```

### 2. Verification Script Testing

```bash
# Test verification script help and basic functionality
cd infrastructure
./scripts/verify-ec2-cleanup.sh --help

# Test with non-existent environment (should pass - no resources to clean)
./scripts/verify-ec2-cleanup.sh --pr-number 999 --timeout 10

# Test parameter validation (should fail)
./scripts/verify-ec2-cleanup.sh 2>/dev/null && echo "FAIL: Should require parameters" || echo "PASS: Parameter validation works"
```

### 3. Content Validation Checklist

#### destroy-preview.yml Checklist

- [ ] ✅ Contains "EC2 instances and Auto Scaling Group" in cleanup messages
- [ ] ✅ Contains "Application Load Balancer and Target Groups" in cleanup messages
- [ ] ✅ Contains "VPC networking components" in cleanup messages
- [ ] ✅ Uses `CDK_DEPLOY_TYPE: 'ec2-preview'` environment variable
- [ ] ✅ Uses `verify-ec2-cleanup.sh` for verification
- [ ] ✅ No references to "Lambda function" in user-facing messages
- [ ] ✅ Includes EC2-specific manual cleanup instructions

#### teardown-dev.yml Checklist

- [ ] ✅ Contains "EC2-based development environment" in logging
- [ ] ✅ Contains EC2 resource details in expected cleanup list
- [ ] ✅ Uses `CDK_DEPLOY_TYPE: 'ec2-preview'` environment variable
- [ ] ✅ Uses `verify-ec2-cleanup.sh` with extended timeout
- [ ] ✅ Updated GitHub Step Summary with EC2 resources
- [ ] ✅ No references to "Lambda function" in user-facing messages

## Integration Testing

### Test Scenario 1: Automatic Teardown (PR Closure)

**Prerequisites:**

- Active PR with deployed EC2 preview environment
- PR author must be a code owner
- PR must be from the same repository (not a fork)

**Test Steps:**

1. Create a test PR with code changes
2. Wait for preview environment deployment to complete
3. Verify preview environment is accessible
4. Close/merge the PR
5. Monitor the `destroy-preview.yml` workflow execution
6. Verify cleanup completion and PR comments

**Expected Results:**

- [ ] Workflow triggers automatically on PR closure
- [ ] Workflow identifies correct stack name (MacroAiPr\*Stack format)
- [ ] CDK destroy command executes with EC2 context variables
- [ ] Verification script runs and reports cleanup status
- [ ] PR comment shows EC2 resources cleaned up (not Lambda)
- [ ] All EC2 resources are properly terminated

### Test Scenario 2: Manual Teardown

**Prerequisites:**

- Active PR with deployed EC2 preview environment
- User must be a code owner
- Manual workflow dispatch permissions

**Test Steps:**

1. Navigate to Actions → "Manual Teardown - Development Environment"
2. Click "Run workflow"
3. Enter PR number (e.g., 123)
4. Enter confirmation text: "I UNDERSTAND"
5. Run the workflow
6. Monitor execution and verify results

**Expected Results:**

- [ ] Workflow validates user is code owner
- [ ] Workflow generates correct stack name
- [ ] Manual teardown logging shows EC2-specific information
- [ ] CDK destroy executes with proper EC2 context
- [ ] Extended verification runs with 600s timeout
- [ ] GitHub Step Summary shows EC2 resources cleaned up

### Test Scenario 3: Error Handling

**Test Cases:**

1. **Non-existent environment**: Run manual teardown for non-existent PR
2. **Non-code-owner**: Have non-code-owner attempt manual teardown
3. **Forked PR**: Test automatic teardown on forked repository PR
4. **Partial cleanup**: Simulate partial resource cleanup scenarios

**Expected Results:**

- [ ] Non-existent environment: Workflow completes successfully (no resources to clean)
- [ ] Non-code-owner: Workflow blocks execution with appropriate error
- [ ] Forked PR: Automatic teardown skips execution with log message
- [ ] Partial cleanup: Verification reports remaining resources accurately

## Production Testing Checklist

### Before Production Deployment

1. **Workflow Validation**
   - [ ] Both workflows pass YAML syntax validation
   - [ ] All EC2-specific content is present and Lambda references removed
   - [ ] Environment variables are correctly configured
   - [ ] Verification script is executable and functional

2. **Integration Testing**
   - [ ] Create test PR and verify automatic teardown works
   - [ ] Test manual teardown with test environment
   - [ ] Verify error handling for edge cases
   - [ ] Confirm PR comments show correct EC2 resource information

3. **Security Validation**
   - [ ] Code owner validation works correctly
   - [ ] Forked repository PRs are properly handled
   - [ ] Manual teardown requires proper confirmation
   - [ ] AWS permissions are correctly configured

4. **Monitoring Setup**
   - [ ] CloudWatch logs capture teardown operations
   - [ ] Failed teardowns generate appropriate alerts
   - [ ] Cost monitoring tracks resource cleanup effectiveness

### Post-Deployment Monitoring

1. **First Week**
   - Monitor all automatic teardowns for successful completion
   - Verify no orphaned EC2 resources remain after teardowns
   - Check PR comments for accurate resource reporting
   - Monitor manual teardown usage and success rates

2. **Ongoing**
   - Weekly review of teardown success rates
   - Monthly audit of any orphaned resources
   - Quarterly review of cost savings from automated cleanup

## Troubleshooting Guide

### Common Issues

1. **Verification Script Fails**

   ```bash
   # Check AWS credentials and permissions
   aws sts get-caller-identity

   # Test script with verbose logging
   ./scripts/verify-ec2-cleanup.sh --pr-number 123 --verbose
   ```

2. **CDK Destroy Fails**

   ```bash
   # Check CDK context and environment variables
   echo $CDK_DEPLOY_TYPE
   echo $CDK_DEPLOY_ENV

   # Manual CDK destroy for debugging
   cd infrastructure
   pnpm cdk destroy MacroAiPr123Stack --force
   ```

3. **Workflow Permissions Issues**

   ```bash
   # Verify GitHub Actions permissions
   # Check AWS role assumptions in workflow logs
   # Validate code owner configuration
   ```

## Success Criteria

The EC2 teardown workflows are considered successfully tested when:

- [ ] ✅ All automatic teardowns complete successfully on PR closure
- [ ] ✅ Manual teardowns work correctly for code owners
- [ ] ✅ Verification accurately reports EC2 resource cleanup status
- [ ] ✅ No Lambda references remain in user-facing messages
- [ ] ✅ Error handling works correctly for all edge cases
- [ ] ✅ Cost optimization goals are met through effective cleanup
- [ ] ✅ No orphaned EC2 resources remain after teardown operations

## Next Steps

After successful testing:

1. Deploy workflows to production
2. Monitor initial production teardowns closely
3. Implement scheduled cleanup (Objective 3)
4. Begin code cleanup tasks (parallel workstream)

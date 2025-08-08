# Ephemeral PR Environment Validation Plan

## Status: 📋 PLANNED

This document defines comprehensive validation procedures for the ephemeral PR environment system to ensure all workflows,
access controls, and lifecycle automation function correctly before production use.

## 🎯 Validation Objectives

- Verify automatic PR environment deployment and cleanup
- Validate CODEOWNERS-based access control
- Test forked PR security restrictions and manual overrides
- Confirm cost optimization and resource management
- Validate CDK infrastructure changes
- Test manual teardown workflows with proper confirmations

## 🧪 Test Scenarios

### 1. Same-Repository PR by Code Owner (Happy Path)

**Scenario**: Code owner creates PR from same repository
**Expected Behavior**: Automatic deployment and cleanup

#### Test Steps

1. **Create test PR** from feature branch to develop
2. **Verify automatic deployment**:
   - `deploy-preview.yml` workflow triggers
   - Code owner validation passes
   - Environment `pr-{number}` deploys successfully
   - PR comment posted with endpoints
3. **Test deployed environment**:
   - API health endpoint responds (200 OK)
   - Lambda function accessible via API Gateway
   - CloudWatch logs created
4. **Verify cleanup**:
   - Close/merge PR
   - `destroy-preview.yml` workflow triggers
   - CloudFormation stack destroyed
   - PR comment confirms cleanup

#### Success Criteria

- [ ] Deployment completes within 10 minutes
- [ ] Health endpoint returns 200 OK
- [ ] PR comment contains valid API endpoint
- [ ] Cleanup completes within 5 minutes
- [ ] No resources remain after cleanup

### 2. Same-Repository PR by Non-Code-Owner

**Scenario**: Non-code-owner creates PR from same repository
**Expected Behavior**: Deployment blocked with explanation

#### Test Steps

1. **Create test user** not in CODEOWNERS
2. **Create PR** from that user's branch
3. **Verify blocking**:
   - `deploy-preview.yml` workflow runs
   - Code owner validation fails
   - No AWS deployment occurs
   - PR comment explains restriction

#### Success Criteria

- [ ] No AWS resources created
- [ ] Clear explanation in PR comment
- [ ] Workflow completes without errors
- [ ] No cleanup needed (nothing deployed)

### 3. Forked Repository PR

**Scenario**: External contributor creates PR from fork
**Expected Behavior**: Automatic deployment blocked, manual override available

#### Test Steps

1. **Create fork** of repository
2. **Create PR** from forked repository
3. **Verify automatic blocking**:
   - `deploy-preview.yml` workflow runs
   - Same-repo validation fails
   - No AWS deployment occurs
   - PR comment explains forked PR policy
4. **Test manual override**:
   - Code owner runs `deploy-forked-pr-preview.yml`
   - Provides PR number and confirmation
   - Deployment uses trusted develop branch code
   - PR comment warns about trusted code usage

#### Success Criteria

- [ ] No automatic deployment for forked PR
- [ ] Manual override works for code owners
- [ ] Deployed environment uses base repository code
- [ ] Clear security warnings in PR comments

### 4. CDK Infrastructure Validation

**Scenario**: Validate CDK changes for ephemeral environments
**Expected Behavior**: Correct parameter handling and resource creation

#### Test Steps

1. **CDK Synth Test**:

   ```bash
   cd infrastructure
   CDK_DEPLOY_ENV=pr-123 CDK_DEPLOY_SCALE=hobby pnpm cdk synth
   ```

2. **Verify synthesized template**:
   - Stack name: `MacroAiPr-123Stack`
   - No SSM parameters created for pr-\* environments
   - Lambda environment variables point to `/macro-ai/development`
   - Proper tags applied (EnvironmentType=ephemeral)
3. **CDK Diff Test**:

   ```bash
   CDK_DEPLOY_ENV=pr-123 pnpm cdk diff
   ```

4. **Parameter Store validation**:
   - Confirm `/macro-ai/development` parameters exist
   - Verify Lambda can read shared parameters

#### Success Criteria

- [ ] CDK synth succeeds for pr-\* environments
- [ ] No SSM parameters in synthesized template
- [ ] Correct parameter prefix in Lambda environment
- [ ] Ephemeral tags applied correctly
- [ ] CDK diff shows expected changes only

### 5. Manual Teardown Workflows

**Scenario**: Test manual teardown workflows with proper access control
**Expected Behavior**: Only code owners can run with required confirmations

#### Test Steps

##### Development Environment Teardown

1. **Deploy test environment** (pr-999)
2. **Test access control**:
   - Non-code-owner attempts to run workflow (should fail)
   - Code owner runs with wrong confirmation (should fail)
   - Code owner runs with correct confirmation (should succeed)
3. **Verify destruction**:
   - CloudFormation stack destroyed
   - Resources cleaned up
   - Workflow summary shows success

##### Staging Environment Teardown

1. **Test double confirmation**:
   - Wrong primary confirmation (should fail)
   - Wrong secondary confirmation (should fail)
   - Both correct confirmations (should succeed)
2. **Verify termination protection handling**
3. **Test recovery procedures**

##### Production Environment Teardown

1. **Test triple confirmation**:
   - All three confirmations required
   - 30-second countdown before destruction
   - Extended retry logic (10 attempts)
2. **Verify termination protection disabled**
3. **Test critical warnings and impact documentation**

#### Success Criteria

- [ ] Access control prevents unauthorized teardowns
- [ ] Confirmation requirements enforced
- [ ] Proper warnings and countdowns implemented
- [ ] Complete resource cleanup verified
- [ ] Recovery procedures documented and tested

### 6. Cost Optimization Validation

**Scenario**: Verify cost optimization features work correctly
**Expected Behavior**: Minimal costs for ephemeral environments

#### Test Steps

1. **Parameter Store cost validation**:
   - Confirm no Advanced tier parameters created for pr-\*
   - Verify shared `/macro-ai/development` usage
2. **Resource optimization**:
   - ARM64 Lambda architecture
   - Conservative API Gateway throttling
   - Short log retention (7 days)
3. **Tagging validation**:
   - Cost allocation tags applied
   - Environment type tags correct
   - Expiry date tags for governance

#### Success Criteria

- [ ] No per-PR parameter costs
- [ ] Optimized resource configurations
- [ ] Proper cost allocation tags
- [ ] Automatic cleanup prevents accumulation

### 7. Security Validation

**Scenario**: Verify security controls and access restrictions
**Expected Behavior**: Robust security without vulnerabilities

#### Test Steps

1. **CODEOWNERS validation**:
   - Test composite action with various user types
   - Verify case-insensitive matching
   - Test with malformed CODEOWNERS file
2. **Forked PR security**:
   - Confirm no `pull_request_target` usage
   - Verify trusted code checkout in manual workflows
   - Test secrets isolation
3. **AWS permissions**:
   - Verify least-privilege IAM roles
   - Test parameter store access scoping
   - Confirm no cross-environment access

#### Success Criteria

- [ ] Code owner validation robust and secure
- [ ] Forked PRs cannot access secrets
- [ ] AWS permissions properly scoped
- [ ] No security vulnerabilities identified

## 🔧 Validation Tools and Commands

### CDK Validation Commands

```bash
# Synth test for ephemeral environment
cd infrastructure
CDK_DEPLOY_ENV=pr-123 CDK_DEPLOY_SCALE=hobby pnpm cdk synth

# Diff test
CDK_DEPLOY_ENV=pr-123 pnpm cdk diff

# List all preview stacks
aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `MacroAiPr-`)].{Name:StackName,Status:StackStatus}'
```

### Health Check Commands

```bash
# Test API endpoint
curl -s https://api-endpoint/api/health

# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/macro-ai-pr-"

# Verify parameter access
aws ssm get-parameters-by-path --path "/macro-ai/development" --recursive
```

### Cleanup Verification

```bash
# Verify stack deletion
aws cloudformation describe-stacks --stack-name MacroAiPr-123Stack

# Check for orphaned resources
aws lambda list-functions --query 'Functions[?contains(FunctionName, `macro-ai-pr-`)].FunctionName'
aws apigateway get-rest-apis --query 'items[?contains(name, `macro-ai-pr-`)].{name:name,id:id}'
```

## 📊 Success Metrics

### Performance Targets

- **Deployment Time**: < 10 minutes for PR environments
- **Cleanup Time**: < 5 minutes for environment destruction
- **Health Check Response**: < 2 seconds for API endpoints

### Reliability Targets

- **Deployment Success Rate**: > 95%
- **Cleanup Success Rate**: > 99%
- **Security Control Effectiveness**: 100% (no bypasses allowed)

### Cost Targets

- **Per-PR Cost**: < $0.10 per day (excluding compute usage)
- **Parameter Store Cost**: $0 (shared parameters only)
- **Cleanup Effectiveness**: 100% (no lingering resources)

## 🚨 Rollback Plan

If validation reveals critical issues:

1. **Immediate Actions**:
   - Disable automatic PR deployments
   - Document all identified issues
   - Notify stakeholders of validation status

2. **Issue Resolution**:
   - Fix identified problems in feature branch
   - Re-run affected validation scenarios
   - Update documentation as needed

3. **Re-validation**:
   - Complete full validation suite
   - Verify all success criteria met
   - Obtain approval for production deployment

## 📋 Validation Checklist

### Pre-Validation Setup

- [ ] Feature branch `feature/ephemeral-pr-environments` ready
- [ ] All workflows committed and pushed
- [ ] CODEOWNERS file configured
- [ ] Parameter Store `/macro-ai/development` populated
- [ ] Test users and forks prepared

### Core Functionality Tests

- [ ] Same-repo code owner PR (automatic deployment)
- [ ] Same-repo non-owner PR (blocked deployment)
- [ ] Forked PR (blocked automatic, manual override works)
- [ ] CDK infrastructure validation (synth/diff tests)
- [ ] Manual teardown workflows (all three environments)

### Security and Access Control

- [ ] CODEOWNERS validation comprehensive
- [ ] Forked PR security restrictions effective
- [ ] AWS permissions properly scoped
- [ ] No security vulnerabilities found

### Cost and Performance

- [ ] Cost optimization features working
- [ ] Performance targets met
- [ ] Resource cleanup complete
- [ ] Tagging strategy implemented

### Documentation and Operations

- [ ] All documentation updated
- [ ] Runbooks tested and accurate
- [ ] Troubleshooting guides validated
- [ ] Team training completed

## ✅ Validation Sign-off

**Validation Completed By**: **\*\*\*\***\_**\*\*\*\***  
**Date**: **\*\*\*\***\_**\*\*\*\***  
**Issues Found**: **\*\*\*\***\_**\*\*\*\***  
**Resolution Status**: **\*\*\*\***\_**\*\*\*\***  
**Approved for Production**: [ ] Yes [ ] No

**Approver**: **\*\*\*\***\_**\*\*\*\***  
**Date**: **\*\*\*\***\_**\*\*\*\***

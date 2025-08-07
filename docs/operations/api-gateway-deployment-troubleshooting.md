# API Gateway Deployment Troubleshooting Guide

**Status**: ✅ COMPLETE  
**Version**: v1.0.0  
**Last Updated**: August 2025

## 🎯 Overview

This guide provides comprehensive troubleshooting information for API Gateway deployment issues in the Macro AI infrastructure.
The current implementation (v1.0.0+) resolves most common deployment conflicts, but this guide helps diagnose and resolve
any remaining issues.

## 🚨 Common Issues and Solutions

### 1. Resource Conflict Errors ✅ RESOLVED

**Error Pattern:**

```text
Error: Resource already exists in stack
Error: bmkqgyk2rd|development already exists in stack
Error: Another Deployment is in progress for rest api with id [api-id]
```

**Root Cause:**
Dual deployment creation (implicit + explicit) causing CloudFormation resource conflicts.

**Solution (Implemented in v1.0.0):**

- ✅ Single explicit deployment creation path
- ✅ `deploy: false` on RestApi constructor
- ✅ Proper resource dependencies
- ✅ Validation to prevent conflicts

**Verification:**

```bash
# Check CloudFormation template for single deployment
cd infrastructure
pnpm cdk synth | grep -A 5 -B 5 "AWS::ApiGateway::Deployment"
# Should show only ONE deployment resource per API
```

### 2. Stack Update Failures

**Error Pattern:**

```text
Error: Stack update failed
Error: Resource [ResourceId] failed to update
```

**Diagnosis Steps:**

1. **Check Stack Status:**

```bash
aws cloudformation describe-stacks \
  --stack-name MacroAiDevelopmentStack \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus'
```

1. **Review Stack Events:**

```bash
aws cloudformation describe-stack-events \
  --stack-name MacroAiDevelopmentStack \
  --region us-east-1 \
  --max-items 20
```

1. **Check Resource Dependencies:**

```bash
# Verify proper dependency chain in template
pnpm cdk synth | grep -A 10 "DependsOn"
```

**Common Solutions:**

- **Rollback and Retry:** If stack is in UPDATE_ROLLBACK_COMPLETE state
- **Manual Resource Cleanup:** Remove orphaned resources if necessary
- **Dependency Issues:** Ensure proper resource ordering in CDK code

### 3. Deployment Timeout Issues

**Error Pattern:**

```text
Error: Deployment timed out
Error: Resource creation timed out
```

**Diagnosis:**

1. **Check Lambda Package Size:**

```bash
ls -lh apps/express-api/dist/lambda.zip
# Should be < 50MB for reasonable deployment time
```

1. **Verify Lambda Dependencies:**

```bash
cd apps/express-api
pnpm audit
# Check for large or problematic dependencies
```

1. **Monitor CloudFormation Events:**

```bash
aws cloudformation describe-stack-events \
  --stack-name MacroAiDevelopmentStack \
  --region us-east-1 \
  --query 'StackEvents[?ResourceStatus==`CREATE_IN_PROGRESS`]'
```

**Solutions:**

- **Optimize Lambda Package:** Remove unnecessary dependencies
- **Increase Timeout:** Adjust CDK deployment timeout if needed
- **Check AWS Service Limits:** Verify account limits aren't exceeded

### 4. Permission Denied Errors

**Error Pattern:**

```text
Error: User is not authorized to perform: [action]
Error: Access Denied
```

**Required Permissions:**

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"cloudformation:*",
				"lambda:*",
				"apigateway:*",
				"ssm:*",
				"iam:*",
				"logs:*",
				"s3:*"
			],
			"Resource": "*"
		}
	]
}
```

**Verification:**

```bash
# Check current permissions
aws sts get-caller-identity
aws iam get-user
aws iam list-attached-user-policies --user-name [username]
```

### 5. CDK Bootstrap Issues

**Error Pattern:**

```text
Error: This stack uses assets, so the toolkit stack must be deployed
Error: Need to perform AWS CDK bootstrap
```

**Solution:**

```bash
# Bootstrap CDK in target region
cd infrastructure
pnpm cdk bootstrap aws://[account-id]/us-east-1
```

**Verification:**

```bash
# Check bootstrap stack exists
aws cloudformation describe-stacks \
  --stack-name CDKToolkit \
  --region us-east-1
```

## 🔍 Diagnostic Commands

### Quick Health Check

```bash
#!/bin/bash
# API Gateway Deployment Health Check

echo "🔍 API Gateway Deployment Diagnostics"
echo "======================================"

# 1. Check CDK synthesis
echo "1. CDK Synthesis Check:"
cd infrastructure
if pnpm cdk synth > /dev/null 2>&1; then
    echo "   ✅ CDK synthesis successful"
else
    echo "   ❌ CDK synthesis failed"
fi

# 2. Count deployment resources
echo "2. Deployment Resource Count:"
DEPLOYMENT_COUNT=$(pnpm cdk synth | grep -c "AWS::ApiGateway::Deployment" || echo "0")
echo "   Deployment resources: $DEPLOYMENT_COUNT (should be 1)"

# 3. Check stack status
echo "3. Stack Status:"
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name MacroAiDevelopmentStack \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")
echo "   Stack status: $STACK_STATUS"

# 4. Check API Gateway endpoint
echo "4. API Gateway Health:"
API_URL=$(aws cloudformation describe-stacks \
  --stack-name MacroAiDevelopmentStack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text 2>/dev/null)

if [ -n "$API_URL" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" || echo "000")
    echo "   API endpoint: $API_URL"
    echo "   HTTP status: $HTTP_STATUS"
else
    echo "   ❌ API endpoint not found"
fi

echo "======================================"
```

### Detailed Resource Analysis

```bash
# Analyze API Gateway resources in detail
aws apigateway get-rest-apis --region us-east-1 \
  --query 'items[?name==`macro-ai-development-api`]'

# Check deployment history
aws apigateway get-deployments \
  --rest-api-id [api-id] \
  --region us-east-1

# Verify stage configuration
aws apigateway get-stage \
  --rest-api-id [api-id] \
  --stage-name development \
  --region us-east-1
```

## 🛠️ Prevention Best Practices

### 1. Code Review Checklist

- ✅ Verify `deploy: false` on RestApi constructor
- ✅ Ensure single deployment creation path
- ✅ Check proper resource dependencies
- ✅ Validate environment-specific configuration

### 2. Deployment Process

1. **Always synthesize first:**

```bash
pnpm cdk synth
```

1. **Review changes:**

```bash
pnpm cdk diff
```

1. **Deploy with monitoring:**

```bash
./scripts/deploy.sh
```

1. **Verify deployment:**

```bash
curl -X OPTIONS [api-endpoint]/health \
  -H "Origin: http://localhost:3000"
```

### 3. Monitoring Setup

- **CloudWatch Alarms:** Monitor deployment failures
- **Stack Events:** Track resource creation/update status
- **API Health Checks:** Automated endpoint monitoring
- **Cost Monitoring:** Track unexpected charges

## 📞 Escalation Path

### Level 1: Self-Service

- Use this troubleshooting guide
- Check CloudFormation events
- Review CDK synthesis output

### Level 2: Team Support

- Share diagnostic command outputs
- Provide CloudFormation stack events
- Include CDK diff output

### Level 3: AWS Support

- Create AWS support case
- Include CloudFormation template
- Provide detailed error logs

## 📚 Additional Resources

- [CDK Infrastructure Guide](../deployment/hobby-deployment/cdk-infrastructure-guide.md)
- [ADR-005: API Gateway Deployment Architecture](../adr/005-api-gateway-deployment-architecture.md)
- [AWS CDK Troubleshooting](https://docs.aws.amazon.com/cdk/v2/guide/troubleshooting.html)
- [CloudFormation Troubleshooting](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/troubleshooting.html)

---

**Note**: This guide is maintained alongside the infrastructure code. Report issues or improvements via GitHub issues.

# Lambda Function Deployment Guide

This guide covers the complete process for deploying the Macro AI Lambda function to AWS with proper environment variables,
IAM roles, and Parameter Store permissions.

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Node.js 20+** and **pnpm** installed
3. **AWS CDK** bootstrapped in your target region

### One-Command Deployment

```bash
cd infrastructure
./scripts/deploy.sh
```

This script handles the complete deployment process including:

- Building the Lambda package
- Deploying CDK infrastructure
- Validating the deployment

## 📋 Detailed Deployment Process

### Step 1: Build Lambda Package

```bash
cd apps/express-api
pnpm install --frozen-lockfile
pnpm build:lambda
pnpm bundle:lambda
pnpm package:lambda
```

This creates `dist/lambda.zip` with the bundled Lambda function.

### Step 2: Deploy Infrastructure

```bash
cd infrastructure
pnpm install --frozen-lockfile
pnpm build
pnpm deploy
```

### Step 3: Validate Deployment

```bash
./scripts/validate-deployment.sh
```

## 🔧 Configuration

### Environment Variables

The Lambda function is configured with the following environment variables:

#### Core Configuration

- `NODE_ENV=production`
- `APP_ENV=hobby` (or your environment)
- `SERVICE_NAME=macro-ai-express-api`
- `LOG_LEVEL=INFO`

#### AWS Configuration

- `AWS_REGION` (automatically set by Lambda)
- `AWS_LAMBDA_FUNCTION_NAME=macro-ai-hobby-api`
- `PARAMETER_STORE_PREFIX=/macro-ai/hobby`

#### Parameter Store Integration

The Lambda function uses Parameter Store for sensitive configuration:

**Critical Parameters (Advanced Tier):**

- `/macro-ai/hobby/critical/openai-api-key`
- `/macro-ai/hobby/critical/neon-database-url`

**Standard Parameters (Standard Tier):**

- `/macro-ai/hobby/standard/upstash-redis-url`
- `/macro-ai/hobby/standard/cognito-user-pool-id`
- `/macro-ai/hobby/standard/cognito-user-pool-client-id`

### IAM Permissions

The Lambda function has the following permissions:

#### Basic Lambda Execution

- `AWSLambdaBasicExecutionRole` (managed policy)
- CloudWatch Logs creation and writing

#### Parameter Store Access

- `ssm:GetParameter` on `/macro-ai/hobby/*`
- `ssm:GetParameters` for batch retrieval
- Decrypt permissions for SecureString parameters

## 🔐 Post-Deployment Setup

### 1. Update Parameter Store Values

After deployment, update the placeholder parameters with actual values:

```bash
# Critical parameters (SecureString)
aws ssm put-parameter \
  --name '/macro-ai/hobby/critical/openai-api-key' \
  --value 'sk-your-actual-openai-key' \
  --type SecureString \
  --overwrite

aws ssm put-parameter \
  --name '/macro-ai/hobby/critical/neon-database-url' \
  --value 'postgresql://user:pass@host:5432/db' \
  --type SecureString \
  --overwrite

# Standard parameters (String)
aws ssm put-parameter \
  --name "/macro-ai/${ENVIRONMENT}/standard/cognito-user-pool-id" \
  --value 'us-east-1_XXXXXXXXX' \
  --type String \
  --overwrite

aws ssm put-parameter \
  --name '/macro-ai/hobby/standard/cognito-user-pool-client-id' \
  --value 'your-client-id' \
  --type String \
  --overwrite

# Optional Redis URL
aws ssm put-parameter \
  --name '/macro-ai/hobby/standard/upstash-redis-url' \
  --value 'redis://your-redis-url' \
  --type String \
  --overwrite
```

### 2. Test the Deployment

```bash
# Get the API endpoint from stack outputs
ENVIRONMENT=${CDK_DEPLOY_ENV:-staging}
ENV_CAPITALIZED=$(echo "$ENVIRONMENT" | sed 's/.*/\u&/')
STACK_NAME="MacroAi${ENV_CAPITALIZED}Stack"
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Test health endpoint
curl "${API_ENDPOINT}api/health"
```

Expected response:

```json
{
	"message": "Api Health Status: OK"
}
```

## 🔍 Monitoring and Troubleshooting

### View Lambda Logs

```bash
aws logs tail /aws/lambda/macro-ai-hobby-api --follow
```

### Check Lambda Function Status

```bash
aws lambda get-function --function-name macro-ai-hobby-api
```

### Test Lambda Function Directly

```bash
aws lambda invoke \
  --function-name macro-ai-hobby-api \
  --payload '{"httpMethod":"GET","path":"/api/health","headers":{}}' \
  response.json && cat response.json
```

### Common Issues

#### 1. Parameter Store Access Denied

- Verify IAM permissions include Parameter Store access
- Check parameter names match exactly (case-sensitive)

#### 2. Database Connection Errors

- Verify database URL in Parameter Store is correct
- Check network connectivity (VPC configuration if needed)

#### 3. Cold Start Timeouts

- Monitor CloudWatch metrics for duration
- Consider increasing Lambda timeout if needed

## 📊 Cost Optimization

The deployment is optimized for cost:

- **ARM64 architecture** (20% cheaper than x86)
- **512MB memory** (balanced performance/cost)
- **30-second timeout** (prevents runaway costs)
- **1-week log retention** (reduced storage costs)
- **Parameter Store caching** (reduces API calls)

## 🔄 Updates and Maintenance

### Update Lambda Code

```bash
cd apps/express-api
pnpm package:lambda
aws lambda update-function-code \
  --function-name macro-ai-hobby-api \
  --zip-file fileb://dist/lambda.zip
```

### Update Infrastructure

```bash
cd infrastructure
pnpm deploy
```

### Update Parameters

Use the AWS CLI or console to update Parameter Store values as needed.

## 🚨 Security Considerations

1. **Parameter Store**: All sensitive values stored as SecureString
2. **IAM Least Privilege**: Function only has required permissions
3. **VPC**: Consider VPC deployment for database access
4. **API Gateway**: CORS configured for security
5. **Logging**: No sensitive data logged

## 📞 Support

For issues or questions:

1. Check CloudWatch logs first
2. Run the validation script
3. Review this deployment guide
4. Check AWS service status

---

**Next Steps**: After successful deployment, configure your frontend to use the new API endpoint and test the complete
application flow.

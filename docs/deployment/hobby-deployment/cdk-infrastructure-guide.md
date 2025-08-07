# AWS CDK Infrastructure Implementation Guide

**Status**: ✅ COMPLETE  
**Version**: v1.0.0  
**Last Updated**: January 2025

## 🎯 Overview

This guide covers the AWS CDK infrastructure implementation for the Macro AI hobby deployment. The infrastructure creates
a cost-optimized serverless architecture targeting <£10/month operational costs.

## 🏗️ Architecture Components

### Core Infrastructure

- **AWS Lambda Function**: Serverless API backend running the Express application
- **API Gateway**: REST API with CORS, throttling, and optional custom domain
- **Parameter Store**: Secure configuration management with tiered parameters
- **IAM Roles & Policies**: Least-privilege access for Lambda to Parameter Store
- **CloudWatch Logs**: Centralized logging with cost-optimized retention

### Cost Optimization Features

- **ARM64 Architecture**: 20% cheaper than x86_64
- **Conservative Throttling**: Rate limits to prevent unexpected charges
- **Minimal Monitoring**: Basic CloudWatch logs with 1-week retention
- **No Provisioned Concurrency**: Pay only for actual usage
- **Tiered Parameters**: Standard tier for non-critical parameters

## 📁 Directory Structure

```text
infrastructure/
├── src/
│   ├── app.ts                          # CDK app entry point
│   ├── stacks/
│   │   └── macro-ai-hobby-stack.ts     # Main stack definition
│   └── constructs/
│       ├── api-gateway-construct.ts    # API Gateway configuration
│       ├── lambda-construct.ts         # Lambda function setup
│       └── parameter-store-construct.ts # Parameter Store hierarchy
├── scripts/
│   ├── deploy.sh                       # Deployment automation script
│   └── update-parameters.sh            # Parameter management script
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
├── cdk.json                           # CDK configuration
└── README.md                          # Infrastructure documentation
```

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js 18+** installed
3. **pnpm** installed globally: `npm install -g pnpm`
4. **AWS CDK CLI** installed globally: `pnpm add -g aws-cdk`
5. **AWS Account** with CDK bootstrapped in target region

### 1. Install Dependencies

```bash
cd infrastructure
pnpm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"
pnpm bootstrap
```

### 3. Deploy Infrastructure

```bash
# Automated deployment (recommended)
./scripts/deploy.sh

# Or manual deployment
npm run build
npm run deploy
```

### 4. Update Parameter Store Values

```bash
# Interactive parameter update
./scripts/update-parameters.sh

# Or manual updates
aws ssm put-parameter \
  --name "/macro-ai/development/critical/openai-api-key" \
  --value "sk-your-actual-openai-key" \
  --type "SecureString" \
  --overwrite
```

## 🔧 Configuration

### Environment Variables

- `AWS_ACCOUNT_ID` or `CDK_DEFAULT_ACCOUNT`: AWS account ID
- `AWS_REGION` or `CDK_DEFAULT_REGION`: AWS region (default: us-east-1)
- `CDK_DEPLOY_ENV`: Environment name (default: development)
- `CDK_DEPLOY_SCALE`: Infrastructure scale (default: hobby)

### Parameter Store Hierarchy

```text
/macro-ai/{environment}/
├── critical/           # Advanced tier parameters (higher throughput)
│   ├── openai-api-key
│   └── neon-database-url
└── standard/           # Standard tier parameters (cost-optimized)
    ├── upstash-redis-url
    ├── cognito-user-pool-id
    └── cognito-user-pool-client-id

# Examples:
# /macro-ai/staging/ (hobby scale)
# /macro-ai/production/ (hobby or enterprise scale)
```

### Lambda Configuration

- **Runtime**: Node.js 20.x on ARM64 (Graviton2)
- **Memory**: 512 MB (cost-optimized)
- **Timeout**: 30 seconds
- **Architecture**: ARM64 (20% cheaper than x86_64)
- **Logging**: CloudWatch with 1-week retention

### API Gateway Configuration

- **Type**: REST API with Lambda proxy integration
- **CORS**: Enabled for frontend integration
- **Throttling**: 100 requests/second, 200 burst limit
- **Monitoring**: Basic (detailed monitoring disabled for cost)

## 🔐 Security

### IAM Permissions

The Lambda execution role includes:

- `AWSLambdaBasicExecutionRole` (managed policy)
- Custom Parameter Store read policy with path restrictions
- KMS decrypt permissions for SecureString parameters

### Parameter Store Security

- **SecureString Parameters**: Encrypted with AWS managed KMS key
- **Path-based Access**: Lambda can only access `/macro-ai/development/*` parameters
- **Least Privilege**: No write permissions to Parameter Store

### Network Security

- **API Gateway**: Public endpoint with CORS restrictions
- **Lambda**: Runs in AWS managed VPC (no custom VPC for cost optimization)

## 📊 Monitoring & Logging

### CloudWatch Logs

- **Log Group**: `/aws/lambda/macro-ai-development-api`
- **Retention**: 1 week (cost optimization)
- **Log Level**: INFO (configurable via environment variables)

### AWS Powertools Integration

- **Service Name**: macro-ai-api
- **Metrics Namespace**: MacroAI/Hobby
- **Tracing**: Disabled by default (can be enabled for debugging)

### Monitoring Commands

```bash
# View Lambda logs
aws logs tail /aws/lambda/macro-ai-hobby-api --follow

# Check API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=macro-ai-hobby-api \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## 🚀 CI/CD Integration

### GitHub Actions Workflow

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-infrastructure.yml`) that:

1. **Validates** infrastructure code on pull requests
2. **Builds** Lambda package from Express API
3. **Deploys** infrastructure on main branch pushes
4. **Tests** deployment with health check
5. **Comments** on PRs with deployment preview information

### Workflow Configuration

Required GitHub secrets:

- `AWS_ROLE_ARN`: IAM role ARN for OIDC authentication

### Manual Deployment

For manual deployments outside of CI/CD:

```bash
# Build Lambda package first
cd apps/express-api
npm run build:lambda
npm run bundle:lambda
npm run package:lambda

# Deploy infrastructure
cd infrastructure
./scripts/deploy.sh
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Type check
npm run type-check
```

### CDK Commands

```bash
# Synthesize CloudFormation template
npm run synth

# Show differences from deployed stack
npm run diff

# Deploy stack
npm run deploy

# Destroy stack (careful!)
npm run destroy
```

## 🔍 Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**

   ```bash
   npm run bootstrap
   ```

2. **Permission Denied**
   - Ensure AWS credentials have CDK deployment permissions
   - Check IAM policies for CloudFormation, Lambda, API Gateway, and Parameter Store

3. **Parameter Not Found**
   - Update placeholder values after deployment using `./scripts/update-parameters.sh`

4. **Lambda Cold Start**
   - First request may be slower due to cold start
   - Consider implementing health check warming

### Useful Commands

```bash
# Check stack status (replace {Environment} with staging or production)
aws cloudformation describe-stacks --stack-name MacroAi{Environment}Stack

# View stack events
aws cloudformation describe-stack-events --stack-name MacroAi{Environment}Stack

# Test API endpoint
STACK_NAME="MacroAi${ENVIRONMENT}Stack"  # where ENVIRONMENT=staging or production
curl $(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)api/health

# Check Parameter Store values
aws ssm get-parameters-by-path \
  --path "/macro-ai/development" \
  --recursive \
  --query 'Parameters[*].[Name,Type,LastModifiedDate]' \
  --output table
```

## 💰 Cost Monitoring

### Expected Monthly Costs

For <100 users and <1000 requests/day:

- **Lambda**: £0.00 (within free tier)
- **API Gateway**: £0.00 (within free tier)
- **Parameter Store**: £0.05 (Advanced tier parameters)
- **CloudWatch Logs**: £0.50 (1-week retention)
- **Data Transfer**: £0.10
- **Total**: ~£0.65/month

### Cost Optimization Tips

1. **Monitor Usage**: Set up billing alerts for unexpected charges
2. **Parameter Tier**: Use Standard tier for non-critical parameters
3. **Log Retention**: Keep short retention periods for logs
4. **Throttling**: Maintain conservative rate limits
5. **Architecture**: Use ARM64 for 20% cost savings

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/)
- [Parameter Store Pricing](https://aws.amazon.com/systems-manager/pricing/)
- [Hobby Deployment Plan](./v1-0-0-hobby-deployment-plan.md)

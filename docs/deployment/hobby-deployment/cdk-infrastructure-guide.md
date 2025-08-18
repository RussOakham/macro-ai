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
│   ├── update-parameters.sh            # Parameter management script
│   └── convert-to-secure-parameters.sh # SecureString conversion script
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

### 4. Convert Parameters to SecureString (Post-Deployment)

⚠️ **Important**: Due to CloudFormation limitations, secure parameters are initially created as String type and must be
converted to SecureString after deployment.

```bash
# Convert critical parameters to SecureString type
./scripts/convert-to-secure-parameters.sh development

# Or convert all environments
./scripts/convert-to-secure-parameters.sh
```

### 5. Update Parameter Store Values

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

### ⚠️ DEPRECATED - Lambda Configuration (Removed)

> **Note**: Lambda and API Gateway configurations have been removed as part of the migration to EC2-based deployment.
> The Express API now runs on EC2 instances behind an Application Load Balancer (ALB) with Auto Scaling Groups.

### Deployment Architecture

The API Gateway deployment follows AWS CDK best practices to prevent resource conflicts:

- **Single Deployment Path**: Uses explicit deployment creation only (`deploy: false` on RestApi)
- **Resource Dependencies**: Proper dependency chain (RestApi → Deployment → Stage → Usage Plan)
- **Conflict Prevention**: Validation ensures no duplicate deployment resources
- **Update Management**: Deployment descriptions include timestamps for tracking
- **Rollback Support**: CloudFormation can safely rollback deployments without conflicts

**Key Implementation Details:**

```typescript
// RestApi with explicit deployment control
new apigateway.RestApi(this, 'RestApi', {
	deploy: false, // Prevents implicit deployment creation
	// ... other configuration
})

// Explicit deployment with proper dependencies
const deployment = new apigateway.Deployment(this, 'Deployment', {
	api: this.restApi,
	description: `Deployment for ${environmentName} - ${timestamp}`,
})

// Stage with explicit deployment reference
const stage = new apigateway.Stage(this, 'Stage', {
	deployment,
	stageName: environmentName,
})

// Set deployment stage for CDK recognition
this.restApi.deploymentStage = stage
```

This approach eliminates the "already exists in stack" errors that can occur with dual deployment creation paths.

## 🔐 Security

### IAM Permissions

The Lambda execution role includes:

- `AWSLambdaBasicExecutionRole` (managed policy)
- Custom Parameter Store read policy with path restrictions
- KMS decrypt permissions for SecureString parameters

### Parameter Store Security

- **SecureString Parameters**: Encrypted with AWS managed KMS key
- **Path-based Access**: EC2 instances can only access environment-specific parameters
- **Least Privilege**: No write permissions to Parameter Store

### Network Security

- **Application Load Balancer**: Public endpoint with CORS restrictions
- **EC2 Instances**: Run in private subnets with NAT Gateway for outbound access

## 📊 Monitoring & Logging

### CloudWatch Logs

- **Log Group**: `/var/log/macro-ai/` (on EC2 instances)
- **Retention**: Managed by log rotation on instances
- **Log Level**: INFO (configurable via environment variables)

### EC2 Monitoring Integration

- **Service Name**: macro-ai-api
- **Metrics Namespace**: MacroAI/EC2
- **CloudWatch Agent**: Enabled for system and application metrics

### Monitoring Commands

```bash
# View application logs on EC2
aws ssm start-session --target i-1234567890abcdef0
sudo tail -f /var/log/macro-ai/application.log

# Check ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name RequestCount \
  --dimensions Name=LoadBalancer,Value=app/macro-ai-alb/1234567890abcdef \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## 🚀 CI/CD Integration

### GitHub Actions Workflow (Legacy - Removed)

> **⚠️ REMOVED**: The `.github/workflows/deploy-infrastructure.yml` workflow has been
> removed as part of the Lambda-to-EC2 migration. Infrastructure deployment will be
> handled by new EC2-based workflows once the migration is complete.

### Workflow Configuration

Required GitHub secrets:

- `AWS_ROLE_ARN`: IAM role ARN for OIDC authentication

### Manual Deployment

For manual deployments outside of CI/CD:

```bash
# Build Express API application
cd apps/express-api
pnpm build

# Deploy EC2 infrastructure
cd infrastructure
./scripts/deploy-ec2.sh
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

5. **API Gateway Deployment Conflicts** ✅ RESOLVED
   - **Issue**: "already exists in stack" errors during deployment
   - **Cause**: Dual deployment creation (implicit + explicit)
   - **Solution**: Implemented in v1.0.0 - uses single explicit deployment path
   - **Prevention**: Validation ensures no duplicate deployment resources

### Deployment Conflict Resolution

If you encounter deployment resource conflicts (rare with current implementation):

```bash
# 1. Check for duplicate deployments in CloudFormation template
npm run synth | grep -A 5 -B 5 "AWS::ApiGateway::Deployment"

# 2. Verify single deployment resource exists
# Should show only one deployment resource per API

# 3. If conflicts persist, check for manual modifications
# Ensure no manual deployOptions in RestApi constructor
```

**Current Implementation Prevents:**

- Implicit deployment creation via `deployOptions`
- Multiple deployment resources for same API
- Stage name conflicts
- Resource dependency issues

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

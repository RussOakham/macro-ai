# Macro AI Infrastructure

AWS CDK infrastructure code for the Macro AI hobby deployment. This creates a cost-optimized serverless architecture
targeting <£10/month operational costs.

## Architecture Overview

The infrastructure creates:

- **AWS Lambda Function**: Serverless API backend running the Express application
- **API Gateway**: REST API for HTTP routing with CORS and throttling
- **Parameter Store**: Secure configuration management for secrets and settings
- **IAM Roles & Policies**: Least-privilege access for Lambda to Parameter Store
- **CloudWatch Logs**: Centralized logging with cost-optimized retention

## Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **Node.js 18+** installed
3. **pnpm** installed globally: `npm install -g pnpm`
4. **AWS CDK CLI** installed globally: `pnpm add -g aws-cdk`
5. **AWS Account** with CDK bootstrapped in target region

## Quick Start

### 1. Install Dependencies

```bash
cd infrastructure
pnpm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
# Set your AWS account ID and region
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"

# Bootstrap CDK
pnpm bootstrap
```

### 3. Deploy Infrastructure

```bash
# Deploy the stack
pnpm deploy

# Or with custom environment name
CDK_DEPLOY_ENV=hobby pnpm deploy
```

### 4. Update Parameter Store Values

After deployment, update the placeholder parameter values:

```bash
# Update OpenAI API key
aws ssm put-parameter \
  --name "/macro-ai/hobby/critical/openai-api-key" \
  --value "sk-your-actual-openai-key" \
  --type "SecureString" \
  --overwrite

# Update Neon database URL
aws ssm put-parameter \
  --name "/macro-ai/hobby/critical/neon-database-url" \
  --value "postgresql://user:pass@host:5432/db" \
  --type "SecureString" \
  --overwrite

# Update other parameters as needed...
```

## Configuration

### Environment Variables

- `AWS_ACCOUNT_ID` or `CDK_DEFAULT_ACCOUNT`: AWS account ID
- `AWS_REGION` or `CDK_DEFAULT_REGION`: AWS region (default: us-east-1)
- `CDK_DEPLOY_ENV`: Environment name (default: hobby)

### Custom Domain (Optional)

To use a custom domain:

```typescript
new MacroAiHobbyStack(app, 'MacroAiHobbyStack', {
	domainName: 'api.yourdomain.com',
	hostedZoneId: 'Z1234567890ABC',
	// ... other props
})
```

## Cost Optimization Features

- **ARM64 Architecture**: 20% cheaper than x86_64
- **Minimal Monitoring**: CloudWatch logs with 1-week retention
- **Conservative Throttling**: Rate limits to prevent unexpected charges
- **No Provisioned Concurrency**: Pay only for actual usage
- **Standard Parameter Tier**: For non-critical parameters

## Development

### Build and Test

```bash
# Compile TypeScript
pnpm build

# Clean build artifacts
pnpm clean

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm type-check
```

### CDK Commands

```bash
# Synthesize CloudFormation template
pnpm synth

# Show differences between deployed and local
pnpm diff

# Destroy infrastructure (careful!)
pnpm destroy
```

## Parameter Store Hierarchy

```text
/macro-ai/hobby/
├── critical/           # Advanced tier parameters
│   ├── openai-api-key
│   └── neon-database-url
└── standard/           # Standard tier parameters
    ├── upstash-redis-url
    ├── cognito-user-pool-id
    └── cognito-user-pool-client-id
```

## Security

- Lambda execution role follows least-privilege principle
- Parameter Store access restricted to specific parameter paths
- KMS encryption for SecureString parameters
- CORS configured for frontend integration

## Monitoring

Basic monitoring included:

- CloudWatch Logs for Lambda execution
- API Gateway access logs (when detailed monitoring enabled)
- AWS X-Ray tracing (when detailed monitoring enabled)

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**: Run `pnpm bootstrap` first
2. **Permission Denied**: Ensure AWS credentials have CDK deployment permissions
3. **Parameter Not Found**: Update placeholder values after deployment
4. **Lambda Cold Start**: First request may be slower due to cold start

### Useful Commands

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name MacroAiHobbyStack

# View Lambda logs
aws logs tail /aws/lambda/macro-ai-hobby-api --follow

# Test API endpoint
curl https://your-api-id.execute-api.region.amazonaws.com/hobby/api/health
```

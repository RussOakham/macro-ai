# Macro AI Infrastructure

AWS CDK infrastructure code for the Macro AI development deployment.

> **⚠️ Migration in Progress**: This infrastructure is being migrated from Lambda to EC2 deployment.
> Currently only Parameter Store configuration is active.

## Architecture Overview

The infrastructure currently creates:

- **Parameter Store**: Secure configuration management for secrets and settings
- **IAM Roles & Policies**: Least-privilege access for applications to Parameter Store

**Legacy components (removed during EC2 migration):**

- ~~AWS Lambda Function~~ (removed)
- ~~API Gateway~~ (removed)
- ~~CloudWatch Logs for Lambda~~ (removed)

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
CDK_DEPLOY_ENV=development pnpm deploy
```

### 4. Update Parameter Store Values

After deployment, update the placeholder parameter values:

```bash
# Update OpenAI API key
aws ssm put-parameter \
  --name "/macro-ai/development/critical/openai-api-key" \
  --value "sk-your-actual-openai-key" \
  --type "SecureString" \
  --overwrite

# Update Neon database URL
aws ssm put-parameter \
  --name "/macro-ai/development/critical/neon-database-url" \
  --value "postgresql://user:pass@host:5432/db" \
  --type "SecureString" \
  --overwrite

# Update other parameters as needed...
```

## Configuration

### Environment Variables

- `AWS_ACCOUNT_ID` or `CDK_DEFAULT_ACCOUNT`: AWS account ID
- `AWS_REGION` or `CDK_DEFAULT_REGION`: AWS region (default: us-east-1)
- `CDK_DEPLOY_ENV`: Environment name (default: development)

### Custom Domain (Optional)

To use a custom domain:

```typescript
new MacroAiHobbyStack(app, 'MacroAiDevelopmentStack', {
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
/macro-ai/development/
├── critical/           # Advanced tier parameters
│   ├── openai-api-key
│   ├── neon-database-url
│   └── upstash-redis-url
└── standard/           # Standard tier parameters
    ├── cognito-user-pool-id
    └── cognito-user-pool-client-id
```

## Security

- Parameter Store access restricted to specific parameter paths
- KMS encryption for SecureString parameters
- IAM roles follow least-privilege principle

## Monitoring

> **Note**: Monitoring capabilities have been reduced during the Lambda-to-EC2 migration.
> EC2-specific monitoring will be added in future phases.

Currently available:

- Parameter Store access logging via CloudTrail

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**: Run `pnpm bootstrap` first
2. **Permission Denied**: Ensure AWS credentials have CDK deployment permissions
3. **Parameter Not Found**: Update placeholder values after deployment

### Useful Commands

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name MacroAiDevelopmentStack

# View Parameter Store parameters
aws ssm get-parameters-by-path --path "/macro-ai/development" --recursive

# Note: Lambda and API Gateway commands removed during EC2 migration
```

# Macro AI Infrastructure

Pulumi-based infrastructure code for the Macro AI application deployment with ECS Fargate, Doppler secrets management, and
automated CI/CD.

## Architecture Overview

The infrastructure creates a scalable containerized deployment with:

- **ECS Fargate**: Serverless container orchestration for Express API
- **Application Load Balancer**: HTTP/HTTPS endpoint with health checks and routing
- **VPC & Networking**: Secure networking with private subnets and NAT Gateway
- **Doppler Secrets**: Secure configuration management with environment branching
- **IAM Roles & Policies**: Least-privilege access for ECS tasks
- **CloudWatch Monitoring**: Comprehensive logging, metrics, and alerting
- **Route 53**: DNS management for custom domains

## Prerequisites

1. **AWS CLI configured** with appropriate credentials and permissions
2. **Node.js 18+** installed
3. **pnpm** installed globally: `npm install -g pnpm`
4. **Pulumi CLI** installed: `brew install pulumi`
5. **Doppler CLI** installed: `brew install doppler`
6. **AWS Account** with Pulumi backend configured

## Quick Start

### 1. Install Dependencies

```bash
cd infrastructure
pnpm install
```

### 2. Login to Pulumi (First Time Only)

```bash
# Login to Pulumi Cloud (follow prompts)
pulumi login

# Or use local backend for development
pulumi login file://~/
```

### 3. Configure Doppler

```bash
# Login to Doppler
doppler login

# Setup Doppler token for CI/CD
echo "your-doppler-token" | doppler configure set token --stdin
```

### 4. Deploy Infrastructure

```bash
# Deploy to development environment
pulumi stack select dev
pulumi config set environment dev
pulumi up

# Deploy to staging environment
pulumi stack select stg
pulumi config set environment stg
pulumi up

# Deploy to production environment
pulumi stack select prod
pulumi config set environment prod
pulumi up
```

### 5. Configure Secrets in Doppler

After infrastructure deployment, configure secrets in Doppler:

```bash
# Development secrets (shared with preview environments)
doppler secrets set API_KEY "dev-api-key" --project macro-ai-dev --config dev
doppler secrets set RELATIONAL_DATABASE_URL "postgresql://..." --project macro-ai-dev --config dev
doppler secrets set REDIS_URL "redis://..." --project macro-ai-dev --config dev

# Production secrets
doppler secrets set API_KEY "prod-api-key" --project macro-ai-prod --config prod
doppler secrets set RELATIONAL_DATABASE_URL "postgresql://..." --project macro-ai-prod --config prod
doppler secrets set REDIS_URL "redis://..." --project macro-ai-prod --config prod
```

## Configuration

### Environment Variables

- `PULUMI_CONFIG_PASSPHRASE`: Encryption passphrase for Pulumi state
- `AWS_REGION`: AWS region (default: us-east-1)
- `AWS_PROFILE`: AWS profile to use

### Stack Configuration

Each environment has its own Pulumi stack configuration:

```yaml
# Pulumi.dev.yaml
config:
  macro-ai-infrastructure:environment: dev
  macro-ai-infrastructure:vpcCidr: '10.0.0.0/16'
  macro-ai-infrastructure:domainName: 'dev.macro-ai.com'
```

## Cost Optimization Features

- **Fargate Spot**: Cost-effective compute for non-critical workloads
- **Auto Scaling**: Scale based on CPU/memory utilization
- **ARM64 Graviton2**: 20% cost savings over x86_64 instances
- **Optimized Storage**: Efficient EBS storage configurations
- **Monitoring Optimization**: Selective CloudWatch metrics and log retention

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

### Pulumi Commands

```bash
# Preview infrastructure changes
pulumi preview

# Deploy infrastructure changes
pulumi up

# Show current stack configuration
pulumi config

# Destroy infrastructure (careful!)
pulumi destroy
```

### Stack Management

```bash
# List available stacks
pulumi stack ls

# Select specific stack
pulumi stack select dev

# Show stack outputs
pulumi stack output

# Export stack state (for backup)
pulumi stack export > stack-backup.json
```

## Secrets Management with Doppler

### Project Structure

```text
macro-ai-dev/          # Development project
├── dev/              # Development config (shared with preview environments)
├── staging/          # Staging config
└── prod/             # Production config

macro-ai-staging/      # Staging project
└── staging/          # Staging-specific config

macro-ai-prod/         # Production project
└── prod/             # Production-specific config
```

### Secret Categories

1. **API Configuration**: API keys, encryption keys, service credentials
2. **Database**: Connection strings, credentials, SSL certificates
3. **External Services**: Third-party API keys, OAuth credentials
4. **Environment**: Environment-specific configuration values

### Doppler CLI Usage

```bash
# Set a secret
doppler secrets set API_KEY "your-key" --project macro-ai-dev --config dev

# Get a secret value
doppler secrets get API_KEY --project macro-ai-dev --config dev

# List all secrets in a config
doppler secrets --project macro-ai-dev --config dev

# Download secrets as environment file
doppler secrets download --project macro-ai-dev --config dev --format env > .env
```

## Security

- **Doppler Secrets**: Encrypted at rest and in transit
- **IAM Roles**: Least-privilege access for ECS tasks
- **VPC Security**: Private subnets with security groups
- **KMS Encryption**: All sensitive data encrypted with AWS KMS

## Monitoring

### CloudWatch Integration

- **ECS Metrics**: CPU, memory, task count monitoring
- **Load Balancer**: Request count, error rates, latency
- **Custom Metrics**: Application-specific business metrics
- **Log Aggregation**: Centralized logging with retention policies

### Health Checks

- **Application Health**: `/health` endpoint monitoring
- **Database Connectivity**: Connection pool health checks
- **External Services**: Third-party service availability

## Troubleshooting

### Common Issues

1. **Pulumi Backend**: Ensure you're logged into the correct Pulumi backend
2. **AWS Permissions**: Verify IAM roles have required permissions
3. **Doppler Access**: Check Doppler token and project access
4. **Network Issues**: Verify VPC and security group configurations

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster macro-ai-dev --services macro-ai-dev-service

# View CloudWatch logs
aws logs tail /aws/ecs/macro-ai-dev --follow

# Check Doppler secret access
doppler run --project macro-ai-dev --config dev -- echo "API_KEY: $API_KEY"

# Verify load balancer health
aws elbv2 describe-target-health --load-balancer-arn <load-balancer-arn>
```

## Related Documentation

- **[AWS Deployment](../docs/deployment/aws-deployment.md)** - Infrastructure architecture and strategies
- **[Environment Setup](../docs/deployment/environment-setup.md)** - Environment configuration and secrets
- **[CI/CD Pipeline](../docs/deployment/ci-cd-pipeline.md)** - Automated deployment workflows

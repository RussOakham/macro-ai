# EC2 Deployment Utilities

## Overview

This document describes the comprehensive EC2 deployment utilities for the Macro AI infrastructure. These utilities provide
automated deployment, management, and monitoring capabilities for EC2-based preview environments.

## Components

### 1. EC2 Deployment Utilities Class (`src/utils/ec2-deployment.ts`)

A TypeScript class that provides programmatic access to EC2 deployment operations:

- Instance creation and management
- Application artifact deployment
- Health check monitoring
- Target group registration
- Deployment status tracking
- Cleanup operations

### 2. CLI Deployment Tool (`scripts/deploy-ec2.ts`)

A command-line interface for manual deployments and CI/CD integration:

- Deploy applications to EC2 instances
- Check deployment status
- Clean up PR environments
- Health check infrastructure

### 3. GitHub Actions Integration Script (`scripts/github-actions-deploy.sh`)

A bash script optimized for GitHub Actions workflows:

- Automated build and artifact upload
- Environment validation
- Deployment execution
- Health monitoring
- Output generation for workflow integration

## Usage

### CLI Tool Usage

#### Deploy Application

```bash
# Using pnpm script (recommended)
pnpm deploy-ec2 deploy \
  --pr 123 \
  --artifact s3://my-bucket/artifacts/app-v1.0.0.tar.gz \
  --version 1.0.0 \
  --branch feature/new-feature \
  --instances 2

# Using pnpm script (recommended)
pnpm run deploy-ec2 -- deploy \
  --pr 123 \
  --artifact s3://my-bucket/artifacts/app-v1.0.0.tar.gz \
  --version 1.0.0 \
  --branch feature/new-feature \
  --instances 2

# Using tsx directly
tsx infrastructure/scripts/deploy-ec2.ts deploy \
  --pr 123 \
  --artifact s3://my-bucket/artifacts/app-v1.0.0.tar.gz \
  --version 1.0.0 \
  --branch feature/new-feature \
  --instances 2

# Using ts-node
ts-node infrastructure/scripts/deploy-ec2.ts deploy \
  --pr 123 \
  --artifact s3://my-bucket/artifacts/app-v1.0.0.tar.gz \
  --version 1.0.0 \
  --branch feature/new-feature \
  --instances 2
```

#### Check Deployment Status

```bash
# Check status of a PR deployment
pnpm deploy-ec2 status --pr 123
```

#### Clean Up Environment

```bash
# Clean up all resources for a PR
pnpm deploy-ec2 cleanup --pr 123 --force
```

#### Health Check

```bash
# Verify infrastructure configuration
pnpm deploy-ec2 health
```

### GitHub Actions Integration

#### Environment Variables

Set these environment variables in your GitHub Actions workflow:

```yaml
env:
  # Required
  PR_NUMBER: ${{ github.event.number }}
  VERSION: ${{ github.sha }}
  AWS_REGION: us-east-1
  VPC_ID: vpc-xxxxxxxxx
  SUBNET_IDS: subnet-xxxxxxxx,subnet-yyyyyyyy
  SECURITY_GROUP_ID: sg-xxxxxxxxx
  LAUNCH_TEMPLATE_ID: lt-xxxxxxxxx
  TARGET_GROUP_ARN: arn:aws:elasticloadbalancing:...
  APP_ENV: development
  ARTIFACT_BUCKET: my-deployment-bucket

  # Optional
  BRANCH_NAME: ${{ github.head_ref }}
  ENVIRONMENT: development
  INSTANCE_COUNT: 1
  TIMEOUT_MINUTES: 15
```

#### Workflow Step

```yaml
- name: Deploy to EC2
  run: |
    cd infrastructure
    ./scripts/github-actions-deploy.sh deploy
```

### Programmatic Usage

```typescript
import { Ec2DeploymentUtilities } from './src/utils/ec2-deployment.js'

const deployment = new Ec2DeploymentUtilities('us-east-1')

const config = {
	prNumber: 123,
	branch: 'feature/new-feature',
	artifactBucket: 'my-bucket',
	artifactKey: 'artifacts/app-v1.0.0.tar.gz',
	version: '1.0.0',
	environment: 'development',
	appEnv: 'development',
	vpcId: 'vpc-xxxxxxxxx',
	subnetIds: ['subnet-xxxxxxxx', 'subnet-yyyyyyyy'],
	securityGroupId: 'sg-xxxxxxxxx',
	launchTemplateId: 'lt-xxxxxxxxx',
	targetGroupArn: 'arn:aws:elasticloadbalancing:...',
	desiredInstances: 2,
}

const result = await deployment.deployPrEnvironment(config)
console.log('Deployment result:', result)
```

## Configuration

### Required Environment Variables

| Variable             | Description                     | Example                            |
| -------------------- | ------------------------------- | ---------------------------------- |
| `PR_NUMBER`          | Pull request number             | `123`                              |
| `ARTIFACT_URL`       | S3 URL for application artifact | `s3://bucket/key`                  |
| `VERSION`            | Deployment version              | `1.0.0`                            |
| `AWS_REGION`         | AWS region                      | `us-east-1`                        |
| `VPC_ID`             | VPC ID for deployment           | `vpc-xxxxxxxxx`                    |
| `SUBNET_IDS`         | Comma-separated subnet IDs      | `subnet-xxx,subnet-yyy`            |
| `SECURITY_GROUP_ID`  | Security group ID               | `sg-xxxxxxxxx`                     |
| `LAUNCH_TEMPLATE_ID` | EC2 launch template ID          | `lt-xxxxxxxxx`                     |
| `TARGET_GROUP_ARN`   | ALB target group ARN            | `arn:aws:elasticloadbalancing:...` |
| `APP_ENV`            | Application environment         | `development`                      |
| `ARTIFACT_BUCKET`    | S3 bucket for artifacts         | `my-deployment-bucket`             |

### Optional Environment Variables

| Variable          | Description         | Default       |
| ----------------- | ------------------- | ------------- |
| `BRANCH_NAME`     | Git branch name     | `unknown`     |
| `ENVIRONMENT`     | Environment name    | `development` |
| `INSTANCE_COUNT`  | Number of instances | `1`           |
| `TIMEOUT_MINUTES` | Deployment timeout  | `15`          |

## Deployment Process

### 1. Artifact Preparation

- Build application using standard Express build process
- Create deployment package (tar.gz)
- Upload to S3 artifact bucket
- Generate artifact URL for deployment

### 2. Instance Management

- Check for existing instances for the PR
- Terminate old instances (blue-green deployment)
- Create new instances using launch template
- Apply PR-specific tags and configuration

### 3. Application Deployment

- Generate user data with deployment configuration
- Download artifact from S3 to instances
- Extract and deploy application
- Configure environment variables

### 4. Service Registration

- Register instances with ALB target group
- Configure health check endpoints
- Wait for instances to pass health checks
- Verify application availability

### 5. Health Monitoring

- Monitor instance status
- Check application health endpoints
- Validate target group health
- Report deployment status

## Features

### Blue-Green Deployment

- Terminates old instances before creating new ones
- Ensures zero-downtime deployments
- Maintains consistent environment state

### Health Check Integration

- Integrates with ALB health checks
- Monitors application `/api/health` endpoint
- Provides comprehensive status reporting
- Automatic failure detection and reporting

### Cost Optimization

- Automatic instance tagging for cost tracking
- Support for auto-shutdown scheduling
- Efficient resource cleanup
- Instance count optimization

### Security Features

- Uses existing security groups and IAM roles
- Secure artifact handling via S3
- Environment variable encryption
- Network isolation through VPC

### Monitoring and Logging

- CloudWatch integration for metrics and logs
- Deployment status tracking
- Comprehensive error reporting
- Audit trail through tags and logs

## Error Handling

### Common Issues

#### Deployment Timeout

```bash
# Check instance status
aws ec2 describe-instances --instance-ids i-xxxxxxxxx

# Check user data logs
aws ssm start-session --target i-xxxxxxxxx
sudo tail -f /var/log/user-data.log
```

#### Health Check Failures

```bash
# Check application logs
aws ssm start-session --target i-xxxxxxxxx
sudo journalctl -u macro-ai.service -f

# Test health endpoint directly
curl http://instance-ip:3030/api/health
```

#### Artifact Download Issues

```bash
# Check S3 permissions
aws s3 ls s3://bucket/path/

# Verify instance IAM role
aws sts get-caller-identity
```

### Troubleshooting Commands

```bash
# Get deployment status (using pnpm script)
pnpm deploy-ec2 status --pr 123

# Using tsx directly
tsx infrastructure/scripts/deploy-ec2.ts status --pr 123

# Check infrastructure health
pnpm deploy-ec2 health
# OR: tsx infrastructure/scripts/deploy-ec2.ts health

# Force cleanup if needed
pnpm deploy-ec2 cleanup --pr 123 --force
# OR: tsx infrastructure/scripts/deploy-ec2.ts cleanup --pr 123 --force

# Check AWS resources
aws ec2 describe-instances --filters "Name=tag:PRNumber,Values=123"
aws elbv2 describe-target-health --target-group-arn arn:aws:...
```

## Integration with CI/CD

### GitHub Actions Workflow Example

```yaml
name: Deploy Preview Environment

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to EC2
        env:
          PR_NUMBER: ${{ github.event.number }}
          VERSION: ${{ github.sha }}
          BRANCH_NAME: ${{ github.head_ref }}
          # ... other environment variables
        run: |
          cd infrastructure
          ./scripts/github-actions-deploy.sh deploy

      - name: Comment PR with deployment info
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview environment deployed! Check the deployment status in the Actions tab.'
            })
```

## Best Practices

### Security

- Use IAM roles instead of access keys
- Encrypt sensitive environment variables
- Implement least-privilege access policies
- Regular security audits of deployment scripts

### Performance

- Use appropriate instance types for workload
- Implement efficient artifact caching
- Monitor deployment times and optimize
- Use multiple availability zones for resilience

### Cost Management

- Implement automatic cleanup schedules
- Monitor instance usage and costs
- Use spot instances for development environments
- Regular cost analysis and optimization

### Monitoring

- Set up CloudWatch alarms for deployment failures
- Monitor application performance metrics
- Implement comprehensive logging
- Regular health check validation

This comprehensive deployment utility system provides a robust foundation for automated EC2-based application deployment
with production-ready features including security, monitoring, cost optimization, and error handling.

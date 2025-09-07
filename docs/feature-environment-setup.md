# Feature Environment Setup

## Overview

Feature environments provide isolated, ephemeral infrastructure for developing and testing new features.

They follow the same architecture as preview environments but are designed for longer-term feature development.

(up to 14 days).

## Architecture

### Infrastructure Components

- **ECS Fargate Service**: Minimal compute (512MB RAM, 256 CPU)
- **Application Load Balancer**: HTTPS with custom domain
- **Neon Database Branch**: Auto-branched from staging
- **Upstash Redis**: Free tier for caching and rate limiting
- **CloudWatch Logs**: Basic monitoring and logging

### Branching Strategy

```text
Production (main-production-branch)
├── Staging (auto-branch-from-production)
│   ├── Feature Branches (feature/branch-name)
│   │   ├── feature/user-auth
│   │   ├── feature/payment-flow
│   │   └── feature/dashboard
│   └── Preview Branches (preview/pr-{number})
```

## Environment Configuration

### Database Branching

Feature environments use Neon database branches that are automatically created from the staging branch:

```typescript
// Environment-specific branches
const branches = {
	production: 'main-production-branch',
	staging: 'auto-branch-from-production',
	feature: 'feature/{branch-name}', // Auto-branched from staging
}
```

### Cost Optimization

- **Minimal Resources**: Single ECS task with 512MB RAM
- **Auto-scaling**: 1-2 tasks based on CPU utilization
- **Auto-cleanup**: 14-day expiry with automatic resource deletion
- **Free Tiers**: Neon and Upstash provide free tiers for development

## Deployment Process

### Manual Deployment

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   git push origin feature/your-feature-name
   ```

2. **Deploy Feature Environment**

   ```bash
   cd infrastructure
   FEATURE_BRANCH_NAME=feature/your-feature-name \
   ./scripts/deploy-feature-environment.sh
   ```

3. **Verify Deployment**

   ```bash
   tsx scripts/verify-feature-environment.ts
   ```

### Automated Deployment (Future)

Feature environments will be automatically deployed via GitHub Actions when:

- Pushing to a `feature/*` branch
- Creating a pull request from a feature branch

## Environment Variables

Create a `.env.feature` file based on the example:

```bash
# Copy the example file
cp apps/express-api/config/examples/env.feature.example \
   apps/express-api/config/examples/env.feature

# Edit with your specific values
# RELATIONAL_DATABASE_URL will be configured automatically
# REDIS_URL will use Upstash free tier
```

## Monitoring and Cleanup

### Automatic Cleanup

Feature environments are automatically cleaned up after 14 days to prevent cost accumulation:

- **Expiry Date**: Calculated from deployment date
- **Auto-shutdown**: Scheduled resource termination
- **Cost Alerts**: Notifications when approaching expiry

### Manual Cleanup

To manually clean up a feature environment:

```bash
cd infrastructure
# Destroy the feature environment stack
cdk destroy "MacroAiFeature${FEATURE_NAME}Stack"
```

## Testing and Validation

### Health Checks

Feature environments include automated health checks:

- **API Health**: `/health` endpoint monitoring
- **Database Connectivity**: Neon branch connection validation
- **Redis Connectivity**: Upstash connection validation

### Load Testing

For performance validation:

```bash
# Test with artillery or similar load testing tools
npm install -g artillery
artillery quick --count 10 --num 5 https://feature-your-name.macro-ai.russoakham.dev/health
```

## Security Considerations

### Network Security

- **VPC Isolation**: All resources within private VPC
- **Security Groups**: Minimal required ports only
- **HTTPS Only**: SSL/TLS encryption required

### Access Control

- **Environment Variables**: Sensitive data via SSM Parameter Store
- **IAM Roles**: Least-privilege access policies
- **Branch Protection**: Neon branches inherit parent permissions

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify Neon branch exists: Check Neon console
   - Validate connection string: Use verification script
   - Check network connectivity: VPC and security groups

2. **Redis Connection Failed**
   - Verify Upstash configuration
   - Check Redis URL format
   - Validate network access

3. **Deployment Failed**
   - Check AWS credentials and permissions
   - Verify CDK context parameters
   - Review CloudFormation stack events

### Debug Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster macro-ai-feature-{name} --services macro-ai-feature-{name}

# View application logs
aws logs tail /ecs/macro-ai-feature-{name} --follow

# Check load balancer health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

## Next Steps

After feature development and testing:

1. **Create Pull Request**: Merge feature branch to `develop`
2. **Staging Deployment**: Automatic deployment to staging environment
3. **Integration Testing**: Validate with other features
4. **Production Deployment**: Manual deployment to production after approval

## Cost Estimation

- **Monthly Cost**: £5-15 per feature environment
- **Daily Cost**: £0.15-0.50 (when active)
- **Free Tier Usage**: Neon (512MB) + Upstash (30MB) covers most development needs
- **Auto-shutdown Savings**: ~70% cost reduction with scheduled shutdowns

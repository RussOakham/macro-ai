# Rollback Procedures for Macro AI Infrastructure

## Overview

This document outlines the rollback procedures for the Macro AI infrastructure across all
environments (production, staging, feature). The system provides multiple layers of rollback
capabilities:

1. **Automated Rollback**: GitHub Actions workflows that automatically detect and rollback failed deployments
2. **Manual Rollback**: Scripts and procedures for manual rollback when automated systems fail
3. **Emergency Rollback**: Quick rollback procedures for critical situations

## Table of Contents

- [Automated Rollback System](#automated-rollback-system)
- [Manual Rollback Procedures](#manual-rollback-procedures)
- [Emergency Rollback Procedures](#emergency-rollback-procedures)
- [Database Rollback Procedures](#database-rollback-procedures)
- [Rollback Verification](#rollback-verification)
- [Troubleshooting](#troubleshooting)

## Automated Rollback System

### Trigger Conditions

The automated rollback system is triggered by:

1. **Deployment Failures**: When any deployment workflow fails
2. **Health Check Failures**: When post-deployment health checks fail
3. **Manual Triggers**: Via workflow dispatch for proactive rollbacks

### Rollback Types

#### Service Rollback

- **Scope**: ECS service and task definition only
- **Duration**: 2-5 minutes
- **Impact**: Minimal downtime, database unchanged
- **Use Case**: Application code issues, configuration problems

#### Database Rollback

- **Scope**: Database schema and data changes
- **Duration**: 5-15 minutes
- **Impact**: Requires application restart
- **Use Case**: Migration failures, data corruption

#### Full Rollback

- **Scope**: Both service and database
- **Duration**: 10-20 minutes
- **Impact**: Moderate downtime
- **Use Case**: Complex deployment issues affecting both app and data

#### Emergency Rollback

- **Scope**: Immediate service restoration
- **Duration**: 1-2 minutes
- **Impact**: Minimal safety checks
- **Use Case**: Critical system failures

### Safety Mechanisms

1. **Version Verification**: Ensures rollback target version exists in ECR
2. **Database Compatibility**: Checks migration compatibility
3. **Health Validation**: Post-rollback health checks
4. **Approval Gates**: Manual approval for high-risk rollbacks
5. **Monitoring Integration**: Real-time status updates and alerting

## Manual Rollback Procedures

### Using the Rollback Helper Script

The `rollback-helper.sh` script provides comprehensive manual rollback capabilities:

```bash
# Basic service rollback
./infrastructure/scripts/rollback-helper.sh production service

# Rollback to specific version
./infrastructure/scripts/rollback-helper.sh staging service --target-version v1.2.3

# Full rollback with force flag
./infrastructure/scripts/rollback-helper.sh production full --force

# Dry run to see what would happen
./infrastructure/scripts/rollback-helper.sh feature emergency --dry-run
```

### Step-by-Step Manual Rollback

#### Step 1: Assess the Situation

```bash
# Check current deployment status
aws ecs describe-services \
  --cluster macro-ai-production-cluster \
  --services macro-ai-production-service

# Check CloudWatch logs for errors
aws logs tail /aws/ecs/macro-ai-production \
  --follow \
  --since 1h
```

#### Step 2: Identify Rollback Target

```bash
# List available versions in ECR
aws ecr describe-images \
  --repository-name macro-ai-express-api \
  --query 'sort_by(imageDetails,&imagePushedAt)[].imageTags[0]' \
  --output text
```

#### Step 3: Execute Rollback

```bash
# For production service rollback
./infrastructure/scripts/rollback-helper.sh production service --target-version v1.2.3

# Monitor the rollback progress
aws ecs describe-services \
  --cluster macro-ai-production-cluster \
  --services macro-ai-production-service \
  --query 'services[0].deployments'
```

#### Step 4: Verify Rollback Success

```bash
# Check service health
curl -f https://api.macro-ai.com/health

# Verify application functionality
curl -f https://api.macro-ai.com/api/status
```

## Emergency Rollback Procedures

### When to Use Emergency Rollback

- **Critical system outage** affecting all users
- **Security vulnerability** requiring immediate mitigation
- **Automated rollback failure** requiring manual intervention
- **Data corruption** detected in production

### Emergency Rollback Steps

#### Immediate Actions (0-2 minutes)

```bash
# Emergency service rollback - bypasses safety checks
./infrastructure/scripts/rollback-helper.sh production emergency --force

# Quick health check
curl -f https://api.macro-ai.com/health || echo "Service not responding"
```

#### Escalation Actions (2-5 minutes)

```bash
# If emergency rollback fails, scale down to zero
aws ecs update-service \
  --cluster macro-ai-production-cluster \
  --service macro-ai-production-service \
  --desired-count 0

# Deploy last known good configuration
aws ecs update-service \
  --cluster macro-ai-production-cluster \
  --service macro-ai-production-service \
  --task-definition macro-ai-production-task:last-known-good \
  --desired-count 2
```

#### Recovery Actions (5-15 minutes)

```bash
# Full system restoration
./infrastructure/scripts/rollback-helper.sh production full --target-version last-stable

# Database consistency check
# Run database verification scripts
pnpm run verify:environment-connections
```

## Database Rollback Procedures

### Neon Database Branching Rollback

Since we're using Neon's branching system, database rollbacks follow this hierarchy:

```text
main-production-branch (Production)
└── auto-branch-from-production (Staging)
    └── auto-branch-from-staging (Feature branches)
```

#### Rollback Scenarios

1. **Feature Branch Issues**

   ```bash
   # Delete problematic feature branch
   curl -X DELETE https://api.neon.tech/v2/projects/{project_id}/branches/preview-pr-{number} \
     -H "Authorization: Bearer {token}"
   ```

2. **Staging Issues**

   ```bash
   # Reset staging branch from production
   curl -X PATCH https://api.neon.tech/v2/projects/{project_id}/branches/auto-branch-from-production \
     -H "Authorization: Bearer {token}" \
     -d '{"reset_from": "main-production-branch"}'
   ```

3. **Production Issues**

   ```bash
   # Create emergency branch from last good state
   # Use Neon dashboard or API to create point-in-time recovery
   ```

### Migration Rollback

For schema changes that need to be rolled back:

```bash
# Set database connection to target environment
export NEON_BRANCH_NAME="main-production-branch"
export APP_ENV="production"

# Run down migrations (if available)
cd apps/express-api
pnpm run db:migrate:down

# Verify database integrity
pnpm run db:verify
```

## Rollback Verification

### Health Checks

#### Application Health

```bash
# API health endpoint
curl -f https://api.macro-ai.com/health

# Application-specific endpoints
curl -f https://api.macro-ai.com/api/status
curl -f https://api.macro-ai.com/api/ping
```

#### Infrastructure Health

```bash
# ECS service status
aws ecs describe-services \
  --cluster macro-ai-production-cluster \
  --services macro-ai-production-service \
  --query 'services[0].{status:status,runningCount:runningCount,desiredCount:desiredCount}'

# ALB health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/macro-ai-production/123456789
```

#### Database Health

```bash
# Neon database connectivity
curl -f https://api.neon.tech/v2/projects/{project_id}/branches/main-production-branch

# Database query test
psql "postgresql://user:password@ep-xyz.us-east-1.aws.neon.tech/neondb" -c "SELECT version();"
```

### Performance Verification

```bash
# Response time checks
curl -o /dev/null -s -w "%{time_total}\n" https://api.macro-ai.com/health

# Error rate monitoring
aws logs filter-log-events \
  --log-group-name /aws/ecs/macro-ai-production \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '5 minutes ago' +%s)000
```

## Monitoring and Alerting

### Rollback Events

All rollback events are tracked and reported:

1. **GitHub Issues**: Automatic issue creation with detailed rollback reports
2. **Commit Status**: Real-time status updates on GitHub commits
3. **CloudWatch Events**: Infrastructure metrics and alerts
4. **Neon Monitoring**: Database performance and connectivity alerts

### Key Metrics to Monitor

- **Deployment Success Rate**: Percentage of successful deployments
- **Rollback Frequency**: How often rollbacks are needed
- **Mean Time to Recovery (MTTR)**: Time from failure to recovery
- **Service Availability**: Uptime percentage during rollbacks

## Troubleshooting

### Common Issues

#### Rollback Fails Due to ECR Image Not Found

```bash
# Check available images
aws ecr describe-images --repository-name macro-ai-express-api

# If no images available, rebuild and push
cd apps/express-api
pnpm run docker:build
pnpm run docker:push
```

#### Database Connection Issues After Rollback

```bash
# Verify Neon branch exists
curl https://api.neon.tech/v2/projects/{project_id}/branches

# Reset database connection
export NEON_BRANCH_NAME="main-production-branch"
pnpm run db:reset-connection
```

#### ECS Service Stuck in Rollback

```bash
# Force service update
aws ecs update-service \
  --cluster macro-ai-production-cluster \
  --service macro-ai-production-service \
  --force-new-deployment

# Check service events
aws ecs describe-services \
  --cluster macro-ai-production-cluster \
  --services macro-ai-production-service \
  --query 'services[0].events[0:5]'
```

### Recovery Procedures

#### Complete System Recovery

```bash
# 1. Stop problematic service
aws ecs update-service --cluster macro-ai-production-cluster \
  --service macro-ai-production-service --desired-count 0

# 2. Clean up resources
aws ecs delete-service --cluster macro-ai-production-cluster \
  --service macro-ai-production-service

# 3. Redeploy from scratch
cd infrastructure
cdk deploy MacroAiProductionStack

# 4. Verify deployment
curl -f https://api.macro-ai.com/health
```

### Escalation Path

1. **Level 1**: Automated rollback systems
2. **Level 2**: Manual rollback scripts
3. **Level 3**: Infrastructure team intervention
4. **Level 4**: Emergency procedures and stakeholder notification
5. **Level 5**: Complete system rebuild if necessary

## Best Practices

### Prevention

- **Comprehensive Testing**: Thorough testing before production deployment
- **Gradual Rollouts**: Use feature flags and canary deployments
- **Monitoring**: Implement comprehensive monitoring and alerting
- **Backup Strategy**: Regular database backups and environment snapshots

### Preparation

- **Rollback Plans**: Document rollback procedures for each deployment type
- **Test Rollbacks**: Regularly test rollback procedures in staging
- **Tool Maintenance**: Keep rollback scripts and tools updated
- **Access Control**: Limit access to rollback capabilities

### Execution

- **Quick Assessment**: Rapid assessment of failure impact and rollback needs
- **Clear Communication**: Keep stakeholders informed during rollback process
- **Documentation**: Record all rollback actions and outcomes
- **Post-Mortem**: Conduct post-mortem analysis after rollbacks

### Continuous Improvement

- **Metrics Tracking**: Track rollback success rates and times
- **Process Refinement**: Regularly update rollback procedures based on experience
- **Training**: Ensure team members are familiar with rollback procedures
- **Automation**: Increase automation to reduce manual intervention needs

---

_This document is part of the Macro AI infrastructure documentation suite. For questions or
updates, please refer to the infrastructure team or create an issue in the project repository._

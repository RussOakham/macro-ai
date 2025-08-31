# CI/CD Deployment Troubleshooting Guide

## Issue: CI Deployment Timeouts During Health Checks

### Problem Description

GitHub Actions deployments were timing out during the health checking phase, appearing to hang indefinitely while waiting
for deployment validation.

### Root Cause Analysis

The issue was caused by **missing AWS IAM permissions** in the GitHub Actions role. The deployment script was calling AWS
APIs for health checking, but the IAM policy didn't include the required permissions:

1. **Script Location**: `infrastructure/scripts/deploy-ecs-preview.sh`
2. **Health Check Functions**: 3-phase AWS API-driven validation
3. **Missing Permissions**: ECS, Application Load Balancer, and CloudWatch describe operations

### Required AWS Permissions

The health checking script requires these AWS API permissions:

```json
{
	"Sid": "ECSHealthCheckPermissions",
	"Effect": "Allow",
	"Action": [
		"ecs:DescribeServices",
		"ecs:DescribeTasks",
		"ecs:ListTasks",
		"elasticloadbalancing:DescribeTargetHealth",
		"elasticloadbalancing:DescribeTargetGroups",
		"cloudwatch:GetMetricStatistics"
	],
	"Resource": "*"
}
```

### Health Check Process

The deployment script performs 3-phase health validation:

1. **Phase 1 (5 min)**: `ecs:DescribeServices`
   - Monitor ECS service reaching 'ACTIVE' state
   - Check desired count vs running count
   - 15-second intervals with detailed service state reporting

2. **Phase 2 (15 min)**: `ecs:DescribeTasks`
   - Check ECS task status and health
   - Wait for tasks to reach 'RUNNING' state
   - Monitor task health status via load balancer
   - 30-second intervals with per-task status tracking

3. **Phase 3 (10 min)**: `elasticloadbalancing:DescribeTargetHealth`
   - Monitor target health via describe-target-health API
   - Wait for all targets to be 'healthy' in Application Load Balancer
   - Detailed unhealthy target troubleshooting information

### Symptoms

- CI deployment appears to hang during "Verifying deployment health..." step
- No error messages in GitHub Actions logs
- AWS CLI commands fail silently with access denied errors
- Deployment times out after GitHub Actions job limit (typically 6 hours)

### Resolution

1. **Updated IAM Policy**: Added `ECSHealthCheckPermissions` to `infrastructure/iam-policies/enhanced-github-actions-policy.json`
2. **Policy Location**: The policy is applied to the GitHub Actions OIDC role
3. **Immediate Effect**: Changes take effect on next deployment

### Prevention

- Always verify IAM permissions when adding new AWS API calls to deployment scripts
- Test deployment scripts locally with appropriate AWS credentials
- Monitor CloudTrail for access denied errors during CI runs
- Include permission requirements in script documentation

### Related Files

- `infrastructure/iam-policies/enhanced-github-actions-policy.json` - IAM permissions
- `infrastructure/scripts/deploy-ecs-preview.sh` - Deployment script with health checks
- `.github/workflows/deploy-preview.yml` - GitHub Actions workflow

### Verification

After applying the fix, successful deployments will show detailed progress logs:

```bash
🚀 Starting robust ECS deployment health check with progressive timeout stages...
📋 Extracting deployment configuration from stack: MacroAiPr-37Stack
✅ Found ECS Service: macro-ai-preview-service
✅ Environment: pr-37
✅ Found target group: arn:aws:elasticloadbalancing:...

🔄 Phase 1: Waiting for ECS service to reach active state (timeout: 300s)...
📊 Phase 1 - Attempt 1/20: Checking service state...
📋 Service Status: ACTIVE
📈 Task Count: 1 desired, 1 running
✅ Phase 1 complete: ECS service is active with desired task count!

🔄 Phase 2: Waiting for ECS tasks to reach running state (timeout: 900s)...
📊 Phase 2 - Attempt 1/30: Checking task states...
📋 Found 1 task(s): arn:aws:ecs:...
📈 Task states: 1 running, 0 pending, 0 other
✅ Phase 2 complete: All 1 task(s) are running!

🔄 Phase 3: Waiting for load balancer targets to be healthy (timeout: 600s)...
📊 Phase 3 - Attempt 1/20: Checking target health...
📋 Target health: 1 healthy, 0 unhealthy
✅ Phase 3 complete: All targets are healthy!
```

This provides much better visibility into the ECS deployment process and eliminates silent permission failures.

## Issue: ECS Service Scaling Failures

### Problem Description

ECS services fail to scale up or down during deployment, causing deployment timeouts or service unavailability.

### Root Cause Analysis

Common causes include:

1. **Insufficient CPU/Memory**: Task definition requests more resources than available
2. **IAM Role Issues**: ECS tasks lack permissions to access required services
3. **Load Balancer Issues**: Target group health checks failing
4. **VPC Configuration**: Network configuration preventing task communication

### Resolution Steps

1. **Check ECS Service Events**:

   ```bash
   aws ecs describe-services \
     --cluster macro-ai-preview-cluster \
     --services macro-ai-preview-service
   ```

2. **Verify Task Definition**:

   ```bash
   aws ecs describe-task-definition \
     --task-definition macro-ai-preview-task-def
   ```

3. **Check Load Balancer Health**:

   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn arn:aws:elasticloadbalancing:...
   ```

4. **Review CloudWatch Logs**:

   ```bash
   aws logs tail /ecs/macro-ai-preview --follow
   ```

## Issue: Container Health Check Failures

### Problem Description

ECS tasks start but fail health checks, causing them to be terminated and restarted repeatedly.

### Common Causes

1. **Application Not Ready**: Container starts but application takes time to initialize
2. **Health Check Endpoint**: Incorrect health check URL or port
3. **Dependencies**: Database or external service not available
4. **Resource Constraints**: Insufficient CPU/memory causing slow startup

### Resolution

1. **Adjust Health Check Grace Period**:

   ```typescript
   const service = new ecs.FargateService(this, 'ApiService', {
   	healthCheckGracePeriod: Duration.seconds(60), // Increase grace period
   	// ... other configuration
   })
   ```

2. **Verify Health Check Endpoint**:
   - Ensure `/health` endpoint responds quickly
   - Check application logs for startup issues
   - Verify all dependencies are available

3. **Monitor Resource Usage**:
   - Check CloudWatch metrics for CPU/memory
   - Ensure task definition has adequate resources
   - Consider increasing task resources if needed

## Issue: Environment Variable Configuration

### Problem Description

ECS tasks fail to start due to missing or incorrect environment variables.

### Resolution

1. **Verify Parameter Store Integration**:

   ```bash
   aws ssm get-parameter \
     --name "/development/database-url" \
     --with-decryption
   ```

2. **Check ECS Task Environment**:

   ```bash
   aws ecs describe-tasks \
     --cluster macro-ai-preview-cluster \
     --tasks <task-arn>
   ```

3. **Validate Environment Configuration**:
   - Ensure all required environment variables are defined
   - Verify Parameter Store permissions for ECS task role
   - Check environment variable mapping in CDK

## Issue: Load Balancer Routing Failures

### Problem Description

Requests to the load balancer fail to reach ECS tasks, resulting in 502/503 errors.

### Resolution

1. **Check Target Group Health**:

   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn <target-group-arn>
   ```

2. **Verify Security Group Rules**:
   - Ensure ECS tasks can receive traffic from ALB
   - Check VPC security group configurations
   - Verify network ACLs allow traffic

3. **Check Application Port**:
   - Ensure container exposes correct port
   - Verify port mapping in task definition
   - Check load balancer listener configuration

## Issue: ECS Task Logging

### Problem Description

ECS task logs are not appearing in CloudWatch, making debugging difficult.

### Resolution

1. **Verify Log Configuration**:

   ```typescript
   const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
   	// ... other configuration
   	logging: ecs.LogDrivers.awsLogs({
   		logGroup: new logs.LogGroup(this, 'ApiLogGroup', {
   			logGroupName: '/ecs/macro-ai-api',
   			retention: logs.RetentionDays.ONE_WEEK,
   		}),
   		streamPrefix: 'api',
   	}),
   })
   ```

2. **Check IAM Permissions**:
   - Ensure ECS task role has CloudWatch Logs permissions
   - Verify log group exists and is accessible

3. **Monitor Log Streams**:

   ```bash
   aws logs describe-log-streams \
     --log-group-name /ecs/macro-ai-api \
     --order-by LastEventTime \
     --descending
   ```

## Best Practices

### 1. Health Check Configuration

- Use appropriate health check grace periods
- Implement lightweight health check endpoints
- Monitor health check metrics in CloudWatch

### 2. Resource Allocation

- Start with conservative CPU/memory allocations
- Monitor resource usage and adjust as needed
- Use CloudWatch alarms for resource monitoring

### 3. Deployment Strategy

- Use rolling deployments for zero-downtime updates
- Implement proper rollback procedures
- Test deployments in staging environments first

### 4. Monitoring and Logging

- Set up comprehensive CloudWatch monitoring
- Implement structured logging in applications
- Use CloudWatch alarms for proactive monitoring

### 5. Security

- Follow principle of least privilege for IAM roles
- Use Parameter Store for sensitive configuration
- Implement proper VPC and security group configurations

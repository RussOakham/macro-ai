# Auto-Shutdown for Preview Environments

## Overview

Preview environments now include automatic shutdown and startup scheduling to reduce AWS costs during off-hours and weekends.
This feature can save **~68% on compute costs** for preview environments.

## Cost Savings

- **Without auto-shutdown**: ~$0.34/day = $10.20/month per preview environment
- **With auto-shutdown**: ~$0.11/day = $3.30/month per preview environment
- **Estimated savings**: $5-10/month per preview environment
- **Annual savings**: $60-120 per preview environment

## Default Schedule

### Preview Environments (PR-based)

- **Shutdown**: 10:00 PM UTC (6:00 PM EST, 3:00 PM PST) daily
- **Startup**: **ON-DEMAND ONLY** - No automatic startup
- **Manual startup**: Use AWS Console or CLI when needed
- **Cost optimization**: Maximum savings with on-demand access

### Future Staging Environments

- **Shutdown**: 10:00 PM UTC (6:00 PM EST, 3:00 PM PST)
- **Startup**: 8:00 AM UTC (4:00 AM EST, 1:00 AM PST) - Monday through Friday
- **Weekend**: Full shutdown Friday night to Monday morning

## Configuration

### Default Configuration for Preview Environments (in `app.ts`)

```typescript
autoShutdown: {
  enabled: true,
  shutdownSchedule: '0 22 * * *',      // 10 PM UTC daily
  startupSchedule: undefined,          // No automatic startup - on-demand only
  enableWeekendShutdown: true,         // Full weekend shutdown
  displayTimeZone: 'UTC',              // For documentation
}
```

### Custom Configuration for Staging/Production

For environments that need automatic startup, you can configure schedules:

```typescript
// Example for staging environment with business hours
autoShutdown: {
  enabled: true,
  shutdownSchedule: '0 1 * * *',       // 1 AM UTC = 5 PM PST
  startupSchedule: '0 17 * * 1-5',     // 5 PM UTC = 9 AM PST, Mon-Fri
  enableWeekendShutdown: true,
  displayTimeZone: 'PST',
}
```

### On-Demand Only Configuration (Current Preview Default)

```typescript
autoShutdown: {
  enabled: true,
  shutdownSchedule: '0 22 * * *',      // 10 PM UTC daily shutdown
  startupSchedule: undefined,          // No automatic startup
}
```

### Disabling Auto-Shutdown

```typescript
autoShutdown: {
	enabled: false
}
```

## Manual Controls

### Manual Shutdown

```bash
aws lambda invoke \
  --function-name macro-ai-pr-999-auto-shutdown \
  /tmp/shutdown-response.json
```

### Manual Startup (On-Demand)

For preview environments, startup is manual/on-demand:

```bash
# Scale ECS service to 1 task (start the preview environment)
aws ecs update-service \
  --cluster macro-ai-pr-999-cluster \
  --service macro-ai-pr-999-service \
  --desired-count 1
```

**Alternative: AWS Console**

1. Go to ECS Console → Clusters → macro-ai-pr-999-cluster
2. Click on the service → Update service
3. Set "Desired tasks" to 1
4. Click "Update service"

**The service will take 1-2 minutes to start up and become healthy.**

### Check Current Status

```bash
aws ecs describe-services \
  --cluster macro-ai-pr-999-cluster \
  --services macro-ai-pr-999-service \
  --query 'services[0].{DesiredCount:desiredCount,RunningCount:runningCount,Status:status}'
```

## How It Works

### Application Auto Scaling

- **Scalable Target**: Manages ECS service desired count (0-2 capacity range)
- **Scheduled Actions**: Automatically adjust min/max capacity at scheduled times
- **Shutdown Action**: Sets capacity to 0-0 (forces scale down)
- **Startup Action**: Sets capacity to 1-2 (allows scale up)
- **No Lambda required**: Native AWS service integration

### ECS Service Scaling

- **Target**: Fargate service desired count
- **Shutdown**: Sets `desiredCount = 0`
- **Startup**: Sets `desiredCount = 1` (configurable)
- **Health checks**: Automatic when scaling up

## Monitoring

### CloudFormation Outputs

- `AutoShutdownStatus`: Enabled/Disabled status
- `ShutdownSchedule`: Current shutdown cron expression
- `StartupSchedule`: Current startup cron expression
- `ManualShutdown`: Command for manual shutdown
- `ManualStartup`: Command for manual startup

### CloudWatch Logs

- Application Auto Scaling logs: Available in CloudWatch Events
- ECS service scaling events: Visible in ECS Console
- No additional log storage costs

### Cost Monitoring

- Budget alerts still active during auto-shutdown
- Monthly budget: $50 for preview environments
- Alert thresholds: 50%, 80%, 95% of budget

## Best Practices

### Development Workflow

1. **Create PR**: Auto-shutdown enabled by default
2. **Active development**: Use manual startup if needed during off-hours
3. **Testing**: Environment available during business hours
4. **PR completion**: Auto-cleanup destroys entire stack

### Time Zone Considerations

- **All schedules use UTC time**
- **Configure schedules for your team's time zone**
- **Consider distributed teams** when setting hours

### Cost Optimization

- **Enable weekend shutdown** for maximum savings
- **Adjust schedules** based on actual usage patterns
- **Use manual controls** for urgent access during off-hours

## Troubleshooting

### Service Won't Start

```bash
# Check service status
aws ecs describe-services --cluster CLUSTER_NAME --services SERVICE_NAME

# Check task definition
aws ecs describe-task-definition --task-definition TASK_FAMILY

# Manually scale up
aws ecs update-service --cluster CLUSTER_NAME --service SERVICE_NAME --desired-count 1
```

### Scaling Issues

```bash
# Check Application Auto Scaling target
aws application-autoscaling describe-scalable-targets \
  --service-namespace ecs \
  --resource-ids service/CLUSTER_NAME/SERVICE_NAME

# Check scheduled actions
aws application-autoscaling describe-scheduled-actions \
  --service-namespace ecs \
  --resource-id service/CLUSTER_NAME/SERVICE_NAME
```

### Schedule Issues

- Verify cron expressions are in UTC
- Check scheduled actions in Application Auto Scaling Console
- Ensure service has correct min/max capacity settings

## Security

### IAM Permissions

- Application Auto Scaling has minimal required permissions
- Scoped to specific ECS service
- Uses AWS managed service roles

### Resource Isolation

- Each PR has isolated scalable targets and scheduled actions
- No cross-environment access
- Automatic cleanup on stack deletion

## Cost Analysis

### Breakdown (0.25 vCPU, 512 MB memory)

- **24/7 operation**: $0.014/hour × 24 hours = $0.336/day
- **Business hours only**: $0.014/hour × 8 hours = $0.112/day
- **Weekdays only**: $0.112/day × 5 days = $0.56/week
- **With weekends**: $0.336/day × 7 days = $2.35/week

### Additional Savings

- **CloudWatch Logs**: Reduced log retention (3 days for PRs)
- **VPC Endpoints**: Disabled for preview environments
- **NAT Gateway**: Eliminated with public IP assignment
- **Detailed Monitoring**: Disabled for cost optimization

## Implementation Details

The auto-shutdown feature is implemented through:

1. **AutoShutdownConstruct** (`auto-shutdown-construct.ts`)
2. **MacroAiPreviewStack** integration
3. **Application Auto Scaling** with scheduled actions
4. **ECS service capacity management**
5. **CloudFormation outputs** for manual control

This provides a robust, cost-effective solution for managing preview environment lifecycles.

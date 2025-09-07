# CloudWatch Monitoring Setup for Macro AI Infrastructure

## Overview

This document outlines the comprehensive monitoring setup for the Macro AI infrastructure
using AWS CloudWatch. The monitoring system provides real-time observability, alerting,
and performance tracking across all environments.

## Table of Contents

- [Monitoring Architecture](#monitoring-architecture)
- [CloudWatch Alarms](#cloudwatch-alarms)
- [Monitoring Dashboards](#monitoring-dashboards)
- [Alerting System](#alerting-system)
- [Performance Monitoring](#performance-monitoring)
- [Cost Monitoring](#cost-monitoring)
- [Log Monitoring](#log-monitoring)
- [Setup Instructions](#setup-instructions)
- [Troubleshooting](#troubleshooting)

## Monitoring Architecture

### Components

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ECS Service   │────│  CloudWatch     │────│   SNS Topic     │
│   Metrics       │    │   Alarms        │    │  (Alerts)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┼─────────────────────────────┐
                                 │                             │
                    ┌─────────────────┐           ┌─────────────────┐
                    │  CloudWatch     │           │   GitHub        │
                    │  Dashboard      │           │   Issues        │
                    └─────────────────┘           └─────────────────┘
```

### Data Flow

1. **Metrics Collection**: AWS services automatically send metrics to CloudWatch
2. **Alarm Evaluation**: CloudWatch evaluates metrics against configured thresholds
3. **Alert Generation**: When thresholds are breached, alarms trigger SNS notifications
4. **Issue Creation**: GitHub Actions workflows create issues for alert management
5. **Dashboard Updates**: Real-time dashboards display current system status

## CloudWatch Alarms

### ECS Service Alarms

| Alarm Name          | Metric                            | Threshold        | Description        |
| ------------------- | --------------------------------- | ---------------- | ------------------ |
| `CPUUtilization`    | AWS/ECS CPUUtilization            | >80% (3 periods) | High CPU usage     |
| `MemoryUtilization` | AWS/ECS MemoryUtilization         | >85% (3 periods) | High memory usage  |
| `RunningTaskCount`  | AWS/ECS RunningTaskCount          | <1 (2 periods)   | Service down       |
| `HTTP5xxError`      | AWS/ELB HTTPCode_Target_5XX_Count | >10 (2 periods)  | Application errors |

### Load Balancer Alarms

| Alarm Name         | Metric                   | Threshold      | Description           |
| ------------------ | ------------------------ | -------------- | --------------------- |
| `HealthyHostCount` | AWS/ELB HealthyHostCount | <1 (2 periods) | Unhealthy targets     |
| `RequestCountLow`  | AWS/ELB RequestCount     | <1 (15 min)    | Possible service down |

### Cost Alarms

| Alarm Name             | Metric                           | Threshold      | Description  |
| ---------------------- | -------------------------------- | -------------- | ------------ |
| `EstimatedMonthlyCost` | AWS/Budgets EstimatedMonthlyCost | >80% of budget | Budget alert |

## Monitoring Dashboards

### Dashboard Layout

Each environment has a dedicated CloudWatch dashboard with the following widgets:

#### 1. ECS Service Metrics

- **CPU Utilization**: Average and maximum CPU usage over time
- **Memory Utilization**: Average and maximum memory usage over time
- **Running Tasks**: Current vs desired task counts

#### 2. Load Balancer Metrics

- **Request Count**: Total requests per minute
- **Response Time**: Average response time
- **HTTP Status Codes**: 2xx, 4xx, 5xx error rates

#### 3. Alarm Status

- **Active Alarms**: Current status of all configured alarms
- **Recent Alerts**: Timeline of recent alarm triggers

### Accessing Dashboards

Dashboards are accessible via:

- **AWS Console**: `https://<region>.console.aws.amazon.com/cloudwatch/home?region=<region>#dashboards:name=<environment>-monitoring-dashboard`
- **CloudFormation Outputs**: Dashboard URLs are exported as stack outputs

## Alerting System

### SNS Topic Configuration

Each environment has a dedicated SNS topic for monitoring alerts:

- **Topic Name**: `<environment>-monitoring-alarms`
- **Subscriptions**: Configured for email notifications and webhook integrations

### Alert Routing

Alerts are processed through multiple channels:

1. **Email Notifications**: Sent to configured email addresses
2. **GitHub Issues**: Automated issue creation for tracking and resolution
3. **Slack Integration**: Optional webhook integration for team notifications
4. **PagerDuty**: Optional integration for critical alerts

### Alert Severity Levels

| Severity     | Threshold                 | Response Time | Channels                |
| ------------ | ------------------------- | ------------- | ----------------------- |
| **Critical** | Service down, data loss   | Immediate     | Email, Slack, PagerDuty |
| **High**     | Performance degradation   | <15 minutes   | Email, GitHub Issue     |
| **Medium**   | Resource utilization high | <1 hour       | Email                   |
| **Low**      | Minor issues              | <4 hours      | Email                   |

## Performance Monitoring

### Key Performance Indicators (KPIs)

#### Application Performance

- **API Response Time**: Target <200ms (95th percentile)
- **Error Rate**: Target <1% (HTTP 5xx errors)
- **Throughput**: Requests per second
- **Availability**: Uptime percentage

#### Infrastructure Performance

- **CPU Utilization**: Target <70% average
- **Memory Utilization**: Target <80% average
- **Disk I/O**: Monitor for bottlenecks
- **Network I/O**: Monitor for bandwidth issues

### Performance Baselines

| Environment    | Target CPU | Target Memory | Target Response Time |
| -------------- | ---------- | ------------- | -------------------- |
| **Production** | <70%       | <80%          | <200ms               |
| **Staging**    | <75%       | <85%          | <500ms               |
| **Feature**    | <80%       | <90%          | <1000ms              |

### Performance Alerts

- **Warning**: 80% of target thresholds
- **Critical**: 100% of target thresholds
- **Recovery**: Back below 50% of target thresholds

## Cost Monitoring

### Cost Tracking

The system monitors costs across multiple AWS services:

#### Primary Cost Drivers

- **ECS Fargate**: Compute costs (CPU/memory)
- **Application Load Balancer**: Request processing
- **CloudWatch**: Monitoring and logging costs
- **Data Transfer**: Internet traffic costs

#### Cost Budgets

- **Production**: $150-300/month (24/7 operation)
- **Staging**: $50-100/month (scheduled operation)
- **Feature**: $10-50/month (on-demand operation)

### Cost Alerts

| Alert Level  | Threshold      | Action Required             |
| ------------ | -------------- | --------------------------- |
| **Warning**  | 75% of budget  | Review usage patterns       |
| **Critical** | 90% of budget  | Immediate cost optimization |
| **Exceeded** | 100% of budget | Service scaling or shutdown |

## Log Monitoring

### CloudWatch Logs Configuration

#### Log Groups

- **ECS Application Logs**: `/aws/ecs/macro-ai-<environment>`
- **Load Balancer Logs**: `/aws/elasticloadbalancing/macro-ai-<environment>`
- **Lambda Function Logs**: `/aws/lambda/macro-ai-<environment>`

#### Log Retention

- **Production**: 30 days
- **Staging**: 14 days
- **Feature**: 7 days

### Log Monitoring Rules

| Pattern              | Severity | Action              |
| -------------------- | -------- | ------------------- |
| `ERROR`              | High     | Create GitHub issue |
| `WARN`               | Medium   | Log and monitor     |
| `FATAL`              | Critical | Immediate alert     |
| `timeout`            | High     | Performance alert   |
| `connection refused` | High     | Service alert       |

## Setup Instructions

### Automated Setup

Monitoring is automatically configured when deploying infrastructure:

```bash
# Deploy production with monitoring
cd infrastructure
npm run deploy:production

# Monitoring components are included automatically
```

### Manual Verification

After deployment, verify monitoring setup:

```bash
# Check CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix production \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue}'

# Check SNS topic
aws sns list-topics \
  --query 'Topics[?contains(TopicArn, `monitoring`)].TopicArn'

# Check dashboard
aws cloudwatch list-dashboards \
  --query 'DashboardEntries[?contains(DashboardName, `monitoring`)].DashboardName'
```

### Configuration Updates

To modify monitoring configuration:

```bash
# Update alarm thresholds
aws cloudwatch put-metric-alarm \
  --alarm-name production-ecs-cpu-high \
  --threshold 75 \
  --comparison-operator GreaterThanThreshold

# Add new alarm
aws cloudwatch put-metric-alarm \
  --alarm-name production-custom-metric \
  --metric-name CustomMetric \
  --namespace MacroAI/Production \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold
```

## Troubleshooting

### Common Issues

#### 1. Missing Metrics

```bash
# Check if service is sending metrics
aws cloudwatch list-metrics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization

# Verify IAM permissions for CloudWatch
aws iam list-attached-role-policies \
  --role-name macro-ai-ecs-task-role
```

#### 2. Alarms Not Triggering

```bash
# Check alarm configuration
aws cloudwatch describe-alarms \
  --alarm-names production-ecs-cpu-high

# Verify alarm actions
aws cloudwatch describe-alarm-history \
  --alarm-name production-ecs-cpu-high \
  --start-date 2024-01-01T00:00:00Z
```

#### 3. SNS Notifications Not Working

```bash
# Check SNS topic policy
aws sns get-topic-attributes \
  --topic-arn arn:aws:sns:region:account:production-monitoring-alarms

# Verify email subscriptions
aws sns list-subscriptions \
  --topic-arn arn:aws:sns:region:account:production-monitoring-alarms
```

#### 4. Dashboard Not Loading

```bash
# Check dashboard permissions
aws cloudwatch get-dashboard \
  --dashboard-name production-monitoring-dashboard

# Verify dashboard JSON structure
aws cloudwatch get-dashboard \
  --dashboard-name production-monitoring-dashboard \
  --query 'DashboardBody'
```

### Debugging Commands

```bash
# Get recent metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ClusterName,Value=macro-ai-production-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average Maximum

# Check alarm history
aws cloudwatch describe-alarm-history \
  --alarm-name production-ecs-cpu-high \
  --history-item-type StateUpdate \
  --start-date $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)

# Test SNS notification
aws sns publish \
  --topic-arn arn:aws:sns:region:account:production-monitoring-alarms \
  --message "Test notification from monitoring setup"
```

### Escalation Procedures

1. **Level 1**: Check CloudWatch console for metric data
2. **Level 2**: Verify IAM permissions and resource configurations
3. **Level 3**: Review CloudFormation stack events for deployment issues
4. **Level 4**: Contact AWS support for platform-level issues

## Best Practices

### Monitoring Strategy

- **Proactive Monitoring**: Set up alerts before issues occur
- **Graduated Alerting**: Different severity levels for different issues
- **Contextual Alerts**: Include relevant information in alert messages
- **Actionable Alerts**: Each alert should have clear next steps

### Cost Optimization

- **Right-size Resources**: Monitor utilization to optimize instance types
- **Scheduled Scaling**: Use off-hours to reduce costs
- **Detailed Monitoring**: Only enable detailed monitoring where needed
- **Log Retention**: Adjust log retention based on compliance requirements

### Alert Management

- **Alert Fatigue Prevention**: Avoid unnecessary notifications
- **Escalation Paths**: Clear procedures for different alert types
- **Documentation**: Keep alert configurations and procedures documented
- **Regular Review**: Review and update alerts based on system changes

### Performance Optimization

- **Baseline Establishment**: Establish performance baselines for each environment
- **Trend Analysis**: Monitor performance trends over time
- **Capacity Planning**: Use monitoring data for capacity planning
- **Automated Scaling**: Configure auto-scaling based on monitoring data

---

_This monitoring setup provides comprehensive observability for the Macro AI infrastructure.
Regular review and updates ensure continued effectiveness as the system evolves._

# Performance Monitoring Setup

## Overview

This document describes the comprehensive performance monitoring system implemented for the Macro AI infrastructure,
focusing on Neon PostgreSQL database and Upstash Redis monitoring.

## Architecture

The performance monitoring system consists of:

1. **Neon Database Monitoring**: Real-time monitoring of PostgreSQL performance metrics
2. **Upstash Redis Monitoring**: Real-time monitoring of Redis cache performance
3. **CloudWatch Integration**: Centralized metrics collection and alerting
4. **Automated Dashboards**: Visual monitoring dashboards for both services

## Neon Database Monitoring

### Metrics Collected

#### Core Metrics (Always Enabled)

- **Active Connections**: Number of active database connections
- **Idle Connections**: Number of idle database connections
- **Total Connections**: Total number of connections
- **Database Size**: Current database size in GB
- **Average Query Time**: Average query execution time in milliseconds
- **Slow Queries**: Number of slow queries per minute

#### Detailed Metrics (Production Only)

- **Lock Wait Time**: Average time spent waiting for locks
- **Connection Pool Utilization**: Percentage of connection pool used
- **Query Throughput**: Queries per second

### Alert Thresholds

| Metric             | Warning      | Critical     | Description                       |
| ------------------ | ------------ | ------------ | --------------------------------- |
| Active Connections | 80% of limit | 90% of limit | Connection pool utilization       |
| Slow Queries       | >5/min       | >10/min      | Performance degradation indicator |
| Database Size      | 0.8GB        | 0.9GB        | Approaching Neon free tier limit  |
| Lock Wait Time     | 50ms         | 100ms        | Lock contention indicator         |

### CloudWatch Namespace

```text
Neon/Monitoring
```

## Upstash Redis Monitoring

### Metrics Collected

#### Core Metrics (Always Enabled)

- **Connected Clients**: Number of active client connections
- **Memory Usage**: Current memory usage in bytes
- **Memory Usage %**: Percentage of memory used
- **Cache Hit Rate**: Percentage of cache hits vs total requests
- **Commands/Second**: Redis commands processed per second

#### Detailed Metrics (Production Only)

- **Keyspace Hits**: Number of successful key lookups
- **Keyspace Misses**: Number of failed key lookups
- **Evicted Keys**: Number of keys evicted due to memory pressure
- **Total Keys**: Total number of keys in database
- **Expired Keys**: Number of keys expired automatically

### Alert Thresholds

| Metric            | Warning | Critical | Description               |
| ----------------- | ------- | -------- | ------------------------- |
| Memory Usage      | 75%     | 85%      | Memory utilization        |
| Connected Clients | 80      | 100      | Connection limits         |
| Cache Hit Rate    | <75%    | <60%     | Cache effectiveness       |
| Evicted Keys      | >50/min | >100/min | Memory pressure indicator |

### CloudWatch Namespace

```text
Upstash/Monitoring
```

## Monitoring Frequency

- **Collection Interval**: Every 5 minutes
- **Alert Evaluation**: Every 3-5 minutes depending on metric
- **Dashboard Refresh**: Real-time (CloudWatch default)

## CloudWatch Dashboards

### Neon Monitoring Dashboard

- **URL Pattern**: `https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#dashboards:name={environment}-neon-monitoring-dashboard`
- **Widgets**:
  - Connection metrics (Active, Idle, Total)
  - Performance metrics (Query Time, Slow Queries)
  - Database size trends
  - Alert status overview

### Upstash Monitoring Dashboard

- **URL Pattern**: `https://{region}.console.aws.amazon.com/cloudwatch/home?region={region}#dashboards:name={environment}-upstash-monitoring-dashboard`
- **Widgets**:
  - Memory usage and client connections
  - Cache performance (hit rate, operations)
  - Key management metrics
  - Alert status overview

## SNS Alert Topics

### Alert Routing

- **Production**: `production-monitoring-alerts`
- **Staging**: `staging-monitoring-alerts`
- **Feature**: `feature-monitoring-alerts`

### Alert Categories

- **Performance Alerts**: Slow queries, high memory usage
- **Capacity Alerts**: Connection limits, storage limits
- **Error Alerts**: Failed monitoring, API errors

## Implementation Details

### Lambda Functions

#### Neon Monitoring Lambda

- **Function**: `macro-ai-production-neon-monitoring`
- **Runtime**: Node.js 18.x
- **Timeout**: 30 seconds
- **Memory**: 256MB
- **Triggers**: EventBridge rule (every 5 minutes)

#### Upstash Monitoring Lambda

- **Function**: `macro-ai-production-upstash-monitoring`
- **Runtime**: Node.js 18.x
- **Timeout**: 30 seconds
- **Memory**: 256MB
- **Triggers**: EventBridge rule (every 5 minutes)

### Environment Variables

#### Neon Monitoring

```bash
NEON_CONNECTION_STRING=<database-url>
ENVIRONMENT=production
ENABLE_DETAILED_MONITORING=true
```

#### Upstash Monitoring

```bash
UPSTASH_REST_TOKEN=<rest-token>
UPSTASH_REST_URL=<rest-url>
ENVIRONMENT=production
ENABLE_DETAILED_MONITORING=true
```

## Troubleshooting

### Common Issues

#### Neon Monitoring Issues

- **Connection Failures**: Check NEON_CONNECTION_STRING
- **Permission Errors**: Verify Lambda execution role
- **Missing Metrics**: Check CloudWatch logs for errors

#### Upstash Monitoring Issues

- **API Errors**: Verify UPSTASH_REST_TOKEN and UPSTASH_REST_URL
- **Rate Limiting**: Upstash API has rate limits
- **Authentication**: Check token validity

### Monitoring Lambda Logs

```bash
# View Neon monitoring logs
aws logs tail /aws/lambda/macro-ai-production-neon-monitoring --follow

# View Upstash monitoring logs
aws logs tail /aws/lambda/macro-ai-production-upstash-monitoring --follow
```

### Manual Testing

```bash
# Test Neon monitoring
aws lambda invoke \
  --function-name macro-ai-production-neon-monitoring \
  --payload '{}' \
  output.json

# Test Upstash monitoring
aws lambda invoke \
  --function-name macro-ai-production-upstash-monitoring \
  --payload '{}' \
  output.json
```

## Cost Optimization

### Monitoring Costs

- **Lambda Invocations**: ~$0.02/month (288 invocations × 5 minutes)
- **CloudWatch Metrics**: ~$0.30/month (standard CloudWatch pricing)
- **CloudWatch Dashboards**: ~$3.00/month (per dashboard)
- **Total Monthly Cost**: ~$3.32/month

### Free Tier Usage

- **CloudWatch**: First 10 metrics and 3 dashboards free
- **Lambda**: First 1M requests free
- **SNS**: First 1,000 notifications free

## Scaling Considerations

### High-Traffic Scenarios

- **Increase Monitoring Frequency**: Reduce from 5 minutes to 1 minute
- **Add More Metrics**: Enable detailed monitoring for all environments
- **Custom Dashboards**: Create service-specific dashboards

### Multi-Environment Setup

- **Separate Namespaces**: Use environment-specific CloudWatch namespaces
- **Environment Tags**: Tag all resources with environment information
- **Consolidated Alerts**: Route alerts to environment-specific SNS topics

## Future Enhancements

### Planned Improvements

- **Anomaly Detection**: ML-based anomaly detection for metrics
- **Predictive Scaling**: Forecast resource needs based on trends
- **Custom Metrics**: Application-specific performance metrics
- **Real-time Alerts**: Integration with Slack/Teams for instant notifications

### Integration Opportunities

- **Application Metrics**: Add application-level performance monitoring
- **Log Analysis**: Correlate logs with performance metrics
- **Synthetic Monitoring**: Add uptime and performance monitoring
- **Cost Attribution**: Track costs by feature/environment

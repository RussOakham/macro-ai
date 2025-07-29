# Monitoring and Logging

## Current Implementation Status 📋 PLANNED

This document outlines comprehensive monitoring and logging strategies for the Macro AI application, including
observability patterns, alerting mechanisms, and maintenance procedures. The monitoring infrastructure is **planned
and designed** for production-ready observability with automated alerting and comprehensive log management.

## 📊 Monitoring Architecture

### Observability Stack Overview

```mermaid
graph TB
    subgraph "Application Layer"
        API[Express API]
        UI[Client UI]
        DB[PostgreSQL]
        REDIS[Redis Cache]
    end

    subgraph "AWS Monitoring Services"
        CW[CloudWatch Metrics]
        CWL[CloudWatch Logs]
        XR[X-Ray Tracing]
        CWA[CloudWatch Alarms]
    end

    subgraph "Alerting & Notifications"
        SNS[SNS Topics]
        SLACK[Slack Integration]
        EMAIL[Email Alerts]
        PAGER[PagerDuty]
    end

    subgraph "Dashboards & Visualization"
        CWD[CloudWatch Dashboards]
        GRAFANA[Grafana (Optional)]
    end

    API --> CW
    API --> CWL
    API --> XR
    UI --> CW
    UI --> CWL
    DB --> CW
    REDIS --> CW

    CW --> CWA
    CWL --> CWA
    XR --> CWA

    CWA --> SNS
    SNS --> SLACK
    SNS --> EMAIL
    SNS --> PAGER

    CW --> CWD
    CWL --> CWD
    XR --> CWD
    CW --> GRAFANA
```

### Monitoring Principles ✅ DESIGNED

1. **Proactive Monitoring**: Detect issues before they impact users
2. **Comprehensive Coverage**: Monitor all critical system components
3. **Actionable Alerts**: Every alert should require specific action
4. **Performance Tracking**: Monitor key performance indicators (KPIs)
5. **Cost Optimization**: Balance monitoring depth with operational costs

## 🔍 Application Monitoring

### Express API Monitoring 📋 PLANNED

#### Key Metrics

**Performance Metrics**:

```typescript
// Custom CloudWatch metrics
const cloudwatch = new CloudWatchClient({ region: 'us-east-1' })

export const recordMetric = async (
	metricName: string,
	value: number,
	unit: string = 'Count',
) => {
	const params = {
		Namespace: 'MacroAI/API',
		MetricData: [
			{
				MetricName: metricName,
				Value: value,
				Unit: unit,
				Timestamp: new Date(),
				Dimensions: [
					{
						Name: 'Environment',
						Value: process.env.NODE_ENV || 'development',
					},
					{
						Name: 'Service',
						Value: 'express-api',
					},
				],
			},
		],
	}

	await cloudwatch.send(new PutMetricDataCommand(params))
}

// Usage in middleware
app.use((req, res, next) => {
	const startTime = Date.now()

	res.on('finish', async () => {
		const duration = Date.now() - startTime
		await recordMetric('RequestDuration', duration, 'Milliseconds')
		await recordMetric('RequestCount', 1)

		if (res.statusCode >= 400) {
			await recordMetric('ErrorCount', 1)
		}
	})

	next()
})
```

**Business Metrics**:

- User registration rate
- Authentication success/failure rate
- Chat message volume
- AI response generation time
- Database query performance

#### Health Check Implementation

```typescript
interface HealthCheck {
	status: 'healthy' | 'unhealthy' | 'degraded'
	timestamp: string
	version: string
	environment: string
	checks: {
		database: HealthCheckResult
		redis: HealthCheckResult
		cognito: HealthCheckResult
		openai: HealthCheckResult
	}
}

interface HealthCheckResult {
	status: 'healthy' | 'unhealthy'
	responseTime: number
	error?: string
}

app.get('/api/health', async (req, res) => {
	const startTime = Date.now()

	const health: HealthCheck = {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		version: process.env.APP_VERSION || 'unknown',
		environment: process.env.NODE_ENV || 'development',
		checks: {
			database: await checkDatabaseHealth(),
			redis: await checkRedisHealth(),
			cognito: await checkCognitoHealth(),
			openai: await checkOpenAIHealth(),
		},
	}

	// Determine overall health status
	const unhealthyChecks = Object.values(health.checks).filter(
		(check) => check.status === 'unhealthy',
	)
	if (unhealthyChecks.length > 0) {
		health.status =
			unhealthyChecks.length === Object.keys(health.checks).length
				? 'unhealthy'
				: 'degraded'
	}

	const responseTime = Date.now() - startTime
	await recordMetric('HealthCheckDuration', responseTime, 'Milliseconds')

	res.status(health.status === 'healthy' ? 200 : 503).json(health)
})

async function checkDatabaseHealth(): Promise<HealthCheckResult> {
	const startTime = Date.now()

	try {
		await db.execute(sql`SELECT 1`)
		return {
			status: 'healthy',
			responseTime: Date.now() - startTime,
		}
	} catch (error) {
		return {
			status: 'unhealthy',
			responseTime: Date.now() - startTime,
			error: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}
```

### Client UI Monitoring 📋 PLANNED

#### Frontend Performance Monitoring

```typescript
// Web Vitals tracking
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric: any) {
	// Send to CloudWatch or analytics service
	fetch('/api/metrics', {
		method: 'POST',
		body: JSON.stringify({
			name: metric.name,
			value: metric.value,
			id: metric.id,
			delta: metric.delta,
		}),
	})
}

getCLS(sendToAnalytics)
getFID(sendToAnalytics)
getFCP(sendToAnalytics)
getLCP(sendToAnalytics)
getTTFB(sendToAnalytics)
```

#### Error Tracking

```typescript
// Global error handler
window.addEventListener('error', (event) => {
	const errorData = {
		message: event.message,
		filename: event.filename,
		lineno: event.lineno,
		colno: event.colno,
		stack: event.error?.stack,
		timestamp: new Date().toISOString(),
		userAgent: navigator.userAgent,
		url: window.location.href,
	}

	// Send to logging service
	fetch('/api/errors', {
		method: 'POST',
		body: JSON.stringify(errorData),
	})
})

// React error boundary
class ErrorBoundary extends React.Component {
	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		const errorData = {
			error: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
			timestamp: new Date().toISOString(),
		}

		// Send to logging service
		fetch('/api/errors', {
			method: 'POST',
			body: JSON.stringify(errorData),
		})
	}
}
```

## 📝 Logging Strategy

### Structured Logging Implementation ✅ IMPLEMENTED

#### Pino Logger Configuration

```typescript
import pino from 'pino'

const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	formatters: {
		level: (label) => ({ level: label }),
	},
	timestamp: pino.stdTimeFunctions.isoTime,
	...(process.env.NODE_ENV === 'production' && {
		// Production logging configuration
		redact: ['password', 'token', 'authorization'],
		serializers: {
			req: pino.stdSerializers.req,
			res: pino.stdSerializers.res,
			err: pino.stdSerializers.err,
		},
	}),
	...(process.env.NODE_ENV === 'development' && {
		// Development logging configuration
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'SYS:standard',
				ignore: 'pid,hostname',
			},
		},
	}),
})

export { logger }
```

#### Log Levels and Usage

```typescript
// Error logging with context
logger.error(
	{
		err: error,
		userId: req.user?.id,
		requestId: req.id,
		endpoint: req.path,
	},
	'Authentication failed',
)

// Info logging for business events
logger.info(
	{
		userId: user.id,
		chatId: chat.id,
		messageCount: messages.length,
	},
	'Chat conversation created',
)

// Debug logging for development
logger.debug(
	{
		query: sanitizedQuery,
		duration: queryTime,
	},
	'Database query executed',
)

// Warn logging for recoverable issues
logger.warn(
	{
		retryCount: attempt,
		maxRetries: MAX_RETRIES,
	},
	'API request failed, retrying',
)
```

### Log Aggregation 📋 PLANNED

#### CloudWatch Logs Configuration

```typescript
// CDK configuration for log groups
const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
	logGroupName: '/ecs/macro-ai-api',
	retention: logs.RetentionDays.SIX_MONTHS,
	removalPolicy: cdk.RemovalPolicy.RETAIN,
})

const uiLogGroup = new logs.LogGroup(this, 'UiLogGroup', {
	logGroupName: '/ecs/macro-ai-ui',
	retention: logs.RetentionDays.THREE_MONTHS,
	removalPolicy: cdk.RemovalPolicy.RETAIN,
})

// Log stream configuration
const logDriver = ecs.LogDrivers.awsLogs({
	logGroup: apiLogGroup,
	streamPrefix: 'api',
	datetimeFormat: '%Y-%m-%d %H:%M:%S',
})
```

#### Log Parsing and Filtering

```typescript
// CloudWatch Insights queries
const commonQueries = {
	// Error analysis
	errors: `
    fields @timestamp, level, msg, err.message, userId, requestId
    | filter level = "error"
    | sort @timestamp desc
    | limit 100
  `,

	// Performance analysis
	slowRequests: `
    fields @timestamp, msg, duration, endpoint, userId
    | filter duration > 1000
    | sort duration desc
    | limit 50
  `,

	// User activity
	userActivity: `
    fields @timestamp, msg, userId, endpoint
    | filter ispresent(userId)
    | stats count() by userId
    | sort count desc
  `,

	// Authentication events
	authEvents: `
    fields @timestamp, msg, userId, success
    | filter msg like /authentication/
    | sort @timestamp desc
  `,
}
```

## 🚨 Alerting and Notifications

### Alert Categories 📋 PLANNED

#### Critical Alerts (Immediate Response Required)

```typescript
// Application down
const appDownAlarm = new cloudwatch.Alarm(this, 'ApplicationDownAlarm', {
	metric: new cloudwatch.Metric({
		namespace: 'AWS/ApplicationELB',
		metricName: 'HealthyHostCount',
		dimensionsMap: {
			TargetGroup: targetGroup.targetGroupFullName,
		},
		statistic: 'Average',
	}),
	threshold: 1,
	comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
	evaluationPeriods: 2,
	treatMissingData: cloudwatch.TreatMissingData.BREACHING,
})

// High error rate
const errorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
	metric: new cloudwatch.Metric({
		namespace: 'AWS/ApplicationELB',
		metricName: 'HTTPCode_Target_5XX_Count',
		dimensionsMap: {
			LoadBalancer: loadBalancer.loadBalancerFullName,
		},
		statistic: 'Sum',
	}),
	threshold: 10,
	evaluationPeriods: 2,
})

// Database connection failures
const dbConnectionAlarm = new cloudwatch.Alarm(
	this,
	'DatabaseConnectionAlarm',
	{
		metric: database.metricDatabaseConnections(),
		threshold: 80,
		comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
		evaluationPeriods: 2,
	},
)
```

#### Warning Alerts (Monitor and Investigate)

```typescript
// High CPU utilization
const cpuAlarm = new cloudwatch.Alarm(this, 'HighCpuAlarm', {
	metric: apiService.metricCpuUtilization(),
	threshold: 80,
	evaluationPeriods: 3,
})

// High memory utilization
const memoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
	metric: apiService.metricMemoryUtilization(),
	threshold: 85,
	evaluationPeriods: 3,
})

// Slow response times
const responseTimeAlarm = new cloudwatch.Alarm(this, 'SlowResponseAlarm', {
	metric: new cloudwatch.Metric({
		namespace: 'MacroAI/API',
		metricName: 'RequestDuration',
		statistic: 'Average',
	}),
	threshold: 2000, // 2 seconds
	evaluationPeriods: 3,
})
```

### Notification Channels 📋 PLANNED

#### SNS Topic Configuration

```typescript
const criticalAlertsTopic = new sns.Topic(this, 'CriticalAlerts', {
	displayName: 'Macro AI Critical Alerts',
})

const warningAlertsTopic = new sns.Topic(this, 'WarningAlerts', {
	displayName: 'Macro AI Warning Alerts',
})

// Email subscriptions
criticalAlertsTopic.addSubscription(
	new snsSubscriptions.EmailSubscription('alerts@macro-ai.com'),
)

// Slack integration
criticalAlertsTopic.addSubscription(
	new snsSubscriptions.LambdaSubscription(slackNotificationFunction),
)

// PagerDuty integration for critical alerts
criticalAlertsTopic.addSubscription(
	new snsSubscriptions.EmailSubscription('pagerduty@macro-ai.pagerduty.com'),
)
```

#### Slack Integration

```typescript
// Lambda function for Slack notifications
export const handler = async (event: SNSEvent) => {
	for (const record of event.Records) {
		const message = JSON.parse(record.Sns.Message)

		const slackMessage = {
			channel: '#alerts',
			username: 'AWS CloudWatch',
			icon_emoji: ':warning:',
			attachments: [
				{
					color: message.NewStateValue === 'ALARM' ? 'danger' : 'good',
					title: message.AlarmName,
					text: message.AlarmDescription,
					fields: [
						{
							title: 'State',
							value: message.NewStateValue,
							short: true,
						},
						{
							title: 'Reason',
							value: message.NewStateReason,
							short: true,
						},
						{
							title: 'Timestamp',
							value: message.StateChangeTime,
							short: true,
						},
					],
				},
			],
		}

		await fetch(process.env.SLACK_WEBHOOK_URL!, {
			method: 'POST',
			body: JSON.stringify(slackMessage),
		})
	}
}
```

## 📈 Performance Monitoring

### Key Performance Indicators (KPIs) 📋 PLANNED

#### Application Performance

```typescript
interface PerformanceMetrics {
	// Response time metrics
	averageResponseTime: number
	p95ResponseTime: number
	p99ResponseTime: number

	// Throughput metrics
	requestsPerSecond: number
	requestsPerMinute: number

	// Error metrics
	errorRate: number
	errorCount: number

	// Business metrics
	activeUsers: number
	chatMessagesPerHour: number
	aiResponseTime: number
}

// Custom dashboard metrics
const performanceDashboard = new cloudwatch.Dashboard(
	this,
	'PerformanceDashboard',
	{
		dashboardName: 'MacroAI-Performance',
		widgets: [
			[
				new cloudwatch.GraphWidget({
					title: 'API Response Times',
					left: [
						new cloudwatch.Metric({
							namespace: 'MacroAI/API',
							metricName: 'RequestDuration',
							statistic: 'Average',
						}),
						new cloudwatch.Metric({
							namespace: 'MacroAI/API',
							metricName: 'RequestDuration',
							statistic: 'p95',
						}),
					],
				}),
			],
			[
				new cloudwatch.GraphWidget({
					title: 'Request Volume',
					left: [
						new cloudwatch.Metric({
							namespace: 'MacroAI/API',
							metricName: 'RequestCount',
							statistic: 'Sum',
						}),
					],
				}),
			],
			[
				new cloudwatch.GraphWidget({
					title: 'Error Rate',
					left: [
						new cloudwatch.Metric({
							namespace: 'MacroAI/API',
							metricName: 'ErrorCount',
							statistic: 'Sum',
						}),
					],
				}),
			],
		],
	},
)
```

### Database Performance Monitoring 📋 PLANNED

```typescript
// RDS Performance Insights
const database = new rds.DatabaseInstance(this, 'Database', {
	// ... other configuration
	enablePerformanceInsights: true,
	performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_7,
	monitoringInterval: cdk.Duration.minutes(1),
})

// Custom database metrics
const dbMetrics = {
	connectionCount: database.metricDatabaseConnections(),
	cpuUtilization: database.metricCPUUtilization(),
	freeStorageSpace: database.metricFreeStorageSpace(),
	readLatency: database.metricReadLatency(),
	writeLatency: database.metricWriteLatency(),
}

// Database alarms
Object.entries(dbMetrics).forEach(([name, metric]) => {
	new cloudwatch.Alarm(this, `Database${name}Alarm`, {
		metric,
		threshold: getThresholdForMetric(name),
		evaluationPeriods: 2,
	})
})
```

## 🔧 Maintenance Procedures

### Log Rotation and Cleanup 📋 PLANNED

```typescript
// Automated log cleanup Lambda
export const logCleanupHandler = async () => {
	const cloudwatchLogs = new CloudWatchLogsClient({ region: 'us-east-1' })

	// Get all log groups
	const logGroups = await cloudwatchLogs.send(new DescribeLogGroupsCommand({}))

	for (const logGroup of logGroups.logGroups || []) {
		if (logGroup.logGroupName?.startsWith('/ecs/macro-ai')) {
			// Delete old log streams
			const streams = await cloudwatchLogs.send(
				new DescribeLogStreamsCommand({
					logGroupName: logGroup.logGroupName,
					orderBy: 'LastEventTime',
					descending: false,
				}),
			)

			const oldStreams = streams.logStreams?.filter(
				(stream) =>
					stream.lastEventTime &&
					Date.now() - stream.lastEventTime > 30 * 24 * 60 * 60 * 1000, // 30 days
			)

			for (const stream of oldStreams || []) {
				await cloudwatchLogs.send(
					new DeleteLogStreamCommand({
						logGroupName: logGroup.logGroupName,
						logStreamName: stream.logStreamName,
					}),
				)
			}
		}
	}
}
```

### Monitoring Health Checks 📋 PLANNED

```typescript
// Monitoring system health check
export const monitoringHealthCheck = async () => {
	const checks = {
		cloudwatchAlarms: await checkCloudWatchAlarms(),
		logIngestion: await checkLogIngestion(),
		metricIngestion: await checkMetricIngestion(),
		alertDelivery: await checkAlertDelivery(),
	}

	const healthStatus = Object.values(checks).every((check) => check.healthy)

	if (!healthStatus) {
		// Send alert about monitoring system issues
		await sendMonitoringAlert(checks)
	}

	return { healthy: healthStatus, checks }
}

async function checkCloudWatchAlarms() {
	const cloudwatch = new CloudWatchClient({ region: 'us-east-1' })

	try {
		const alarms = await cloudwatch.send(new DescribeAlarmsCommand({}))
		const inAlarmState = alarms.MetricAlarms?.filter(
			(alarm) => alarm.StateValue === 'ALARM',
		)

		return {
			healthy: true,
			alarmsInAlarmState: inAlarmState?.length || 0,
		}
	} catch (error) {
		return {
			healthy: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}
```

## 📚 Related Documentation

- **[AWS Deployment](./aws-deployment.md)** - Infrastructure monitoring integration
- **[CI/CD Pipeline](./ci-cd-pipeline.md)** - Build and deployment monitoring
- **[Environment Setup](./environment-setup.md)** - Environment-specific monitoring configuration
- **[System Architecture](../architecture/system-architecture.md)** - Overall system monitoring strategy
- **[Incident Response](../operations/incident-response.md)** - Using monitoring data for incident response

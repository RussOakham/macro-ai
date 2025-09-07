import { Construct } from 'constructs'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import * as events_targets from 'aws-cdk-lib/aws-events-targets'
import { Duration } from 'aws-cdk-lib'

export interface UpstashMonitoringProps {
	environment: string
	upstashRestToken: string
	upstashRestUrl: string
	alertTopic?: sns.ITopic
	enableDetailedMonitoring?: boolean
	enablePerformanceAlerts?: boolean
}

export class UpstashMonitoringConstruct extends Construct {
	public readonly alarmTopic: sns.ITopic
	public readonly monitoringLambda: lambda.Function
	public readonly alarms: cloudwatch.Alarm[]
	public readonly dashboard: cloudwatch.Dashboard

	constructor(scope: Construct, id: string, props: UpstashMonitoringProps) {
		super(scope, id)

		this.alarms = []

		// Create SNS topic for alerts if not provided
		this.alarmTopic =
			props.alertTopic ||
			new sns.Topic(this, 'UpstashAlertTopic', {
				displayName: `${props.environment} Upstash Monitoring Alerts`,
				topicName: `${props.environment.toLowerCase()}-upstash-monitoring-alerts`,
			})

		// Create monitoring Lambda function
		this.monitoringLambda = this.createMonitoringLambda(props)

		// Schedule monitoring (every 5 minutes)
		this.scheduleMonitoring(props)

		// Create CloudWatch dashboard
		this.dashboard = this.createMonitoringDashboard(props)

		// Create performance alerts if enabled
		if (props.enablePerformanceAlerts) {
			this.createPerformanceAlerts(props)
		}
	}

	private createMonitoringLambda(
		props: UpstashMonitoringProps,
	): lambda.Function {
		const monitoringFunction = new lambda.Function(
			this,
			'UpstashMonitoringFunction',
			{
				runtime: lambda.Runtime.NODEJS_18_X,
				code: lambda.Code.fromAsset('src/lambda/upstash-monitoring'),
				handler: 'index.handler',
				timeout: Duration.seconds(30),
				environment: {
					UPSTASH_REST_TOKEN: props.upstashRestToken,
					UPSTASH_REST_URL: props.upstashRestUrl,
					ENVIRONMENT: props.environment,
					ENABLE_DETAILED_MONITORING: props.enableDetailedMonitoring
						? 'true'
						: 'false',
				},
			},
		)

		return monitoringFunction
	}

	private scheduleMonitoring(props: UpstashMonitoringProps): void {
		const rule = new events.Rule(this, 'UpstashMonitoringSchedule', {
			ruleName: `${props.environment}-upstash-monitoring-schedule`,
			description: 'Monitor Upstash Redis performance every 5 minutes',
			schedule: events.Schedule.rate(Duration.minutes(5)),
		})

		rule.addTarget(new events_targets.LambdaFunction(this.monitoringLambda))
	}

	private createPerformanceAlerts(props: UpstashMonitoringProps): void {
		const { environment } = props

		// Memory usage alert
		const memoryAlarm = new cloudwatch.Alarm(this, 'UpstashMemoryUsageAlarm', {
			alarmName: `${environment}-upstash-high-memory`,
			alarmDescription: `High memory usage in ${environment} Upstash Redis`,
			metric: new cloudwatch.Metric({
				namespace: 'Upstash/Monitoring',
				metricName: 'MemoryUsagePercent',
				dimensionsMap: {
					Environment: environment,
				},
				statistic: 'Maximum',
			}),
			threshold: 85, // 85% memory usage
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		memoryAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(memoryAlarm)

		// Connection count alert
		const connectionAlarm = new cloudwatch.Alarm(
			this,
			'UpstashConnectionCountAlarm',
			{
				alarmName: `${environment}-upstash-high-connections`,
				alarmDescription: `High number of connections to ${environment} Upstash Redis`,
				metric: new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'ConnectedClients',
					dimensionsMap: {
						Environment: environment,
					},
					statistic: 'Maximum',
				}),
				threshold: 100, // High connection count
				evaluationPeriods: 3,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)
		connectionAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(connectionAlarm)

		// Cache hit rate alert
		const hitRateAlarm = new cloudwatch.Alarm(this, 'UpstashHitRateAlarm', {
			alarmName: `${environment}-upstash-low-hit-rate`,
			alarmDescription: `Low cache hit rate in ${environment} Upstash Redis`,
			metric: new cloudwatch.Metric({
				namespace: 'Upstash/Monitoring',
				metricName: 'KeyspaceHitRate',
				dimensionsMap: {
					Environment: environment,
				},
				statistic: 'Average',
			}),
			threshold: 70, // Below 70% hit rate
			evaluationPeriods: 5,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		hitRateAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(hitRateAlarm)

		if (props.enableDetailedMonitoring) {
			// Eviction rate alert (memory pressure)
			const evictionAlarm = new cloudwatch.Alarm(this, 'UpstashEvictionAlarm', {
				alarmName: `${environment}-upstash-high-evictions`,
				alarmDescription: `High key eviction rate in ${environment} Upstash Redis`,
				metric: new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'EvictedKeysPerMinute',
					dimensionsMap: {
						Environment: environment,
					},
					statistic: 'Sum',
				}),
				threshold: 100, // More than 100 evictions per minute
				evaluationPeriods: 3,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			})
			evictionAlarm.addAlarmAction(
				new cloudwatch_actions.SnsAction(this.alarmTopic),
			)
			this.alarms.push(evictionAlarm)

			// Command rate alert
			const commandRateAlarm = new cloudwatch.Alarm(
				this,
				'UpstashCommandRateAlarm',
				{
					alarmName: `${environment}-upstash-high-commands`,
					alarmDescription: `Very high command rate in ${environment} Upstash Redis`,
					metric: new cloudwatch.Metric({
						namespace: 'Upstash/Monitoring',
						metricName: 'CommandsPerSecond',
						dimensionsMap: {
							Environment: environment,
						},
						statistic: 'Maximum',
					}),
					threshold: 1000, // More than 1000 commands per second
					evaluationPeriods: 3,
					comparisonOperator:
						cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
					treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
				},
			)
			commandRateAlarm.addAlarmAction(
				new cloudwatch_actions.SnsAction(this.alarmTopic),
			)
			this.alarms.push(commandRateAlarm)
		}
	}

	private createMonitoringDashboard(
		props: UpstashMonitoringProps,
	): cloudwatch.Dashboard {
		const { environment } = props

		const dashboard = new cloudwatch.Dashboard(
			this,
			'UpstashMonitoringDashboard',
			{
				dashboardName: `${environment}-upstash-monitoring-dashboard`,
			},
		)

		// Memory and connections
		const memoryWidget = new cloudwatch.GraphWidget({
			title: 'Upstash Redis Memory & Connections',
			left: [
				new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'MemoryUsagePercent',
					dimensionsMap: { Environment: environment },
					statistic: 'Maximum',
				}),
			],
			right: [
				new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'ConnectedClients',
					dimensionsMap: { Environment: environment },
					statistic: 'Maximum',
				}),
			],
			width: 12,
			height: 6,
		})

		// Cache performance
		const cacheWidget = new cloudwatch.GraphWidget({
			title: 'Upstash Cache Performance',
			left: [
				new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'KeyspaceHitRate',
					dimensionsMap: { Environment: environment },
					statistic: 'Average',
				}),
				new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'KeyspaceMissRate',
					dimensionsMap: { Environment: environment },
					statistic: 'Average',
				}),
			],
			width: 12,
			height: 6,
		})

		// Operations and evictions
		const operationsWidget = new cloudwatch.GraphWidget({
			title: 'Upstash Operations',
			left: [
				new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'CommandsPerSecond',
					dimensionsMap: { Environment: environment },
					statistic: 'Average',
				}),
			],
			right: [
				new cloudwatch.Metric({
					namespace: 'Upstash/Monitoring',
					metricName: 'EvictedKeysPerMinute',
					dimensionsMap: { Environment: environment },
					statistic: 'Sum',
				}),
			],
			width: 12,
			height: 6,
		})

		// Add widgets to dashboard
		dashboard.addWidgets(memoryWidget, cacheWidget, operationsWidget)

		// Add alarm status widget
		const alarmWidget = new cloudwatch.AlarmStatusWidget({
			title: 'Upstash Monitoring Alarms',
			alarms: this.alarms,
			width: 24,
			height: 4,
		})
		dashboard.addWidgets(alarmWidget)

		return dashboard
	}
}

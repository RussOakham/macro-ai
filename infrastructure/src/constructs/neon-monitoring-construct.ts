import { Construct } from 'constructs'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import * as events_targets from 'aws-cdk-lib/aws-events-targets'
import { Duration } from 'aws-cdk-lib'

export interface NeonMonitoringProps {
	environment: string
	neonConnectionString: string
	alertTopic?: sns.ITopic
	enableDetailedMonitoring?: boolean
	enablePerformanceAlerts?: boolean
}

export class NeonMonitoringConstruct extends Construct {
	public readonly alarmTopic: sns.ITopic
	public readonly monitoringLambda: lambda.Function
	public readonly alarms: cloudwatch.Alarm[]
	public readonly dashboard: cloudwatch.Dashboard

	constructor(scope: Construct, id: string, props: NeonMonitoringProps) {
		super(scope, id)

		this.alarms = []

		// Create SNS topic for alerts if not provided
		this.alarmTopic =
			props.alertTopic ||
			new sns.Topic(this, 'NeonAlertTopic', {
				displayName: `${props.environment} Neon Monitoring Alerts`,
				topicName: `${props.environment.toLowerCase()}-neon-monitoring-alerts`,
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

	private createMonitoringLambda(props: NeonMonitoringProps): lambda.Function {
		const monitoringFunction = new lambda.Function(
			this,
			'NeonMonitoringFunction',
			{
				runtime: lambda.Runtime.NODEJS_18_X,
				code: lambda.Code.fromAsset('src/lambda/neon-monitoring'),
				handler: 'index.handler',
				timeout: Duration.seconds(30),
				environment: {
					NEON_CONNECTION_STRING: props.neonConnectionString,
					ENVIRONMENT: props.environment,
					ENABLE_DETAILED_MONITORING: props.enableDetailedMonitoring
						? 'true'
						: 'false',
				},
			},
		)

		return monitoringFunction
	}

	private scheduleMonitoring(props: NeonMonitoringProps): void {
		const rule = new events.Rule(this, 'NeonMonitoringSchedule', {
			ruleName: `${props.environment}-neon-monitoring-schedule`,
			description: 'Monitor Neon database performance every 5 minutes',
			schedule: events.Schedule.rate(Duration.minutes(5)),
		})

		rule.addTarget(new events_targets.LambdaFunction(this.monitoringLambda))
	}

	private createPerformanceAlerts(props: NeonMonitoringProps): void {
		const { environment } = props

		// Connection count alert
		const connectionAlarm = new cloudwatch.Alarm(
			this,
			'NeonConnectionCountAlarm',
			{
				alarmName: `${environment}-neon-high-connections`,
				alarmDescription: `High number of active connections to ${environment} Neon database`,
				metric: new cloudwatch.Metric({
					namespace: 'Neon/Monitoring',
					metricName: 'ActiveConnections',
					dimensionsMap: {
						Environment: environment,
					},
					statistic: 'Maximum',
				}),
				threshold: 80, // 80% of connection limit
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

		// Query performance alert (slow queries)
		const slowQueryAlarm = new cloudwatch.Alarm(this, 'NeonSlowQueryAlarm', {
			alarmName: `${environment}-neon-slow-queries`,
			alarmDescription: `High number of slow queries in ${environment} Neon database`,
			metric: new cloudwatch.Metric({
				namespace: 'Neon/Monitoring',
				metricName: 'SlowQueriesPerMinute',
				dimensionsMap: {
					Environment: environment,
				},
				statistic: 'Sum',
			}),
			threshold: 10, // More than 10 slow queries per minute
			evaluationPeriods: 5,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		slowQueryAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(slowQueryAlarm)

		// Database size alert
		const dbSizeAlarm = new cloudwatch.Alarm(this, 'NeonDatabaseSizeAlarm', {
			alarmName: `${environment}-neon-large-database`,
			alarmDescription: `Neon database size approaching limit for ${environment}`,
			metric: new cloudwatch.Metric({
				namespace: 'Neon/Monitoring',
				metricName: 'DatabaseSizeGB',
				dimensionsMap: {
					Environment: environment,
				},
				statistic: 'Maximum',
			}),
			threshold: 0.8, // 80% of Neon free tier limit (1GB)
			evaluationPeriods: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		dbSizeAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(dbSizeAlarm)

		if (props.enableDetailedMonitoring) {
			// Lock wait time alert
			const lockWaitAlarm = new cloudwatch.Alarm(this, 'NeonLockWaitAlarm', {
				alarmName: `${environment}-neon-high-lock-wait`,
				alarmDescription: `High lock wait times in ${environment} Neon database`,
				metric: new cloudwatch.Metric({
					namespace: 'Neon/Monitoring',
					metricName: 'AverageLockWaitTime',
					dimensionsMap: {
						Environment: environment,
					},
					statistic: 'Average',
				}),
				threshold: 100, // 100ms average lock wait time
				evaluationPeriods: 3,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			})
			lockWaitAlarm.addAlarmAction(
				new cloudwatch_actions.SnsAction(this.alarmTopic),
			)
			this.alarms.push(lockWaitAlarm)
		}
	}

	private createMonitoringDashboard(
		props: NeonMonitoringProps,
	): cloudwatch.Dashboard {
		const { environment } = props

		const dashboard = new cloudwatch.Dashboard(
			this,
			'NeonMonitoringDashboard',
			{
				dashboardName: `${environment}-neon-monitoring-dashboard`,
			},
		)

		// Connection metrics
		const connectionWidget = new cloudwatch.GraphWidget({
			title: 'Neon Database Connections',
			left: [
				new cloudwatch.Metric({
					namespace: 'Neon/Monitoring',
					metricName: 'ActiveConnections',
					dimensionsMap: { Environment: environment },
					statistic: 'Maximum',
				}),
				new cloudwatch.Metric({
					namespace: 'Neon/Monitoring',
					metricName: 'IdleConnections',
					dimensionsMap: { Environment: environment },
					statistic: 'Average',
				}),
			],
			width: 12,
			height: 6,
		})

		// Performance metrics
		const performanceWidget = new cloudwatch.GraphWidget({
			title: 'Neon Query Performance',
			left: [
				new cloudwatch.Metric({
					namespace: 'Neon/Monitoring',
					metricName: 'AverageQueryTime',
					dimensionsMap: { Environment: environment },
					statistic: 'Average',
				}),
			],
			right: [
				new cloudwatch.Metric({
					namespace: 'Neon/Monitoring',
					metricName: 'SlowQueriesPerMinute',
					dimensionsMap: { Environment: environment },
					statistic: 'Sum',
				}),
			],
			width: 12,
			height: 6,
		})

		// Database size
		const sizeWidget = new cloudwatch.GraphWidget({
			title: 'Neon Database Size',
			left: [
				new cloudwatch.Metric({
					namespace: 'Neon/Monitoring',
					metricName: 'DatabaseSizeGB',
					dimensionsMap: { Environment: environment },
					statistic: 'Maximum',
				}),
			],
			width: 12,
			height: 6,
		})

		// Add widgets to dashboard
		dashboard.addWidgets(connectionWidget, performanceWidget, sizeWidget)

		// Add alarm status widget
		const alarmWidget = new cloudwatch.AlarmStatusWidget({
			title: 'Neon Monitoring Alarms',
			alarms: this.alarms,
			width: 24,
			height: 4,
		})
		dashboard.addWidgets(alarmWidget)

		return dashboard
	}
}

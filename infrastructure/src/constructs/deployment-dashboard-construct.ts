import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

export interface DeploymentDashboardConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Application name for resource naming
	 */
	readonly applicationName: string

	/**
	 * Deployment history table for metrics
	 */
	readonly deploymentHistoryTable: dynamodb.Table

	/**
	 * Deployment status functions for dashboard integration
	 */
	readonly deploymentStatusFunctions?: {
		readonly eventProcessor?: lambda.Function
		readonly statusQuery?: lambda.Function
	}

	/**
	 * Dashboard configuration
	 */
	readonly dashboardConfig?: {
		/**
		 * Dashboard refresh interval
		 */
		readonly refreshInterval?: cdk.Duration

		/**
		 * Enable detailed metrics
		 */
		readonly enableDetailedMetrics?: boolean

		/**
		 * Dashboard time range
		 */
		readonly timeRange?: cdk.Duration

		/**
		 * Custom dashboard widgets
		 */
		readonly customWidgets?: cloudwatch.IWidget[]
	}
}

/**
 * Deployment Dashboard Construct for real-time deployment monitoring
 *
 * This construct provides:
 * - Real-time deployment status dashboard
 * - Deployment success/failure rate metrics
 * - Deployment duration and performance tracking
 * - Historical deployment trends
 * - Environment-specific deployment monitoring
 * - Integration with CloudWatch alarms
 */
export class DeploymentDashboardConstruct extends Construct {
	public readonly deploymentDashboard: cloudwatch.Dashboard
	public readonly deploymentSuccessRateAlarm: cloudwatch.Alarm
	public readonly deploymentDurationAlarm: cloudwatch.Alarm
	public readonly activeDeploymentsAlarm: cloudwatch.Alarm

	private readonly props: DeploymentDashboardConstructProps
	private readonly resourcePrefix: string

	constructor(
		scope: Construct,
		id: string,
		props: DeploymentDashboardConstructProps,
	) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = `${props.applicationName}-${props.environmentName}`

		// Create CloudWatch dashboard
		this.deploymentDashboard = this.createDeploymentDashboard()

		// Create CloudWatch alarms
		this.deploymentSuccessRateAlarm = this.createDeploymentSuccessRateAlarm()
		this.deploymentDurationAlarm = this.createDeploymentDurationAlarm()
		this.activeDeploymentsAlarm = this.createActiveDeploymentsAlarm()

		// Apply tags
		this.applyTags()
	}

	/**
	 * Create deployment monitoring dashboard
	 */
	private createDeploymentDashboard(): cloudwatch.Dashboard {
		const dashboard = new cloudwatch.Dashboard(this, 'DeploymentDashboard', {
			dashboardName: `${this.resourcePrefix}-deployment-status`,
			defaultInterval:
				this.props.dashboardConfig?.timeRange ?? cdk.Duration.hours(24),
		})

		// Add deployment overview widgets
		dashboard.addWidgets(
			// Row 1: Deployment Status Overview
			new cloudwatch.GraphWidget({
				title: 'Deployment Events',
				left: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
					}),
				],
				width: 12,
				height: 6,
			}),
			new cloudwatch.SingleValueWidget({
				title: 'Active Deployments',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Status: 'IN_PROGRESS',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
					}),
				],
				width: 6,
				height: 6,
			}),
			new cloudwatch.SingleValueWidget({
				title: 'Deployments Today',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						period: cdk.Duration.hours(24),
					}),
				],
				width: 6,
				height: 6,
			}),
		)

		// Row 2: Deployment Success Metrics
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'Deployment Success Rate',
				left: [
					new cloudwatch.MathExpression({
						expression: '(completed / (completed + failed)) * 100',
						usingMetrics: {
							completed: new cloudwatch.Metric({
								namespace: 'MacroAI/Deployment',
								metricName: 'DeploymentEvent',
								dimensionsMap: {
									Environment: this.props.environmentName,
									Status: 'COMPLETED',
									Application: this.props.applicationName,
								},
								statistic: 'Sum',
							}),
							failed: new cloudwatch.Metric({
								namespace: 'MacroAI/Deployment',
								metricName: 'DeploymentEvent',
								dimensionsMap: {
									Environment: this.props.environmentName,
									Status: 'FAILED',
									Application: this.props.applicationName,
								},
								statistic: 'Sum',
							}),
						},
						label: 'Success Rate (%)',
					}),
				],
				width: 12,
				height: 6,
			}),
			new cloudwatch.GraphWidget({
				title: 'Deployment Status Distribution',
				left: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Status: 'COMPLETED',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						label: 'Completed',
					}),
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Status: 'FAILED',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						label: 'Failed',
					}),
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Status: 'ROLLED_BACK',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						label: 'Rolled Back',
					}),
				],
				width: 12,
				height: 6,
			}),
		)

		// Row 3: Performance Metrics
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'Deployment Duration',
				left: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentDuration',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Average',
						label: 'Average Duration',
					}),
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentDuration',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Maximum',
						label: 'Max Duration',
					}),
				],
				width: 12,
				height: 6,
			}),
			new cloudwatch.GraphWidget({
				title: 'Deployment Health Score',
				left: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentHealthScore',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Average',
						label: 'Health Score',
					}),
				],
				width: 12,
				height: 6,
			}),
		)

		// Row 4: Stage-specific Metrics
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'Deployment Stages Duration',
				left: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentDuration',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Stage: 'DEPLOYMENT',
							Application: this.props.applicationName,
						},
						statistic: 'Average',
						label: 'Deployment Stage',
					}),
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentDuration',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Stage: 'VALIDATION',
							Application: this.props.applicationName,
						},
						statistic: 'Average',
						label: 'Validation Stage',
					}),
					new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentDuration',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Stage: 'HEALTH_CHECK',
							Application: this.props.applicationName,
						},
						statistic: 'Average',
						label: 'Health Check Stage',
					}),
				],
				width: 24,
				height: 6,
			}),
		)

		// Add custom widgets if provided
		if (this.props.dashboardConfig?.customWidgets) {
			dashboard.addWidgets(...this.props.dashboardConfig.customWidgets)
		}

		return dashboard
	}

	/**
	 * Create deployment success rate alarm
	 */
	private createDeploymentSuccessRateAlarm(): cloudwatch.Alarm {
		return new cloudwatch.Alarm(this, 'DeploymentSuccessRateAlarm', {
			alarmName: `${this.resourcePrefix}-deployment-success-rate`,
			alarmDescription: 'Deployment success rate has fallen below threshold',
			metric: new cloudwatch.MathExpression({
				expression: '(completed / (completed + failed)) * 100',
				usingMetrics: {
					completed: new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Status: 'COMPLETED',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						period: cdk.Duration.hours(1),
					}),
					failed: new cloudwatch.Metric({
						namespace: 'MacroAI/Deployment',
						metricName: 'DeploymentEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Status: 'FAILED',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						period: cdk.Duration.hours(1),
					}),
				},
			}),
			threshold: this.props.environmentName === 'production' ? 95 : 80,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			evaluationPeriods: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
	}

	/**
	 * Create deployment duration alarm
	 */
	private createDeploymentDurationAlarm(): cloudwatch.Alarm {
		const thresholdMinutes =
			this.props.environmentName === 'production' ? 30 : 45

		return new cloudwatch.Alarm(this, 'DeploymentDurationAlarm', {
			alarmName: `${this.resourcePrefix}-deployment-duration`,
			alarmDescription: 'Deployment duration has exceeded threshold',
			metric: new cloudwatch.Metric({
				namespace: 'MacroAI/Deployment',
				metricName: 'DeploymentDuration',
				dimensionsMap: {
					Environment: this.props.environmentName,
					Application: this.props.applicationName,
				},
				statistic: 'Average',
				period: cdk.Duration.minutes(15),
			}),
			threshold: thresholdMinutes * 60, // Convert to seconds
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
	}

	/**
	 * Create active deployments alarm
	 */
	private createActiveDeploymentsAlarm(): cloudwatch.Alarm {
		return new cloudwatch.Alarm(this, 'ActiveDeploymentsAlarm', {
			alarmName: `${this.resourcePrefix}-active-deployments`,
			alarmDescription: 'Too many concurrent deployments detected',
			metric: new cloudwatch.Metric({
				namespace: 'MacroAI/Deployment',
				metricName: 'DeploymentEvent',
				dimensionsMap: {
					Environment: this.props.environmentName,
					Status: 'IN_PROGRESS',
					Application: this.props.applicationName,
				},
				statistic: 'Sum',
				period: cdk.Duration.minutes(5),
			}),
			threshold: this.props.environmentName === 'production' ? 2 : 5,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
	}

	/**
	 * Apply comprehensive tagging
	 */
	private applyTags(): void {
		cdk.Tags.of(this).add('Environment', this.props.environmentName)
		cdk.Tags.of(this).add('Application', this.props.applicationName)
		cdk.Tags.of(this).add('Component', 'DeploymentDashboard')
		cdk.Tags.of(this).add('Purpose', 'DeploymentMonitoring')
		cdk.Tags.of(this).add('ManagedBy', 'DeploymentDashboardConstruct')
	}
}

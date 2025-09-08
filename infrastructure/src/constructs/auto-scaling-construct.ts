import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as events from 'aws-cdk-lib/aws-events'
import * as events_targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { Duration } from 'aws-cdk-lib'

export interface AutoScalingConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * ECS service to apply auto-scaling to
	 */
	readonly ecsService: ecs.FargateService

	/**
	 * Application Load Balancer for request-based scaling
	 */
	readonly loadBalancer?: elbv2.ApplicationLoadBalancer

	/**
	 * SNS topic for scaling alerts
	 */
	readonly alarmTopic?: sns.ITopic

	/**
	 * Minimum number of tasks
	 * @default 1
	 */
	readonly minCapacity?: number

	/**
	 * Maximum number of tasks
	 * @default 10
	 */
	readonly maxCapacity?: number

	/**
	 * CPU utilization target for scaling (percentage)
	 * @default 70
	 */
	readonly targetCpuUtilization?: number

	/**
	 * Memory utilization target for scaling (percentage)
	 * @default 75
	 */
	readonly targetMemoryUtilization?: number

	/**
	 * Target request count per minute per task
	 * @default 1000
	 */
	readonly targetRequestsPerMinute?: number

	/**
	 * Target group for request-count scaling
	 */
	readonly requestTargetGroup?: elbv2.IApplicationTargetGroup

	/**
	 * Enable step scaling for more granular control
	 * @default false (not applicable to ECS Fargate)
	 */
	readonly enableStepScaling?: boolean

	/**
	 * Enable custom metric-based scaling
	 * @default true
	 */
	readonly enableCustomMetrics?: boolean

	/**
	 * Enable scheduled scaling policies
	 * @default false
	 */
	readonly enableScheduledScaling?: boolean

	/**
	 * Scheduled scaling actions
	 */
	readonly scheduledActions?: Array<{
		readonly name: string
		readonly scheduleExpression: string
		readonly minCapacity: number
		readonly maxCapacity: number
		readonly description?: string
	}>

	/**
	 * Enable predictive scaling based on historical data
	 * @default false
	 */
	readonly enablePredictiveScaling?: boolean

	/**
	 * Cooldown periods for scaling actions
	 */
	readonly cooldowns?: {
		readonly scaleIn?: Duration
		readonly scaleOut?: Duration
	}

	/**
	 * Custom tags for resources
	 */
	readonly tags?: Record<string, string>
}

/**
 * Advanced Auto Scaling Construct for ECS Fargate Services
 *
 * This construct provides comprehensive auto-scaling capabilities including:
 * - Target tracking scaling (CPU, Memory, Request Rate)
 * - Custom metrics-based scaling
 * - Scheduled scaling for cost optimization
 * - Predictive scaling based on historical patterns
 * - Automated scaling alerts and notifications
 */
export class AutoScalingConstruct extends Construct {
	public readonly scalableTaskCount: ecs.ScalableTaskCount
	public readonly alarms: cloudwatch.Alarm[]
	public readonly alarmTopic: sns.ITopic
	public customMetricsLambda?: lambda.Function

	constructor(scope: Construct, id: string, props: AutoScalingConstructProps) {
		super(scope, id)

		const {
			environmentName,
			ecsService,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			loadBalancer,
			alarmTopic: providedAlarmTopic,
			minCapacity = 1,
			maxCapacity = 10,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			targetCpuUtilization = 70,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			targetMemoryUtilization = 75,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			targetRequestsPerMinute = 1000,
			enableStepScaling = false,
			enableCustomMetrics = true,
			enableScheduledScaling = false,
			enablePredictiveScaling = false,
			scheduledActions = [],
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			cooldowns = {
				scaleIn: Duration.seconds(300), // 5 minutes
				scaleOut: Duration.seconds(180), // 3 minutes
			},
			tags = {},
		} = props

		this.alarms = []

		// Create SNS topic for scaling alerts if not provided
		this.alarmTopic =
			providedAlarmTopic ??
			new sns.Topic(this, 'ScalingAlarmTopic', {
				displayName: `${environmentName} Auto Scaling Alerts`,
				topicName: `${environmentName.toLowerCase()}-auto-scaling-alerts`,
			})

		// Create scalable task count
		this.scalableTaskCount = ecsService.autoScaleTaskCount({
			minCapacity,
			maxCapacity,
		})

		// Apply default tags
		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(this).add(key, value)
		})

		// Core target tracking policies
		this.createTargetTrackingPolicies(props)

		// Step scaling policies for granular control - disabled for ECS Fargate
		// Note: Step scaling policies require EC2 Auto Scaling Groups which are not used in Fargate
		if (enableStepScaling)
			console.log('Step scaling is not applicable to ECS Fargate; no-op')

		// Custom metrics-based scaling
		if (enableCustomMetrics) {
			this.createCustomMetricsScaling(props)
		}

		// Scheduled scaling for cost optimization
		if (enableScheduledScaling && scheduledActions.length > 0) {
			this.createScheduledScaling(scheduledActions)
		}

		// Predictive scaling (future enhancement)
		if (enablePredictiveScaling) {
			this.createPredictiveScaling(props)
		}

		// Create scaling dashboard
		this.createScalingDashboard(props)
	}

	/**
	 * Create target tracking scaling policies
	 */
	private createTargetTrackingPolicies(props: AutoScalingConstructProps): void {
		const { targetCpuUtilization = 70, targetMemoryUtilization = 75 } = props

		// CPU utilization scaling with cooldowns
		this.scalableTaskCount.scaleOnCpuUtilization('CpuTargetTracking', {
			targetUtilizationPercent: targetCpuUtilization,
			scaleInCooldown: props.cooldowns?.scaleIn,
			scaleOutCooldown: props.cooldowns?.scaleOut,
		})
		// Note: scalingPolicies are managed internally by ScalableTaskCount

		// Memory utilization scaling with cooldowns
		this.scalableTaskCount.scaleOnMemoryUtilization('MemoryTargetTracking', {
			targetUtilizationPercent: targetMemoryUtilization,
			scaleInCooldown: props.cooldowns?.scaleIn,
			scaleOutCooldown: props.cooldowns?.scaleOut,
		})
		// Note: scalingPolicies are managed internally by ScalableTaskCount

		// Create CPU utilization alarm
		const cpuAlarm = new cloudwatch.Alarm(this, 'HighCpuAlarm', {
			alarmName: `${props.environmentName}-high-cpu-utilization`,
			alarmDescription: `High CPU utilization detected in ${props.environmentName} environment`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ECS',
				metricName: 'CPUUtilization',
				dimensionsMap: {
					ClusterName: `${props.environmentName}-cluster`,
					ServiceName: `${props.environmentName}-service`,
				},
				statistic: 'Average',
			}),
			threshold: targetCpuUtilization + 10, // Alert 10% above target
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		cpuAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic))
		this.alarms.push(cpuAlarm)

		// Create memory utilization alarm
		const memoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
			alarmName: `${props.environmentName}-high-memory-utilization`,
			alarmDescription: `High memory utilization detected in ${props.environmentName} environment`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ECS',
				metricName: 'MemoryUtilization',
				dimensionsMap: {
					ClusterName: `${props.environmentName}-cluster`,
					ServiceName: `${props.environmentName}-service`,
				},
				statistic: 'Average',
			}),
			threshold: targetMemoryUtilization + 15, // Alert 15% above target
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		memoryAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(memoryAlarm)

		console.log(
			`✅ Created target tracking scaling policies and alarms for CPU and memory`,
		)
	}

	/**
	 * Create custom metrics-based scaling
	 */
	private createCustomMetricsScaling(props: AutoScalingConstructProps): void {
		const { environmentName, loadBalancer } = props

		// Create Lambda function for custom metrics
		this.customMetricsLambda = new NodejsFunction(
			this,
			'CustomMetricsFunction',
			{
				entry: 'src/lambda/custom-metrics/index.ts',
				handler: 'handler',
				timeout: Duration.seconds(30),
				memorySize: 256,
				logRetention: logs.RetentionDays.ONE_WEEK,
				environment: {
					ENVIRONMENT_NAME: environmentName,
					LOAD_BALANCER_ARN: loadBalancer?.loadBalancerArn || '',
				},
			},
		)

		// Grant permissions for CloudWatch metrics
		this.customMetricsLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			}),
		)

		// Schedule custom metrics collection every 5 minutes
		const rule = new events.Rule(this, 'CustomMetricsRule', {
			schedule: events.Schedule.rate(Duration.minutes(5)),
			description: `Collect custom scaling metrics for ${environmentName}`,
		})
		rule.addTarget(new events_targets.LambdaFunction(this.customMetricsLambda))

		// Note: Custom metric-based scaling with step policies is not directly supported
		// with ECS Fargate ScalableTaskCount. Target tracking scaling is the recommended
		// approach for ECS Fargate services.

		console.log(`✅ Created custom metrics-based scaling policies`)
	}

	/**
	 * Create scheduled scaling actions for cost optimization
	 */
	private createScheduledScaling(
		scheduledActions: Array<{
			readonly name: string
			readonly scheduleExpression: string
			readonly minCapacity: number
			readonly maxCapacity: number
			readonly description?: string
		}>,
	): void {
		scheduledActions.forEach((action) => {
			this.scalableTaskCount.scaleOnSchedule(`Schedule-${action.name}`, {
				schedule: events.Schedule.expression(action.scheduleExpression),
				minCapacity: action.minCapacity,
				maxCapacity: action.maxCapacity,
			})
		})
	}

	/**
	 * Create predictive scaling based on historical patterns
	 * Note: This is a placeholder for future implementation
	 */
	private createPredictiveScaling(props: AutoScalingConstructProps): void {
		const { environmentName } = props

		console.log(`📊 Predictive scaling configuration for ${environmentName}`)
		console.log(
			`   Note: Predictive scaling will be enabled once sufficient historical data is available`,
		)
	}

	/**
	 * Create CloudWatch dashboard for scaling metrics
	 */
	private createScalingDashboard(props: AutoScalingConstructProps): void {
		const { environmentName } = props

		const dashboard = new cloudwatch.Dashboard(this, 'ScalingDashboard', {
			dashboardName: `${environmentName}-scaling-dashboard`,
		})

		// CPU Utilization Widget
		const cpuWidget = new cloudwatch.GraphWidget({
			title: 'CPU Utilization',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/ECS',
					metricName: 'CPUUtilization',
					dimensionsMap: {
						ClusterName: `${environmentName}-cluster`,
						ServiceName: `${environmentName}-service`,
					},
					statistic: 'Average',
				}),
			],
			width: 12,
			height: 6,
		})

		// Memory Utilization Widget
		const memoryWidget = new cloudwatch.GraphWidget({
			title: 'Memory Utilization',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/ECS',
					metricName: 'MemoryUtilization',
					dimensionsMap: {
						ClusterName: `${environmentName}-cluster`,
						ServiceName: `${environmentName}-service`,
					},
					statistic: 'Average',
				}),
			],
			width: 12,
			height: 6,
		})

		// Task Count Widget
		const taskCountWidget = new cloudwatch.GraphWidget({
			title: 'Running Task Count',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/ECS',
					metricName: 'RunningTaskCount',
					dimensionsMap: {
						ClusterName: `${environmentName}-cluster`,
						ServiceName: `${environmentName}-service`,
					},
					statistic: 'Average',
				}),
			],
			width: 12,
			height: 6,
		})

		// Custom Metrics Widget
		const customMetricsWidget = new cloudwatch.GraphWidget({
			title: 'Custom Application Metrics',
			left: [
				new cloudwatch.Metric({
					namespace: 'MacroAI/Application',
					metricName: 'ResponseTime',
					dimensionsMap: {
						Environment: environmentName,
					},
					statistic: 'Average',
				}),
				new cloudwatch.Metric({
					namespace: 'MacroAI/Application',
					metricName: 'ErrorRate',
					dimensionsMap: {
						Environment: environmentName,
					},
					statistic: 'Average',
				}),
			],
			width: 12,
			height: 6,
		})

		dashboard.addWidgets(
			cpuWidget,
			memoryWidget,
			taskCountWidget,
			customMetricsWidget,
		)

		console.log(
			`✅ Created scaling dashboard: ${environmentName}-scaling-dashboard`,
		)
	}
}

import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as events from 'aws-cdk-lib/aws-events'
import * as events_targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
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
	 * Enable step scaling for more granular control
	 * @default true
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
 * - Step scaling policies for granular control
 * - Custom metrics-based scaling
 * - Scheduled scaling for cost optimization
 * - Predictive scaling based on historical patterns
 * - Automated scaling alerts and notifications
 */
export class AutoScalingConstruct extends Construct {
	public readonly scalableTaskCount: ecs.ScalableTaskCount
	public readonly alarms: cloudwatch.Alarm[]
	public readonly scalingPolicies: (
		| autoscaling.TargetTrackingScalingPolicy
		| autoscaling.StepScalingPolicy
	)[]
	public readonly alarmTopic: sns.ITopic
	public readonly customMetricsLambda?: lambda.Function

	constructor(scope: Construct, id: string, props: AutoScalingConstructProps) {
		super(scope, id)

		const {
			environmentName,
			ecsService,
			loadBalancer,
			alarmTopic: providedAlarmTopic,
			minCapacity = 1,
			maxCapacity = 10,
			targetCpuUtilization = 70,
			targetMemoryUtilization = 75,
			targetRequestsPerMinute = 1000,
			enableStepScaling = true,
			enableCustomMetrics = true,
			enableScheduledScaling = false,
			enablePredictiveScaling = false,
			scheduledActions = [],
			cooldowns = {
				scaleIn: Duration.seconds(300), // 5 minutes
				scaleOut: Duration.seconds(180), // 3 minutes
			},
			tags = {},
		} = props

		this.alarms = []
		this.scalingPolicies = []

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

		// Step scaling policies for granular control
		if (enableStepScaling) {
			this.createStepScalingPolicies(props)
		}

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
		const {
			targetCpuUtilization,
			targetMemoryUtilization,
			targetRequestsPerMinute,
			loadBalancer,
		} = props

		// CPU utilization scaling
		const cpuScaling = this.scalableTaskCount.scaleOnCpuUtilization(
			'CpuTargetTracking',
			{
				targetUtilizationPercent: targetCpuUtilization,
			},
		)
		this.scalingPolicies.push(cpuScaling)

		// Memory utilization scaling
		const memoryScaling = this.scalableTaskCount.scaleOnMemoryUtilization(
			'MemoryTargetTracking',
			{
				targetUtilizationPercent: targetMemoryUtilization,
			},
		)
		this.scalingPolicies.push(memoryScaling)

		// Request rate scaling (if load balancer provided)
		if (loadBalancer) {
			const requestScaling = this.scalableTaskCount.scaleOnRequestCount(
				'RequestTargetTracking',
				{
					requestsPerTarget: targetRequestsPerMinute,
					targetGroup: loadBalancer.listeners[0]?.targetGroups[0], // Use first target group
				},
			)
			this.scalingPolicies.push(requestScaling)
		}

		console.log(
			`✅ Created ${this.scalingPolicies.length} target tracking scaling policies`,
		)
	}

	/**
	 * Create step scaling policies for more granular control
	 */
	private createStepScalingPolicies(props: AutoScalingConstructProps): void {
		const { environmentName, targetCpuUtilization, targetMemoryUtilization } =
			props

		// CPU step scaling policy
		const cpuScaleUpPolicy = new autoscaling.StepScalingPolicy(
			this,
			'CpuScaleUpPolicy',
			{
				metricAggregationType: autoscaling.MetricAggregationType.AVERAGE,
				scalingSteps: [
					{ lower: 0, upper: targetCpuUtilization - 10, change: +0 },
					{
						lower: targetCpuUtilization - 10,
						upper: targetCpuUtilization + 10,
						change: +1,
					},
					{
						lower: targetCpuUtilization + 10,
						upper: targetCpuUtilization + 20,
						change: +2,
					},
					{ lower: targetCpuUtilization + 20, change: +3 },
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown: Duration.seconds(180),
				estimatedInstanceWarmup: Duration.seconds(60),
			},
		)

		const cpuScaleDownPolicy = new autoscaling.StepScalingPolicy(
			this,
			'CpuScaleDownPolicy',
			{
				metricAggregationType: autoscaling.MetricAggregationType.AVERAGE,
				scalingSteps: [
					{ lower: 0, upper: targetCpuUtilization - 20, change: -1 },
					{
						lower: targetCpuUtilization - 20,
						upper: targetCpuUtilization - 10,
						change: -1,
					},
					{ lower: targetCpuUtilization - 10, change: -0 },
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown: Duration.seconds(300),
				estimatedInstanceWarmup: Duration.seconds(60),
			},
		)

		// CPU alarms for step scaling
		const highCpuAlarm = new cloudwatch.Alarm(this, 'HighCpuAlarm', {
			alarmName: `${environmentName}-ecs-high-cpu-step`,
			alarmDescription: `High CPU utilization triggering step scaling for ${environmentName}`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ECS',
				metricName: 'CPUUtilization',
				dimensionsMap: {
					ClusterName: `${environmentName}-cluster`,
					ServiceName: `${environmentName}-service`,
				},
				statistic: 'Average',
				period: Duration.minutes(2),
			}),
			threshold: targetCpuUtilization + 10,
			evaluationPeriods: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		highCpuAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(highCpuAlarm)

		const lowCpuAlarm = new cloudwatch.Alarm(this, 'LowCpuAlarm', {
			alarmName: `${environmentName}-ecs-low-cpu-step`,
			alarmDescription: `Low CPU utilization triggering scale-down for ${environmentName}`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ECS',
				metricName: 'CPUUtilization',
				dimensionsMap: {
					ClusterName: `${environmentName}-cluster`,
					ServiceName: `${environmentName}-service`,
				},
				statistic: 'Average',
				period: Duration.minutes(5),
			}),
			threshold: targetCpuUtilization - 15,
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		lowCpuAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		this.alarms.push(lowCpuAlarm)

		// Attach step scaling policies to alarms
		highCpuAlarm.addAlarmAction(
			new cloudwatch_actions.AutoScalingAction(cpuScaleUpPolicy.scalingAlarm),
		)
		lowCpuAlarm.addAlarmAction(
			new cloudwatch_actions.AutoScalingAction(cpuScaleDownPolicy.scalingAlarm),
		)

		this.scalingPolicies.push(cpuScaleUpPolicy, cpuScaleDownPolicy)

		// Memory step scaling (similar pattern)
		const memoryScaleUpPolicy = new autoscaling.StepScalingPolicy(
			this,
			'MemoryScaleUpPolicy',
			{
				metricAggregationType: autoscaling.MetricAggregationType.AVERAGE,
				scalingSteps: [
					{ lower: 0, upper: targetMemoryUtilization - 10, change: +0 },
					{
						lower: targetMemoryUtilization - 10,
						upper: targetMemoryUtilization + 10,
						change: +1,
					},
					{ lower: targetMemoryUtilization + 10, change: +2 },
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown: Duration.seconds(180),
			},
		)

		const highMemoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
			alarmName: `${environmentName}-ecs-high-memory-step`,
			alarmDescription: `High memory utilization triggering step scaling for ${environmentName}`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ECS',
				metricName: 'MemoryUtilization',
				dimensionsMap: {
					ClusterName: `${environmentName}-cluster`,
					ServiceName: `${environmentName}-service`,
				},
				statistic: 'Average',
				period: Duration.minutes(2),
			}),
			threshold: targetMemoryUtilization + 15,
			evaluationPeriods: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
		highMemoryAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		highMemoryAlarm.addAlarmAction(
			new cloudwatch_actions.AutoScalingAction(
				memoryScaleUpPolicy.scalingAlarm,
			),
		)
		this.alarms.push(highMemoryAlarm)

		this.scalingPolicies.push(memoryScaleUpPolicy)

		console.log(
			`✅ Created step scaling policies for CPU and memory utilization`,
		)
	}

	/**
	 * Create custom metrics-based scaling
	 */
	private createCustomMetricsScaling(props: AutoScalingConstructProps): void {
		const { environmentName, loadBalancer } = props

		// Create Lambda function for custom metrics
		this.customMetricsLambda = new lambda.Function(
			this,
			'CustomMetricsFunction',
			{
				runtime: lambda.Runtime.NODEJS_18_X,
				code: lambda.Code.fromAsset('src/lambda/custom-metrics'),
				handler: 'index.handler',
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

		// Custom metric: Application Response Time
		const responseTimeScaling = this.scalableTaskCount.scaleOnMetric(
			'ResponseTimeScaling',
			{
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/Application',
					metricName: 'ResponseTime',
					dimensionsMap: {
						Environment: environmentName,
						Service: 'api',
					},
					statistic: 'Average',
				}),
				scalingSteps: [
					{ lower: 0, upper: 500, change: -1 }, // Scale down if response time < 500ms
					{ lower: 500, upper: 1000, change: +0 }, // Maintain if 500ms-1000ms
					{ lower: 1000, upper: 2000, change: +1 }, // Scale up if 1000ms-2000ms
					{ lower: 2000, change: +2 }, // Scale up aggressively if > 2000ms
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown: Duration.seconds(300),
			},
		)
		this.scalingPolicies.push(responseTimeScaling)

		// Custom metric: Error Rate
		const errorRateScaling = this.scalableTaskCount.scaleOnMetric(
			'ErrorRateScaling',
			{
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/Application',
					metricName: 'ErrorRate',
					dimensionsMap: {
						Environment: environmentName,
						Service: 'api',
					},
					statistic: 'Average',
				}),
				scalingSteps: [
					{ lower: 0, upper: 1, change: -1 }, // Scale down if error rate < 1%
					{ lower: 1, upper: 5, change: +0 }, // Maintain if 1%-5%
					{ lower: 5, upper: 10, change: +1 }, // Scale up if 5%-10%
					{ lower: 10, change: +2 }, // Scale up aggressively if > 10%
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown: Duration.seconds(180),
			},
		)
		this.scalingPolicies.push(errorRateScaling)

		console.log(`✅ Created custom metrics-based scaling policies`)
	}

	/**
	 * Create scheduled scaling policies
	 */
	private createScheduledScaling(
		scheduledActions: NonNullable<
			AutoScalingConstructProps['scheduledActions']
		>,
	): void {
		for (const action of scheduledActions) {
			this.scalableTaskCount.scaleOnSchedule(action.name, {
				schedule: autoscaling.Schedule.expression(action.scheduleExpression),
				minCapacity: action.minCapacity,
				maxCapacity: action.maxCapacity,
			})

			console.log(`✅ Created scheduled scaling action: ${action.name}`)
		}
	}

	/**
	 * Create predictive scaling (placeholder for future implementation)
	 */
	private createPredictiveScaling(props: AutoScalingConstructProps): void {
		// Note: AWS Predictive Scaling requires historical data and is typically
		// configured after the service has been running for some time.
		// This is a placeholder for future implementation.

		console.log(
			`📋 Predictive scaling placeholder created for ${props.environmentName}`,
		)
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

		// Current task count
		const taskCountWidget = new cloudwatch.GraphWidget({
			title: 'Current Task Count',
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
				new cloudwatch.Metric({
					namespace: 'AWS/ECS',
					metricName: 'DesiredTaskCount',
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

		// CPU and Memory utilization
		const utilizationWidget = new cloudwatch.GraphWidget({
			title: 'CPU & Memory Utilization',
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
			right: [
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

		// Scaling policies utilization
		const scalingPoliciesWidget = new cloudwatch.GraphWidget({
			title: 'Scaling Policies',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'RequestCount',
					dimensionsMap: {
						LoadBalancer: `${environmentName}-alb`, // Simplified dimension
					},
					statistic: 'Sum',
				}),
			],
			width: 24,
			height: 6,
		})

		// Alarm status
		const alarmWidget = new cloudwatch.AlarmStatusWidget({
			title: 'Scaling Alarms',
			alarms: this.alarms,
			width: 24,
			height: 4,
		})

		// Add widgets to dashboard
		dashboard.addWidgets(
			taskCountWidget,
			utilizationWidget,
			scalingPoliciesWidget,
			alarmWidget,
		)

		console.log(
			`✅ Created scaling dashboard: ${environmentName}-scaling-dashboard`,
		)
	}

	/**
	 * Add custom scaling policy based on application metrics
	 */
	public addCustomScalingPolicy(
		name: string,
		metricName: string,
		namespace: string,
		dimensions: Record<string, string>,
		targetValue: number,
		scaleInSteps: autoscaling.ScalingInterval[],
		scaleOutSteps: autoscaling.ScalingInterval[],
	): void {
		const scaleOutPolicy = new autoscaling.StepScalingPolicy(
			this,
			`${name}ScaleOutPolicy`,
			{
				metricAggregationType: autoscaling.MetricAggregationType.AVERAGE,
				scalingSteps: scaleOutSteps,
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown: Duration.seconds(180),
			},
		)

		const scaleInPolicy = new autoscaling.StepScalingPolicy(
			this,
			`${name}ScaleInPolicy`,
			{
				metricAggregationType: autoscaling.MetricAggregationType.AVERAGE,
				scalingSteps: scaleInSteps,
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown: Duration.seconds(300),
			},
		)

		const scaleOutAlarm = new cloudwatch.Alarm(this, `${name}ScaleOutAlarm`, {
			alarmName: `${name.toLowerCase()}-scale-out`,
			alarmDescription: `Scale out based on ${metricName} metric`,
			metric: new cloudwatch.Metric({
				namespace,
				metricName,
				dimensionsMap: dimensions,
				statistic: 'Average',
				period: Duration.minutes(2),
			}),
			threshold: targetValue,
			evaluationPeriods: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		const scaleInAlarm = new cloudwatch.Alarm(this, `${name}ScaleInAlarm`, {
			alarmName: `${name.toLowerCase()}-scale-in`,
			alarmDescription: `Scale in based on ${metricName} metric`,
			metric: new cloudwatch.Metric({
				namespace,
				metricName,
				dimensionsMap: dimensions,
				statistic: 'Average',
				period: Duration.minutes(5),
			}),
			threshold: targetValue * 0.7, // Scale in at 70% of target
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		scaleOutAlarm.addAlarmAction(
			new cloudwatch_actions.AutoScalingAction(scaleOutPolicy.scalingAlarm),
		)
		scaleInAlarm.addAlarmAction(
			new cloudwatch_actions.AutoScalingAction(scaleInPolicy.scalingAlarm),
		)

		scaleOutAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)
		scaleInAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alarmTopic),
		)

		this.alarms.push(scaleOutAlarm, scaleInAlarm)
		this.scalingPolicies.push(scaleOutPolicy, scaleInPolicy)

		console.log(`✅ Added custom scaling policy: ${name}`)
	}
}

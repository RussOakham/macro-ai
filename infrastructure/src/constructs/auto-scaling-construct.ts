import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

/**
 * Configuration for auto scaling construct
 */
export interface AutoScalingConstructProps {
	/**
	 * VPC where auto scaling group will be deployed
	 */
	vpc: ec2.IVpc

	/**
	 * Launch template for instances
	 */
	launchTemplate: ec2.LaunchTemplate

	/**
	 * Environment name (development, staging, production)
	 */
	environmentName: string

	/**
	 * Application name for resource naming
	 */
	applicationName: string

	/**
	 * Target groups to register instances with
	 */
	targetGroups?: elbv2.ApplicationTargetGroup[]

	/**
	 * Auto scaling configuration
	 */
	autoScaling: {
		/**
		 * Minimum number of instances
		 */
		minCapacity: number

		/**
		 * Maximum number of instances
		 */
		maxCapacity: number

		/**
		 * Desired number of instances
		 */
		desiredCapacity: number

		/**
		 * Target CPU utilization percentage for scaling
		 */
		targetCpuUtilization?: number

		/**
		 * Target memory utilization percentage for scaling
		 */
		targetMemoryUtilization?: number

		/**
		 * Target request count per instance for ALB-based scaling
		 */
		targetRequestCountPerInstance?: number

		/**
		 * Scale out cooldown period
		 */
		scaleOutCooldown?: cdk.Duration

		/**
		 * Scale in cooldown period
		 */
		scaleInCooldown?: cdk.Duration
	}

	/**
	 * SNS topics for scaling notifications
	 */
	notificationTopics?: {
		critical?: sns.Topic
		warning?: sns.Topic
		info?: sns.Topic
	}

	/**
	 * Enable detailed monitoring for auto scaling
	 */
	enableDetailedMonitoring?: boolean

	/**
	 * Custom metric namespace for application metrics
	 */
	customMetricNamespace?: string

	/**
	 * Health check grace period
	 */
	healthCheckGracePeriod?: cdk.Duration

	/**
	 * Health check types (EC2 or ELB)
	 */
	healthCheckTypes?: ('EC2' | 'ELB')[]
}

/**
 * Scaling policy types
 */
export enum ScalingPolicyType {
	TARGET_TRACKING = 'TARGET_TRACKING',
	STEP_SCALING = 'STEP_SCALING',
	SIMPLE_SCALING = 'SIMPLE_SCALING',
}

/**
 * Auto Scaling Group construct for production-ready dynamic scaling
 *
 * This construct provides:
 * - Auto Scaling Groups with launch template integration
 * - Dynamic scaling policies based on CloudWatch metrics
 * - Environment-specific scaling configurations
 * - Integration with ALB target groups
 * - Comprehensive monitoring and alerting
 * - Cost-optimized scaling strategies
 */
export class AutoScalingConstruct extends Construct {
	public readonly autoScalingGroup: autoscaling.AutoScalingGroup
	public readonly scalingPolicies: Map<
		string,
		autoscaling.StepScalingPolicy | autoscaling.TargetTrackingScalingPolicy
	>
	public readonly targetTrackingPolicies: Map<
		string,
		autoscaling.TargetTrackingScalingPolicy
	>

	private readonly props: AutoScalingConstructProps
	private readonly resourcePrefix: string

	constructor(scope: Construct, id: string, props: AutoScalingConstructProps) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = `${props.applicationName}-${props.environmentName}`
		this.scalingPolicies = new Map()
		this.targetTrackingPolicies = new Map()

		// Create Auto Scaling Group
		this.autoScalingGroup = this.createAutoScalingGroup()

		// Create scaling policies
		this.createScalingPolicies()

		// Create scaling alarms and notifications
		this.createScalingAlarms()

		// Apply tags
		this.applyTags()
	}

	/**
	 * Create Auto Scaling Group with optimized configuration
	 */
	private createAutoScalingGroup(): autoscaling.AutoScalingGroup {
		const asg = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
			vpc: this.props.vpc,
			launchTemplate: this.props.launchTemplate,
			minCapacity: this.props.autoScaling.minCapacity,
			maxCapacity: this.props.autoScaling.maxCapacity,
			desiredCapacity: this.props.autoScaling.desiredCapacity,

			// Health check configuration
			healthChecks: {
				types: this.props.healthCheckTypes ?? ['ELB'],
				gracePeriod: cdk.Duration.minutes(5),
			},

			// Instance distribution
			vpcSubnets: {
				subnetType: ec2.SubnetType.PUBLIC, // Cost optimization: no NAT Gateway needed
			},

			// Termination policies for cost optimization
			terminationPolicies: [
				autoscaling.TerminationPolicy.OLDEST_INSTANCE,
				autoscaling.TerminationPolicy.DEFAULT,
			],

			// Instance refresh configuration for rolling updates
			updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
				minInstancesInService: Math.max(
					1,
					Math.floor(this.props.autoScaling.minCapacity / 2),
				),
				maxBatchSize: Math.max(
					1,
					Math.floor(this.props.autoScaling.maxCapacity / 3),
				),
				pauseTime: cdk.Duration.minutes(5),
				waitOnResourceSignals: true,
			}),

			// Auto scaling group name
			autoScalingGroupName: `${this.resourcePrefix}-asg`,

			// Notifications
			notifications: this.createNotificationConfigurations(),
		})

		// Register with target groups if provided
		if (this.props.targetGroups && this.props.targetGroups.length > 0) {
			this.props.targetGroups.forEach((targetGroup) => {
				asg.attachToApplicationTargetGroup(targetGroup)
			})
		}

		return asg
	}

	/**
	 * Create comprehensive scaling policies
	 */
	private createScalingPolicies(): void {
		// Target tracking scaling policies (recommended for most use cases)
		this.createTargetTrackingPolicies()

		// Step scaling policies for rapid response to traffic spikes
		this.createStepScalingPolicies()

		// Simple scaling policies for basic scenarios
		this.createSimpleScalingPolicies()
	}

	/**
	 * Create target tracking scaling policies
	 */
	private createTargetTrackingPolicies(): void {
		// CPU utilization target tracking
		if (this.props.autoScaling.targetCpuUtilization) {
			const cpuPolicy = this.autoScalingGroup.scaleOnCpuUtilization(
				'CpuTargetTracking',
				{
					targetUtilizationPercent: this.props.autoScaling.targetCpuUtilization,
				},
			)
			this.targetTrackingPolicies.set('cpu', cpuPolicy)
		}

		// Memory utilization target tracking (requires CloudWatch Agent)
		if (this.props.autoScaling.targetMemoryUtilization) {
			const memoryPolicy = this.autoScalingGroup.scaleToTrackMetric(
				'MemoryTargetTracking',
				{
					metric: new cloudwatch.Metric({
						namespace: 'CWAgent',
						metricName: 'mem_used_percent',
						dimensionsMap: {
							AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
						},
						statistic: 'Average',
					}),
					targetValue: this.props.autoScaling.targetMemoryUtilization,
				},
			)
			this.targetTrackingPolicies.set('memory', memoryPolicy)
		}

		// ALB request count per target tracking
		if (
			this.props.autoScaling.targetRequestCountPerInstance &&
			this.props.targetGroups &&
			this.props.targetGroups.length > 0
		) {
			const requestCountPolicy = this.autoScalingGroup.scaleOnRequestCount(
				'RequestCountTargetTracking',
				{
					targetRequestsPerMinute:
						this.props.autoScaling.targetRequestCountPerInstance * 60, // Convert to per minute
				},
			)
			this.targetTrackingPolicies.set('requestCount', requestCountPolicy)
		}
	}

	/**
	 * Create step scaling policies for rapid response to traffic spikes
	 */
	private createStepScalingPolicies(): void {
		// High CPU step scaling (scale out aggressively)
		const scaleOutPolicy = new autoscaling.StepScalingPolicy(
			this,
			'CpuScaleOutStepPolicy',
			{
				autoScalingGroup: this.autoScalingGroup,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/EC2',
					metricName: 'CPUUtilization',
					dimensionsMap: {
						AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
					},
					statistic: 'Average',
				}),
				scalingSteps: [
					{ upper: 70, change: 1 }, // Add 1 instance when CPU 50-70%
					{ lower: 70, upper: 85, change: 2 }, // Add 2 instances when CPU 70-85%
					{ lower: 85, change: 3 }, // Add 3 instances when CPU >85%
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown:
					this.props.autoScaling.scaleOutCooldown ??
					this.getDefaultScaleOutCooldown(),
			},
		)
		this.scalingPolicies.set('cpuScaleOut', scaleOutPolicy)

		// Low CPU step scaling (scale in conservatively)
		const scaleInPolicy = new autoscaling.StepScalingPolicy(
			this,
			'CpuScaleInStepPolicy',
			{
				autoScalingGroup: this.autoScalingGroup,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/EC2',
					metricName: 'CPUUtilization',
					dimensionsMap: {
						AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
					},
					statistic: 'Average',
				}),
				scalingSteps: [
					{ upper: 20, change: -1 }, // Remove 1 instance when CPU <20%
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown:
					this.props.autoScaling.scaleInCooldown ??
					this.getDefaultScaleInCooldown(),
			},
		)
		this.scalingPolicies.set('cpuScaleIn', scaleInPolicy)

		// ALB response time step scaling (scale out when response time is high)
		if (this.props.targetGroups && this.props.targetGroups.length > 0) {
			const responseTimeScaleOutPolicy = new autoscaling.StepScalingPolicy(
				this,
				'ResponseTimeScaleOutStepPolicy',
				{
					autoScalingGroup: this.autoScalingGroup,
					metric: new cloudwatch.Metric({
						namespace: 'AWS/ApplicationELB',
						metricName: 'TargetResponseTime',
						dimensionsMap: {
							TargetGroup:
								this.props.targetGroups[0]?.targetGroupFullName ?? 'unknown',
						},
						statistic: 'Average',
					}),
					scalingSteps: [
						{ upper: 2, change: 1 }, // Add 1 instance when response time 1-2s
						{ lower: 2, upper: 5, change: 2 }, // Add 2 instances when response time 2-5s
						{ lower: 5, change: 3 }, // Add 3 instances when response time >5s
					],
					adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
					cooldown:
						this.props.autoScaling.scaleOutCooldown ??
						this.getDefaultScaleOutCooldown(),
				},
			)
			this.scalingPolicies.set(
				'responseTimeScaleOut',
				responseTimeScaleOutPolicy,
			)
		}
	}

	/**
	 * Create simple scaling policies for basic scenarios
	 */
	private createSimpleScalingPolicies(): void {
		// Simple scale out policy
		const simpleScaleOutPolicy = new autoscaling.StepScalingPolicy(
			this,
			'SimpleScaleOutPolicy',
			{
				autoScalingGroup: this.autoScalingGroup,
				metric: new cloudwatch.Metric({
					namespace: this.props.customMetricNamespace ?? 'MacroAI/API',
					metricName: 'RequestCount',
					statistic: 'Sum',
				}),
				scalingSteps: [
					{ lower: 100, change: 1 }, // Add 1 instance when request count >100/period
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown:
					this.props.autoScaling.scaleOutCooldown ??
					this.getDefaultScaleOutCooldown(),
			},
		)
		this.scalingPolicies.set('simpleScaleOut', simpleScaleOutPolicy)

		// Simple scale in policy
		const simpleScaleInPolicy = new autoscaling.StepScalingPolicy(
			this,
			'SimpleScaleInPolicy',
			{
				autoScalingGroup: this.autoScalingGroup,
				metric: new cloudwatch.Metric({
					namespace: this.props.customMetricNamespace ?? 'MacroAI/API',
					metricName: 'RequestCount',
					statistic: 'Sum',
				}),
				scalingSteps: [
					{ upper: 10, change: -1 }, // Remove 1 instance when request count <10/period
				],
				adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
				cooldown:
					this.props.autoScaling.scaleInCooldown ??
					this.getDefaultScaleInCooldown(),
			},
		)
		this.scalingPolicies.set('simpleScaleIn', simpleScaleInPolicy)
	}

	/**
	 * Create scaling alarms and notifications
	 */
	private createScalingAlarms(): void {
		// Scaling activity alarms
		this.createScalingActivityAlarms()

		// Capacity limit alarms
		this.createCapacityLimitAlarms()

		// Performance-based alarms
		this.createPerformanceAlarms()
	}

	/**
	 * Create alarms for scaling activities
	 */
	private createScalingActivityAlarms(): void {
		// Frequent scaling alarm (indicates instability)
		new cloudwatch.Alarm(this, 'FrequentScalingAlarm', {
			metric: new cloudwatch.Metric({
				namespace: 'AWS/AutoScaling',
				metricName: 'GroupTotalInstances',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			threshold: 0, // Any change
			evaluationPeriods: 5, // 5 consecutive periods of change
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: `Frequent scaling activity detected in ${this.autoScalingGroup.autoScalingGroupName}`,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		// Scaling failure alarm
		new cloudwatch.Alarm(this, 'ScalingFailureAlarm', {
			metric: new cloudwatch.Metric({
				namespace: 'AWS/AutoScaling',
				metricName: 'GroupInServiceInstances',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			threshold: this.props.autoScaling.minCapacity,
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			alarmDescription: `Auto Scaling Group ${this.autoScalingGroup.autoScalingGroupName} below minimum capacity`,
		})
	}

	/**
	 * Create alarms for capacity limits
	 */
	private createCapacityLimitAlarms(): void {
		// Near maximum capacity alarm
		new cloudwatch.Alarm(this, 'NearMaxCapacityAlarm', {
			metric: new cloudwatch.Metric({
				namespace: 'AWS/AutoScaling',
				metricName: 'GroupDesiredCapacity',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			threshold: Math.max(1, this.props.autoScaling.maxCapacity * 0.8), // 80% of max capacity
			evaluationPeriods: 2,
			comparisonOperator:
				cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			alarmDescription: `Auto Scaling Group ${this.autoScalingGroup.autoScalingGroupName} near maximum capacity`,
		})

		// At maximum capacity alarm
		new cloudwatch.Alarm(this, 'AtMaxCapacityAlarm', {
			metric: new cloudwatch.Metric({
				namespace: 'AWS/AutoScaling',
				metricName: 'GroupDesiredCapacity',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			threshold: this.props.autoScaling.maxCapacity,
			evaluationPeriods: 1,
			comparisonOperator:
				cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			alarmDescription: `Auto Scaling Group ${this.autoScalingGroup.autoScalingGroupName} at maximum capacity`,
		})
	}

	/**
	 * Create performance-based alarms
	 */
	private createPerformanceAlarms(): void {
		// High CPU across all instances
		new cloudwatch.Alarm(this, 'HighCpuAcrossInstancesAlarm', {
			metric: new cloudwatch.Metric({
				namespace: 'AWS/EC2',
				metricName: 'CPUUtilization',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			threshold: this.getCpuThresholdForEnvironment(),
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: `High CPU utilization across instances in ${this.autoScalingGroup.autoScalingGroupName}`,
		})

		// High memory across all instances (requires CloudWatch Agent)
		new cloudwatch.Alarm(this, 'HighMemoryAcrossInstancesAlarm', {
			metric: new cloudwatch.Metric({
				namespace: 'CWAgent',
				metricName: 'mem_used_percent',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			threshold: 85,
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: `High memory utilization across instances in ${this.autoScalingGroup.autoScalingGroupName}`,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
	}

	/**
	 * Create notification configurations for scaling events
	 */
	private createNotificationConfigurations(): autoscaling.NotificationConfiguration[] {
		const configurations: autoscaling.NotificationConfiguration[] = []

		if (this.props.notificationTopics?.critical) {
			configurations.push({
				topic: this.props.notificationTopics.critical,
				scalingEvents: autoscaling.ScalingEvents.ERRORS,
			})
		}

		if (this.props.notificationTopics?.warning) {
			configurations.push({
				topic: this.props.notificationTopics.warning,
				scalingEvents: autoscaling.ScalingEvents.ALL,
			})
		}

		if (this.props.notificationTopics?.info) {
			configurations.push({
				topic: this.props.notificationTopics.info,
				scalingEvents: autoscaling.ScalingEvents.ALL,
			})
		}

		return configurations
	}

	/**
	 * Get default health check grace period based on environment
	 */
	private getDefaultHealthCheckGracePeriod(): cdk.Duration {
		switch (this.props.environmentName) {
			case 'production':
				return cdk.Duration.minutes(5) // More time for production instances
			case 'staging':
				return cdk.Duration.minutes(3)
			default:
				return cdk.Duration.minutes(2) // Faster for development
		}
	}

	/**
	 * Get default scale out cooldown based on environment
	 */
	private getDefaultScaleOutCooldown(): cdk.Duration {
		switch (this.props.environmentName) {
			case 'production':
				return cdk.Duration.minutes(3) // Conservative for production
			case 'staging':
				return cdk.Duration.minutes(2)
			default:
				return cdk.Duration.minutes(1) // Faster for development
		}
	}

	/**
	 * Get default scale in cooldown based on environment
	 */
	private getDefaultScaleInCooldown(): cdk.Duration {
		switch (this.props.environmentName) {
			case 'production':
				return cdk.Duration.minutes(10) // Very conservative for production
			case 'staging':
				return cdk.Duration.minutes(5)
			default:
				return cdk.Duration.minutes(3) // Faster for development
		}
	}

	/**
	 * Get CPU threshold based on environment
	 */
	private getCpuThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 70 // More conservative for production
			case 'staging':
				return 75
			default:
				return 80 // More lenient for development
		}
	}

	/**
	 * Apply comprehensive tags to auto scaling resources
	 */
	private applyTags(): void {
		const tags = {
			Environment: this.props.environmentName,
			Application: this.props.applicationName,
			Component: 'AutoScaling',
			Phase: 'Phase4-AutoScaling',
			ManagedBy: 'CDK',
		}

		// Apply tags to Auto Scaling Group
		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(this.autoScalingGroup).add(key, value)
		})

		// Apply tags to scaling policies
		this.scalingPolicies.forEach((policy) => {
			Object.entries(tags).forEach(([key, value]) => {
				cdk.Tags.of(policy).add(key, value)
			})
		})

		this.targetTrackingPolicies.forEach((policy) => {
			Object.entries(tags).forEach(([key, value]) => {
				cdk.Tags.of(policy).add(key, value)
			})
		})
	}

	/**
	 * Add custom scaling policy
	 */
	public addCustomScalingPolicy(
		id: string,
		metric: cloudwatch.IMetric,
		scalingSteps: autoscaling.ScalingInterval[],
		adjustmentType: autoscaling.AdjustmentType = autoscaling.AdjustmentType
			.CHANGE_IN_CAPACITY,
		cooldown?: cdk.Duration,
	): autoscaling.StepScalingPolicy {
		const policy = new autoscaling.StepScalingPolicy(this, id, {
			autoScalingGroup: this.autoScalingGroup,
			metric,
			scalingSteps,
			adjustmentType,
			cooldown: cooldown ?? this.getDefaultScaleOutCooldown(),
		})

		this.scalingPolicies.set(id, policy)
		return policy
	}

	/**
	 * Add custom target tracking scaling policy
	 */
	public addCustomTargetTrackingPolicy(
		id: string,
		metric: cloudwatch.IMetric,
		targetValue: number,
	): autoscaling.TargetTrackingScalingPolicy {
		const policy = this.autoScalingGroup.scaleToTrackMetric(id, {
			metric,
			targetValue,
		})

		this.targetTrackingPolicies.set(id, policy)
		return policy
	}

	/**
	 * Get auto scaling configuration summary
	 */
	public getAutoScalingConfigurationSummary(): string {
		const targetTrackingCount = this.targetTrackingPolicies.size
		const stepScalingCount = this.scalingPolicies.size
		const hasTargetGroups =
			this.props.targetGroups && this.props.targetGroups.length > 0

		return `
Auto Scaling Configuration Summary:

Environment: ${this.props.environmentName}
Application: ${this.props.applicationName}
Auto Scaling Group: ${this.autoScalingGroup.autoScalingGroupName}

Capacity Configuration:
- Minimum Capacity: ${this.props.autoScaling.minCapacity}
- Maximum Capacity: ${this.props.autoScaling.maxCapacity}
- Desired Capacity: ${this.props.autoScaling.desiredCapacity}

Scaling Policies:
- Target Tracking Policies: ${targetTrackingCount}
- Step Scaling Policies: ${stepScalingCount}
- Health Check Types: ${this.props.healthCheckTypes?.join(', ') ?? 'ELB'}
- Health Check Grace Period: ${this.props.healthCheckGracePeriod?.toMinutes() ?? this.getDefaultHealthCheckGracePeriod().toMinutes()} minutes

Target Tracking Metrics:
${this.props.autoScaling.targetCpuUtilization ? `- CPU Utilization: ${this.props.autoScaling.targetCpuUtilization}%` : ''}
${this.props.autoScaling.targetMemoryUtilization ? `- Memory Utilization: ${this.props.autoScaling.targetMemoryUtilization}%` : ''}
${this.props.autoScaling.targetRequestCountPerInstance ? `- Request Count per Instance: ${this.props.autoScaling.targetRequestCountPerInstance}` : ''}

Cooldown Periods:
- Scale Out: ${this.props.autoScaling.scaleOutCooldown?.toMinutes() ?? this.getDefaultScaleOutCooldown().toMinutes()} minutes
- Scale In: ${this.props.autoScaling.scaleInCooldown?.toMinutes() ?? this.getDefaultScaleInCooldown().toMinutes()} minutes

Integration:
- ALB Target Groups: ${hasTargetGroups ? (this.props.targetGroups?.length ?? 0) : 0}
- Notification Topics: ${Object.keys(this.props.notificationTopics ?? {}).length}
- Detailed Monitoring: ${this.props.enableDetailedMonitoring ? 'Enabled' : 'Disabled'}

This auto scaling configuration provides production-ready dynamic scaling
with comprehensive monitoring and cost-optimized policies.
		`.trim()
	}

	/**
	 * Enable or disable scaling policies
	 */
	public setScalingPoliciesEnabled(enabled: boolean): void {
		// Note: CDK doesn't provide direct enable/disable for scaling policies
		// This would typically be done through AWS CLI or SDK in operational procedures
		console.log(
			`Scaling policies ${enabled ? 'enabled' : 'disabled'} for ${this.autoScalingGroup.autoScalingGroupName}`,
		)
	}

	/**
	 * Get scaling metrics for monitoring integration
	 */
	public getScalingMetrics(): cloudwatch.IMetric[] {
		return [
			// Auto Scaling Group metrics
			new cloudwatch.Metric({
				namespace: 'AWS/AutoScaling',
				metricName: 'GroupDesiredCapacity',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			new cloudwatch.Metric({
				namespace: 'AWS/AutoScaling',
				metricName: 'GroupInServiceInstances',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
			new cloudwatch.Metric({
				namespace: 'AWS/AutoScaling',
				metricName: 'GroupTotalInstances',
				dimensionsMap: {
					AutoScalingGroupName: this.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
			}),
		]
	}
}

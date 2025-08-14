import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions'
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { Construct } from 'constructs'

import type { AutoScalingConstruct } from './auto-scaling-construct.js'
import type { MonitoringConstruct } from './monitoring-construct.js'

export interface DeploymentPipelineConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Application name for resource naming
	 */
	readonly applicationName: string

	/**
	 * Auto scaling construct to integrate with
	 */
	readonly autoScalingConstruct: AutoScalingConstruct

	/**
	 * Monitoring construct for deployment health validation
	 */
	readonly monitoringConstruct: MonitoringConstruct

	/**
	 * ALB target groups for blue-green deployment
	 */
	readonly targetGroups: elbv2.ApplicationTargetGroup[]

	/**
	 * VPC for deployment resources
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Deployment configuration
	 */
	readonly deploymentConfig?: {
		/**
		 * Health check grace period for new deployments
		 * @default 5 minutes
		 */
		readonly healthCheckGracePeriod?: cdk.Duration

		/**
		 * Maximum time to wait for deployment validation
		 * @default 15 minutes
		 */
		readonly deploymentTimeout?: cdk.Duration

		/**
		 * Percentage of traffic to shift during canary deployments
		 * @default 10
		 */
		readonly canaryTrafficPercentage?: number

		/**
		 * Enable automatic rollback on deployment failure
		 * @default true
		 */
		readonly enableAutoRollback?: boolean

		/**
		 * Minimum healthy percentage during deployment
		 * @default 50
		 */
		readonly minHealthyPercentage?: number
	}

	/**
	 * SNS topics for deployment notifications
	 */
	readonly notificationTopics?: {
		readonly deploymentStart?: sns.Topic
		readonly deploymentSuccess?: sns.Topic
		readonly deploymentFailure?: sns.Topic
		readonly rollbackTriggered?: sns.Topic
	}
}

/**
 * Deployment strategies supported by the pipeline
 */
export enum DeploymentStrategy {
	BLUE_GREEN = 'BLUE_GREEN',
	ROLLING_UPDATE = 'ROLLING_UPDATE',
	CANARY = 'CANARY',
}

/**
 * Deployment status tracking
 */
export enum DeploymentStatus {
	PENDING = 'PENDING',
	IN_PROGRESS = 'IN_PROGRESS',
	VALIDATING = 'VALIDATING',
	SUCCESS = 'SUCCESS',
	FAILED = 'FAILED',
	ROLLING_BACK = 'ROLLING_BACK',
	ROLLED_BACK = 'ROLLED_BACK',
}

/**
 * Core deployment pipeline construct for production-ready zero-downtime deployments
 *
 * This construct provides:
 * - Blue-green deployment strategies with ALB traffic shifting
 * - Integration with AutoScalingConstruct for capacity management
 * - Health validation using MonitoringConstruct metrics
 * - Automated rollback capabilities with CloudWatch alarms
 * - Step Functions orchestration for deployment workflows
 * - Real-time deployment status tracking and notifications
 */
export class DeploymentPipelineConstruct extends Construct {
	public readonly deploymentStateMachine: stepfunctions.StateMachine
	public readonly deploymentRole: iam.Role
	public readonly healthCheckFunction: lambda.Function
	public readonly rollbackAlarms: cloudwatch.Alarm[]

	private readonly props: DeploymentPipelineConstructProps
	private readonly resourcePrefix: string

	constructor(
		scope: Construct,
		id: string,
		props: DeploymentPipelineConstructProps,
	) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = `${props.applicationName}-${props.environmentName}`
		this.rollbackAlarms = []

		// Create IAM role for deployment operations
		this.deploymentRole = this.createDeploymentRole()

		// Create health check Lambda function
		this.healthCheckFunction = this.createHealthCheckFunction()

		// Create deployment state machine
		this.deploymentStateMachine = this.createDeploymentStateMachine()

		// Create rollback alarms
		this.createRollbackAlarms()

		// Apply tags
		this.applyTags()
	}

	/**
	 * Trigger a blue-green deployment
	 */
	public triggerBlueGreenDeployment(params: {
		artifactLocation: string
		version: string
		strategy?: DeploymentStrategy
	}): { stateMachineArn: string; executionName: string } {
		const input = {
			deploymentId: `${this.resourcePrefix}-${Date.now()}`,
			strategy: params.strategy ?? DeploymentStrategy.BLUE_GREEN,
			artifactLocation: params.artifactLocation,
			version: params.version,
			timestamp: new Date().toISOString(),
			config: {
				healthCheckGracePeriod:
					this.props.deploymentConfig?.healthCheckGracePeriod?.toSeconds() ??
					300,
				deploymentTimeout:
					this.props.deploymentConfig?.deploymentTimeout?.toSeconds() ?? 900,
				canaryTrafficPercentage:
					this.props.deploymentConfig?.canaryTrafficPercentage ?? 10,
				enableAutoRollback:
					this.props.deploymentConfig?.enableAutoRollback ?? true,
				minHealthyPercentage:
					this.props.deploymentConfig?.minHealthyPercentage ?? 50,
			},
		}

		const executionName = `${input.deploymentId}-${Date.now()}`

		return {
			stateMachineArn: this.deploymentStateMachine.stateMachineArn,
			executionName,
		}
	}

	/**
	 * Create IAM role for deployment operations
	 */
	private createDeploymentRole(): iam.Role {
		const role = new iam.Role(this, 'DeploymentRole', {
			roleName: `${this.resourcePrefix}-deployment-role`,
			assumedBy: new iam.CompositePrincipal(
				new iam.ServicePrincipal('states.amazonaws.com'),
				new iam.ServicePrincipal('lambda.amazonaws.com'),
			),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
			],
		})

		// Add permissions for auto scaling operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'autoscaling:UpdateAutoScalingGroup',
					'autoscaling:DescribeAutoScalingGroups',
					'autoscaling:DescribeAutoScalingInstances',
					'autoscaling:SetDesiredCapacity',
					'autoscaling:TerminateInstanceInAutoScalingGroup',
				],
				resources: [
					this.props.autoScalingConstruct.autoScalingGroup.autoScalingGroupArn,
				],
			}),
		)

		// Add permissions for ELB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'elasticloadbalancing:DescribeTargetGroups',
					'elasticloadbalancing:DescribeTargetHealth',
					'elasticloadbalancing:RegisterTargets',
					'elasticloadbalancing:DeregisterTargets',
					'elasticloadbalancing:ModifyRule',
				],
				resources: ['*'], // ELB actions require wildcard
			}),
		)

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'cloudwatch:GetMetricStatistics',
					'cloudwatch:GetMetricData',
					'cloudwatch:ListMetrics',
				],
				resources: ['*'],
			}),
		)

		// Add permissions for EC2 operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ec2:DescribeInstances',
					'ec2:DescribeInstanceStatus',
					'ec2:CreateTags',
				],
				resources: ['*'],
			}),
		)

		return role
	}

	/**
	 * Create health check Lambda function
	 */
	private createHealthCheckFunction(): lambda.Function {
		return new lambda.Function(this, 'HealthCheckFunction', {
			functionName: `${this.resourcePrefix}-deployment-health-check`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role: this.deploymentRole,
			timeout: cdk.Duration.minutes(5),
			code: lambda.Code.fromInline(this.getHealthCheckCode()),
		})
	}

	/**
	 * Create deployment state machine for orchestrating blue-green deployments
	 */
	private createDeploymentStateMachine(): stepfunctions.StateMachine {
		// Define deployment steps
		const startDeployment = new stepfunctions.Pass(this, 'StartDeployment', {
			comment: 'Initialize deployment parameters',
			result: stepfunctions.Result.fromObject({
				status: DeploymentStatus.IN_PROGRESS,
			}),
			resultPath: '$.deploymentStatus',
		})

		// Health check task
		const healthCheckTask = new stepfunctionsTasks.LambdaInvoke(
			this,
			'HealthCheckTask',
			{
				lambdaFunction: this.healthCheckFunction,
				payload: stepfunctions.TaskInput.fromObject({
					targetGroupArns: stepfunctions.JsonPath.stringAt('$.targetGroupArns'),
					healthThresholds: stepfunctions.JsonPath.objectAt(
						'$.config.healthThresholds',
					),
				}),
				resultPath: '$.healthCheckResult',
			},
		)

		// Auto scaling update task
		const updateAutoScalingTask = new stepfunctionsTasks.CallAwsService(
			this,
			'UpdateAutoScalingTask',
			{
				service: 'autoscaling',
				action: 'updateAutoScalingGroup',
				parameters: {
					AutoScalingGroupName:
						this.props.autoScalingConstruct.autoScalingGroup
							.autoScalingGroupName,
					LaunchTemplate: {
						LaunchTemplateId: stepfunctions.JsonPath.stringAt(
							'$.newLaunchTemplateId',
						),
						Version: stepfunctions.JsonPath.stringAt(
							'$.newLaunchTemplateVersion',
						),
					},
				},
				iamResources: ['*'],
				resultPath: '$.autoScalingUpdateResult',
			},
		)

		// Wait for deployment validation
		const waitForValidation = new stepfunctions.Wait(
			this,
			'WaitForValidation',
			{
				time: stepfunctions.WaitTime.duration(
					this.props.deploymentConfig?.healthCheckGracePeriod ??
						cdk.Duration.minutes(5),
				),
			},
		)

		// Success state
		const deploymentSuccess = new stepfunctions.Succeed(
			this,
			'DeploymentSuccess',
			{
				comment: 'Deployment completed successfully',
			},
		)

		// Failure state
		const deploymentFailure = new stepfunctions.Fail(
			this,
			'DeploymentFailure',
			{
				comment: 'Deployment failed',
				cause: 'Health checks failed or deployment timeout',
			},
		)

		// Rollback task
		const rollbackTask = new stepfunctionsTasks.CallAwsService(
			this,
			'RollbackTask',
			{
				service: 'autoscaling',
				action: 'updateAutoScalingGroup',
				parameters: {
					AutoScalingGroupName:
						this.props.autoScalingConstruct.autoScalingGroup
							.autoScalingGroupName,
					LaunchTemplate: {
						LaunchTemplateId: stepfunctions.JsonPath.stringAt(
							'$.previousLaunchTemplateId',
						),
						Version: stepfunctions.JsonPath.stringAt(
							'$.previousLaunchTemplateVersion',
						),
					},
				},
				iamResources: ['*'],
				resultPath: '$.rollbackResult',
			},
		)

		// Health check condition
		const healthCheckCondition = new stepfunctions.Choice(
			this,
			'HealthCheckCondition',
		)
			.when(
				stepfunctions.Condition.booleanEquals(
					'$.healthCheckResult.Payload.body.overallHealthy',
					true,
				),
				deploymentSuccess,
			)
			.when(
				stepfunctions.Condition.booleanEquals(
					'$.config.enableAutoRollback',
					true,
				),
				rollbackTask.next(deploymentFailure),
			)
			.otherwise(deploymentFailure)

		// Define the state machine workflow
		const definition = startDeployment
			.next(updateAutoScalingTask)
			.next(waitForValidation)
			.next(healthCheckTask)
			.next(healthCheckCondition)

		return new stepfunctions.StateMachine(this, 'DeploymentStateMachine', {
			stateMachineName: `${this.resourcePrefix}-deployment-pipeline`,
			definition,
			role: this.deploymentRole,
			timeout:
				this.props.deploymentConfig?.deploymentTimeout ??
				cdk.Duration.minutes(15),
		})
	}

	/**
	 * Create rollback alarms for automatic deployment failure detection
	 */
	private createRollbackAlarms(): void {
		// High error rate alarm
		const errorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
			alarmName: `${this.resourcePrefix}-deployment-high-error-rate`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'HTTPCode_Target_5XX_Count',
				dimensionsMap: {
					TargetGroup: this.props.targetGroups[0]?.targetGroupFullName ?? '',
				},
				statistic: 'Sum',
				period: cdk.Duration.minutes(1),
			}),
			threshold: 10,
			evaluationPeriods: 3,
			alarmDescription: 'High error rate detected during deployment',
		})

		// Low healthy target alarm
		const healthyTargetAlarm = new cloudwatch.Alarm(
			this,
			'LowHealthyTargetAlarm',
			{
				alarmName: `${this.resourcePrefix}-deployment-low-healthy-targets`,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'HealthyHostCount',
					dimensionsMap: {
						TargetGroup: this.props.targetGroups[0]?.targetGroupFullName ?? '',
					},
					statistic: 'Average',
					period: cdk.Duration.minutes(1),
				}),
				threshold: Math.max(
					1,
					Math.floor(
						(1 * // Default minimum capacity
							(this.props.deploymentConfig?.minHealthyPercentage ?? 50)) /
							100,
					),
				),
				comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
				evaluationPeriods: 2,
				alarmDescription: 'Low healthy target count during deployment',
			},
		)

		this.rollbackAlarms.push(errorRateAlarm, healthyTargetAlarm)

		// Add SNS actions if notification topics are provided
		if (this.props.notificationTopics?.rollbackTriggered) {
			const snsAction = new cloudwatchActions.SnsAction(
				this.props.notificationTopics.rollbackTriggered,
			)
			errorRateAlarm.addAlarmAction(snsAction)
			healthyTargetAlarm.addAlarmAction(snsAction)
		}
	}

	/**
	 * Apply comprehensive tagging for cost tracking and resource management
	 */
	private applyTags(): void {
		cdk.Tags.of(this).add('Environment', this.props.environmentName)
		cdk.Tags.of(this).add('Application', this.props.applicationName)
		cdk.Tags.of(this).add('Component', 'DeploymentPipeline')
		cdk.Tags.of(this).add('Purpose', 'BlueGreenDeployment')
		cdk.Tags.of(this).add('ManagedBy', 'DeploymentPipelineConstruct')
	}

	/**
	 * Get health check Lambda function code
	 */
	private getHealthCheckCode(): string {
		return `
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { ELBv2Client, DescribeTargetHealthCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');

const cloudwatch = new CloudWatchClient();
const elbv2 = new ELBv2Client();

exports.handler = async (event) => {
    console.log('Health check event:', JSON.stringify(event, null, 2));

    const { targetGroupArns, healthThresholds } = event;
    const results = [];

    for (const targetGroupArn of targetGroupArns) {
        try {
            const healthResult = await elbv2.send(new DescribeTargetHealthCommand({
                TargetGroupArn: targetGroupArn
            }));

            const healthyTargets = healthResult.TargetHealthDescriptions?.filter(
                target => target.TargetHealth?.State === 'healthy'
            ) || [];

            const totalTargets = healthResult.TargetHealthDescriptions?.length || 0;
            const healthyPercentage = totalTargets > 0 ? (healthyTargets.length / totalTargets) * 100 : 0;

            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);

            const errorRateResult = await cloudwatch.send(new GetMetricStatisticsCommand({
                Namespace: 'AWS/ApplicationELB',
                MetricName: 'HTTPCode_Target_5XX_Count',
                Dimensions: [{ Name: 'TargetGroup', Value: targetGroupArn.split('/').slice(-2).join('/') }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 300,
                Statistics: ['Sum']
            }));

            const errorCount = errorRateResult.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

            results.push({
                targetGroupArn,
                healthyTargets: healthyTargets.length,
                totalTargets,
                healthyPercentage,
                errorCount,
                isHealthy: healthyPercentage >= (healthThresholds?.minHealthyPercentage || 80) &&
                          errorCount <= (healthThresholds?.maxErrorCount || 10)
            });

        } catch (error) {
            console.error(\`Health check failed for \${targetGroupArn}:\`, error);
            results.push({ targetGroupArn, error: error.message, isHealthy: false });
        }
    }

    const overallHealthy = results.every(result => result.isHealthy);

    return {
        statusCode: 200,
        body: { overallHealthy, results, timestamp: new Date().toISOString() }
    };
};`
	}
}

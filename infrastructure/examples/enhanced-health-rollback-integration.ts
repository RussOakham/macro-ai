/**
 * Enhanced Health Validation & Rollback Integration Example
 *
 * This example demonstrates how to integrate the Advanced Health Check and Enhanced Rollback
 * constructs with the existing deployment pipeline to provide comprehensive health validation
 * and advanced rollback capabilities.
 *
 * Features demonstrated:
 * - Multi-layered health validation (application, dependencies, performance, infrastructure)
 * - Advanced rollback strategies with validation
 * - Integration with existing Phase 4 infrastructure
 * - Real-time health monitoring and alerting
 * - Rollback history and audit trail
 */

import * as cdk from 'aws-cdk-lib'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

import { AdvancedHealthCheckConstruct } from '../src/constructs/advanced-health-check-construct.js'
import { AlbConstruct } from '../src/constructs/alb-construct.js'
import { AutoScalingConstruct } from '../src/constructs/auto-scaling-construct.js'
import { DeploymentPipelineConstruct } from '../src/constructs/deployment-pipeline-construct.js'
import { Ec2Construct } from '../src/constructs/ec2-construct.js'
import {
	EnhancedRollbackConstruct,
	RollbackStrategy,
} from '../src/constructs/enhanced-rollback-construct.js'
import { MonitoringIntegration } from '../src/constructs/monitoring-integration.js'
import { VpcConstruct } from '../src/constructs/vpc-construct.js'

export interface EnhancedHealthRollbackStackProps extends cdk.StackProps {
	/**
	 * Environment name (production, staging, development)
	 */
	readonly environmentName: string

	/**
	 * Application name
	 */
	readonly applicationName: string

	/**
	 * Email addresses for health and rollback notifications
	 */
	readonly notificationEmails: string[]

	/**
	 * Application base URL for health checks
	 */
	readonly applicationBaseUrl?: string

	/**
	 * External dependencies for health validation
	 */
	readonly externalDependencies?: Array<{
		name: string
		endpoint: string
		critical?: boolean
	}>
}

/**
 * Enhanced Health Validation & Rollback Stack
 *
 * This stack demonstrates the complete integration of advanced health validation
 * and rollback mechanisms with the existing Phase 4 deployment pipeline.
 */
export class EnhancedHealthRollbackStack extends cdk.Stack {
	public readonly vpcConstruct: VpcConstruct
	public readonly ec2Construct: Ec2Construct
	public readonly albConstruct: AlbConstruct
	public readonly autoScalingConstruct: AutoScalingConstruct
	public readonly monitoringIntegration: MonitoringIntegration
	public readonly deploymentPipeline: DeploymentPipelineConstruct
	public readonly advancedHealthCheck: AdvancedHealthCheckConstruct
	public readonly enhancedRollback: EnhancedRollbackConstruct

	constructor(
		scope: Construct,
		id: string,
		props: EnhancedHealthRollbackStackProps,
	) {
		super(scope, id, props)

		const { environmentName, applicationName, notificationEmails } = props

		// 1. Create foundational infrastructure (same as before)
		this.vpcConstruct = new VpcConstruct(this, 'VpcConstruct', {
			environmentName,
			enableNatGateway: environmentName === 'production',
		})

		this.ec2Construct = new Ec2Construct(this, 'Ec2Construct', {
			vpc: this.vpcConstruct.vpc,
			environmentName,
			applicationName,
			instanceType: this.getInstanceTypeForEnvironment(environmentName),
			enableDetailedMonitoring: environmentName === 'production',
		})

		this.albConstruct = new AlbConstruct(this, 'AlbConstruct', {
			vpc: this.vpcConstruct.vpc,
			securityGroup: this.ec2Construct.albSecurityGroup,
			environmentName,
			enableDetailedMonitoring: environmentName === 'production',
		})

		this.autoScalingConstruct = new AutoScalingConstruct(
			this,
			'AutoScalingConstruct',
			{
				vpc: this.vpcConstruct.vpc,
				launchTemplate: this.ec2Construct.launchTemplate,
				environmentName,
				applicationName,
				targetGroups: [this.albConstruct.defaultTargetGroup],
				autoScaling: this.getAutoScalingConfigForEnvironment(environmentName),
				enableDetailedMonitoring: true,
			},
		)

		this.monitoringIntegration = new MonitoringIntegration(
			this,
			'MonitoringIntegration',
			{
				environmentName,
				applicationName,
				ec2Construct: this.ec2Construct,
				albConstruct: this.albConstruct,
				autoScalingConstruct: this.autoScalingConstruct,
				criticalAlertEmails: notificationEmails,
				warningAlertEmails: notificationEmails,
				enableCostMonitoring: true,
			},
		)

		// 2. Create SNS topics for health and rollback notifications
		const notificationTopics = this.createNotificationTopics(notificationEmails)

		// 3. Create Advanced Health Check System
		this.advancedHealthCheck = new AdvancedHealthCheckConstruct(
			this,
			'AdvancedHealthCheck',
			{
				environmentName,
				applicationName,
				vpc: this.vpcConstruct.vpc,
				targetGroups: [this.albConstruct.defaultTargetGroup],
				healthCheckConfig: this.getHealthCheckConfigForEnvironment(
					environmentName,
					props,
				),
				notificationTopics: {
					healthDegraded: notificationTopics.healthDegraded,
					healthRestored: notificationTopics.healthRestored,
					criticalFailure: notificationTopics.criticalFailure,
				},
			},
		)

		// 4. Create Enhanced Rollback System
		this.enhancedRollback = new EnhancedRollbackConstruct(
			this,
			'EnhancedRollback',
			{
				environmentName,
				applicationName,
				autoScalingGroup: this.autoScalingConstruct.autoScalingGroup,
				rollbackConfig: this.getRollbackConfigForEnvironment(environmentName),
				notificationTopics: {
					rollbackStarted: notificationTopics.rollbackStarted,
					rollbackCompleted: notificationTopics.rollbackCompleted,
					rollbackFailed: notificationTopics.rollbackFailed,
					rollbackValidated: notificationTopics.rollbackValidated,
				},
			},
		)

		// 5. Create Enhanced Deployment Pipeline with health validation and rollback integration
		this.deploymentPipeline = new DeploymentPipelineConstruct(
			this,
			'DeploymentPipeline',
			{
				environmentName,
				applicationName,
				autoScalingConstruct: this.autoScalingConstruct,
				monitoringConstruct: this.monitoringIntegration.monitoring,
				targetGroups: [this.albConstruct.defaultTargetGroup],
				vpc: this.vpcConstruct.vpc,
				deploymentConfig:
					this.getDeploymentConfigForEnvironment(environmentName),
				notificationTopics: {
					deploymentStart: notificationTopics.deploymentStart,
					deploymentSuccess: notificationTopics.deploymentSuccess,
					deploymentFailure: notificationTopics.deploymentFailure,
					rollbackTriggered: notificationTopics.rollbackTriggered,
				},
			},
		)

		// 6. Create stack outputs
		this.createOutputs()
	}

	/**
	 * Get instance type based on environment
	 */
	private getInstanceTypeForEnvironment(environmentName: string): string {
		switch (environmentName) {
			case 'production':
				return 't3.medium'
			case 'staging':
				return 't3.small'
			default:
				return 't3.micro'
		}
	}

	/**
	 * Get auto scaling configuration based on environment
	 */
	private getAutoScalingConfigForEnvironment(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return {
					minCapacity: 2,
					maxCapacity: 10,
					desiredCapacity: 3,
					targetCpuUtilization: 60,
					targetMemoryUtilization: 70,
					targetRequestCountPerInstance: 100,
					scaleOutCooldown: cdk.Duration.minutes(3),
					scaleInCooldown: cdk.Duration.minutes(5),
				}
			case 'staging':
				return {
					minCapacity: 1,
					maxCapacity: 5,
					desiredCapacity: 2,
					targetCpuUtilization: 70,
					targetMemoryUtilization: 80,
					targetRequestCountPerInstance: 150,
					scaleOutCooldown: cdk.Duration.minutes(5),
					scaleInCooldown: cdk.Duration.minutes(10),
				}
			default:
				return {
					minCapacity: 1,
					maxCapacity: 3,
					desiredCapacity: 1,
					targetCpuUtilization: 80,
					targetMemoryUtilization: 85,
					targetRequestCountPerInstance: 200,
					scaleOutCooldown: cdk.Duration.minutes(5),
					scaleInCooldown: cdk.Duration.minutes(10),
				}
		}
	}

	/**
	 * Get health check configuration based on environment
	 */
	private getHealthCheckConfigForEnvironment(
		environmentName: string,
		props: EnhancedHealthRollbackStackProps,
	) {
		const baseUrl =
			props.applicationBaseUrl ??
			`https://${props.applicationName}-${environmentName}.example.com`

		return {
			applicationEndpoints: [
				{
					path: '/api/health',
					expectedStatusCode: 200,
					timeout: cdk.Duration.seconds(5),
				},
				{
					path: '/api/health/ready',
					expectedStatusCode: 200,
					timeout: cdk.Duration.seconds(5),
				},
				{
					path: '/api/health/detailed',
					expectedStatusCode: 200,
					timeout: cdk.Duration.seconds(10),
				},
			],
			externalDependencies: props.externalDependencies ?? [
				{
					name: 'OpenAI',
					endpoint: 'https://api.openai.com/v1/models',
					critical: true,
				},
				{
					name: 'Database',
					endpoint: `${baseUrl}/api/health/detailed`,
					critical: true,
				},
			],
			performanceThresholds: {
				maxResponseTime:
					environmentName === 'production'
						? cdk.Duration.seconds(1)
						: cdk.Duration.seconds(2),
				minThroughput: environmentName === 'production' ? 10 : 5,
				maxErrorRate: environmentName === 'production' ? 1 : 5,
			},
			checkInterval: cdk.Duration.minutes(1),
			failureThreshold: 3,
			successThreshold: 2,
		}
	}

	/**
	 * Get rollback configuration based on environment
	 */
	private getRollbackConfigForEnvironment(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return {
					strategy: RollbackStrategy.GRADUAL,
					validationTimeout: cdk.Duration.minutes(10),
					maxAttempts: 3,
					enableValidation: true,
					validationThresholds: {
						minHealthyPercentage: 90,
						maxErrorRate: 1,
						maxResponseTime: 1000,
					},
				}
			case 'staging':
				return {
					strategy: RollbackStrategy.IMMEDIATE,
					validationTimeout: cdk.Duration.minutes(5),
					maxAttempts: 2,
					enableValidation: true,
					validationThresholds: {
						minHealthyPercentage: 80,
						maxErrorRate: 3,
						maxResponseTime: 2000,
					},
				}
			default:
				return {
					strategy: RollbackStrategy.IMMEDIATE,
					validationTimeout: cdk.Duration.minutes(3),
					maxAttempts: 1,
					enableValidation: true,
					validationThresholds: {
						minHealthyPercentage: 70,
						maxErrorRate: 5,
						maxResponseTime: 3000,
					},
				}
		}
	}

	/**
	 * Get deployment configuration based on environment
	 */
	private getDeploymentConfigForEnvironment(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return {
					healthCheckGracePeriod: cdk.Duration.minutes(10),
					deploymentTimeout: cdk.Duration.minutes(30),
					canaryTrafficPercentage: 5,
					enableAutoRollback: true,
					minHealthyPercentage: 75,
				}
			case 'staging':
				return {
					healthCheckGracePeriod: cdk.Duration.minutes(5),
					deploymentTimeout: cdk.Duration.minutes(20),
					canaryTrafficPercentage: 10,
					enableAutoRollback: true,
					minHealthyPercentage: 50,
				}
			default:
				return {
					healthCheckGracePeriod: cdk.Duration.minutes(3),
					deploymentTimeout: cdk.Duration.minutes(15),
					canaryTrafficPercentage: 20,
					enableAutoRollback: true,
					minHealthyPercentage: 50,
				}
		}
	}

	/**
	 * Create SNS topics for health and rollback notifications
	 */
	private createNotificationTopics(emails: string[]) {
		// Health check notification topics
		const healthDegradedTopic = new sns.Topic(this, 'HealthDegradedTopic', {
			topicName: `${props.applicationName}-${props.environmentName}-health-degraded`,
			displayName: 'Health Degraded',
		})

		const healthRestoredTopic = new sns.Topic(this, 'HealthRestoredTopic', {
			topicName: `${props.applicationName}-${props.environmentName}-health-restored`,
			displayName: 'Health Restored',
		})

		const criticalFailureTopic = new sns.Topic(this, 'CriticalFailureTopic', {
			topicName: `${props.applicationName}-${props.environmentName}-critical-failure`,
			displayName: 'Critical Failure',
		})

		// Rollback notification topics
		const rollbackStartedTopic = new sns.Topic(this, 'RollbackStartedTopic', {
			topicName: `${props.applicationName}-${props.environmentName}-rollback-started`,
			displayName: 'Rollback Started',
		})

		const rollbackCompletedTopic = new sns.Topic(
			this,
			'RollbackCompletedTopic',
			{
				topicName: `${props.applicationName}-${props.environmentName}-rollback-completed`,
				displayName: 'Rollback Completed',
			},
		)

		const rollbackFailedTopic = new sns.Topic(this, 'RollbackFailedTopic', {
			topicName: `${props.applicationName}-${props.environmentName}-rollback-failed`,
			displayName: 'Rollback Failed',
		})

		const rollbackValidatedTopic = new sns.Topic(
			this,
			'RollbackValidatedTopic',
			{
				topicName: `${props.applicationName}-${props.environmentName}-rollback-validated`,
				displayName: 'Rollback Validated',
			},
		)

		// Deployment notification topics (reused from deployment pipeline)
		const deploymentStartTopic = new sns.Topic(this, 'DeploymentStartTopic', {
			topicName: `${props.applicationName}-${props.environmentName}-deployment-start`,
			displayName: 'Deployment Started',
		})

		const deploymentSuccessTopic = new sns.Topic(
			this,
			'DeploymentSuccessTopic',
			{
				topicName: `${props.applicationName}-${props.environmentName}-deployment-success`,
				displayName: 'Deployment Successful',
			},
		)

		const deploymentFailureTopic = new sns.Topic(
			this,
			'DeploymentFailureTopic',
			{
				topicName: `${props.applicationName}-${props.environmentName}-deployment-failure`,
				displayName: 'Deployment Failed',
			},
		)

		const rollbackTriggeredTopic = new sns.Topic(
			this,
			'RollbackTriggeredTopic',
			{
				topicName: `${props.applicationName}-${props.environmentName}-rollback-triggered`,
				displayName: 'Rollback Triggered',
			},
		)

		// Subscribe emails to all topics
		const allTopics = [
			healthDegradedTopic,
			healthRestoredTopic,
			criticalFailureTopic,
			rollbackStartedTopic,
			rollbackCompletedTopic,
			rollbackFailedTopic,
			rollbackValidatedTopic,
			deploymentStartTopic,
			deploymentSuccessTopic,
			deploymentFailureTopic,
			rollbackTriggeredTopic,
		]

		emails.forEach((email) => {
			allTopics.forEach((topic) => {
				topic.addSubscription(new subscriptions.EmailSubscription(email))
			})
		})

		return {
			healthDegraded: healthDegradedTopic,
			healthRestored: healthRestoredTopic,
			criticalFailure: criticalFailureTopic,
			rollbackStarted: rollbackStartedTopic,
			rollbackCompleted: rollbackCompletedTopic,
			rollbackFailed: rollbackFailedTopic,
			rollbackValidated: rollbackValidatedTopic,
			deploymentStart: deploymentStartTopic,
			deploymentSuccess: deploymentSuccessTopic,
			deploymentFailure: deploymentFailureTopic,
			rollbackTriggered: rollbackTriggeredTopic,
		}
	}

	/**
	 * Create stack outputs for integration with CI/CD pipelines
	 */
	private createOutputs(): void {
		// Infrastructure outputs
		new cdk.CfnOutput(this, 'VpcId', {
			value: this.vpcConstruct.vpc.vpcId,
			description: 'VPC ID for the enhanced health and rollback infrastructure',
		})

		new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
			value: this.albConstruct.applicationLoadBalancer.loadBalancerDnsName,
			description: 'ALB DNS name for accessing the application',
		})

		new cdk.CfnOutput(this, 'AutoScalingGroupName', {
			value: this.autoScalingConstruct.autoScalingGroup.autoScalingGroupName,
			description: 'Auto Scaling Group name for deployment operations',
		})

		// Deployment pipeline outputs
		new cdk.CfnOutput(this, 'DeploymentStateMachineArn', {
			value: this.deploymentPipeline.deploymentStateMachine.stateMachineArn,
			description:
				'Step Functions state machine ARN for triggering deployments',
		})

		// Advanced health check outputs
		new cdk.CfnOutput(this, 'HealthCheckFunctionArn', {
			value: this.advancedHealthCheck.healthCheckFunction.functionArn,
			description: 'Advanced health check orchestrator function ARN',
		})

		new cdk.CfnOutput(this, 'ApplicationHealthValidatorArn', {
			value: this.advancedHealthCheck.applicationHealthValidator.functionArn,
			description: 'Application health validator function ARN',
		})

		new cdk.CfnOutput(this, 'DependencyHealthValidatorArn', {
			value: this.advancedHealthCheck.dependencyHealthValidator.functionArn,
			description: 'Dependency health validator function ARN',
		})

		new cdk.CfnOutput(this, 'PerformanceHealthValidatorArn', {
			value: this.advancedHealthCheck.performanceHealthValidator.functionArn,
			description: 'Performance health validator function ARN',
		})

		// Enhanced rollback outputs
		new cdk.CfnOutput(this, 'RollbackStateMachineArn', {
			value: this.enhancedRollback.rollbackStateMachine.stateMachineArn,
			description: 'Enhanced rollback state machine ARN',
		})

		new cdk.CfnOutput(this, 'ManualRollbackFunctionArn', {
			value: this.enhancedRollback.manualRollbackFunction.functionArn,
			description: 'Manual rollback trigger function ARN',
		})

		new cdk.CfnOutput(this, 'RollbackHistoryTableName', {
			value: this.enhancedRollback.rollbackHistoryTable.tableName,
			description: 'DynamoDB table name for rollback history and audit trail',
		})

		// Monitoring outputs
		new cdk.CfnOutput(this, 'MonitoringDashboardUrl', {
			value: this.monitoringIntegration.dashboardUrl,
			description: 'CloudWatch dashboard URL for monitoring',
		})

		new cdk.CfnOutput(this, 'LaunchTemplateId', {
			value: this.ec2Construct.launchTemplate.launchTemplateId ?? '',
			description: 'Launch template ID for deployment updates',
		})
	}
}

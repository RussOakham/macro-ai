/**
 * Comprehensive example demonstrating Phase 4 deployment pipeline integration
 *
 * This example shows how to integrate:
 * - AutoScalingConstruct for dynamic capacity management
 * - MonitoringConstruct for comprehensive observability
 * - DeploymentPipelineConstruct for blue-green deployments
 * - ALB and EC2 constructs for complete infrastructure
 *
 * This provides a complete production-ready deployment pipeline
 * with zero-downtime deployments and automated rollback capabilities.
 */

import * as cdk from 'aws-cdk-lib'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

import { AlbConstruct } from '../src/constructs/alb-construct.js'
import { AutoScalingConstruct } from '../src/constructs/auto-scaling-construct.js'
import { DeploymentPipelineConstruct } from '../src/constructs/deployment-pipeline-construct.js'
import { Ec2Construct } from '../src/constructs/ec2-construct.js'
import { MonitoringIntegration } from '../src/constructs/monitoring-integration.js'
import { VpcConstruct } from '../src/constructs/vpc-construct.js'

export interface ProductionDeploymentStackProps extends cdk.StackProps {
	/**
	 * Environment name (production, staging, development)
	 */
	readonly environmentName: string

	/**
	 * Application name
	 */
	readonly applicationName: string

	/**
	 * Email addresses for deployment notifications
	 */
	readonly notificationEmails: string[]

	/**
	 * Enable cost monitoring and optimization
	 */
	readonly enableCostMonitoring?: boolean
}

/**
 * Production deployment stack with comprehensive blue-green deployment pipeline
 *
 * This stack demonstrates the complete Phase 4 implementation:
 * 1. VPC and networking infrastructure
 * 2. EC2 instances with launch templates
 * 3. Application Load Balancer with target groups
 * 4. Auto Scaling Groups with dynamic policies
 * 5. Comprehensive CloudWatch monitoring
 * 6. Blue-green deployment pipeline with rollback
 * 7. SNS notifications for deployment events
 */
export class ProductionDeploymentStack extends cdk.Stack {
	public readonly vpcConstruct: VpcConstruct
	public readonly ec2Construct: Ec2Construct
	public readonly albConstruct: AlbConstruct
	public readonly autoScalingConstruct: AutoScalingConstruct
	public readonly monitoringIntegration: MonitoringIntegration
	public readonly deploymentPipeline: DeploymentPipelineConstruct

	constructor(
		scope: Construct,
		id: string,
		props: ProductionDeploymentStackProps,
	) {
		super(scope, id, props)

		const { environmentName, applicationName, notificationEmails } = props

		// 1. Create VPC and networking infrastructure
		this.vpcConstruct = new VpcConstruct(this, 'VpcConstruct', {
			environmentName,
			enableNatGateway: environmentName === 'production', // Cost optimization for non-prod
		})

		// 2. Create EC2 infrastructure with launch template
		this.ec2Construct = new Ec2Construct(this, 'Ec2Construct', {
			vpc: this.vpcConstruct.vpc,
			environmentName,
			applicationName,
			instanceType: this.getInstanceTypeForEnvironment(environmentName),
			enableDetailedMonitoring: environmentName === 'production',
		})

		// 3. Create Application Load Balancer
		this.albConstruct = new AlbConstruct(this, 'AlbConstruct', {
			vpc: this.vpcConstruct.vpc,
			securityGroup: this.ec2Construct.albSecurityGroup,
			environmentName,
			enableDetailedMonitoring: environmentName === 'production',
		})

		// 4. Create Auto Scaling Groups with production-ready configuration
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

		// 5. Create SNS topics for deployment notifications
		const notificationTopics = this.createNotificationTopics(notificationEmails)

		// 6. Create comprehensive monitoring integration
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
				enableCostMonitoring: props.enableCostMonitoring ?? true,
			},
		)

		// 7. Create deployment pipeline for blue-green deployments
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
				notificationTopics,
			},
		)

		// 8. Output important information
		this.createOutputs()
	}

	/**
	 * Get instance type based on environment
	 */
	private getInstanceTypeForEnvironment(environmentName: string): string {
		switch (environmentName) {
			case 'production':
				return 't3.medium' // Production workload
			case 'staging':
				return 't3.small' // Staging testing
			default:
				return 't3.micro' // Development/testing
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
	 * Get deployment configuration based on environment
	 */
	private getDeploymentConfigForEnvironment(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return {
					healthCheckGracePeriod: cdk.Duration.minutes(10),
					deploymentTimeout: cdk.Duration.minutes(30),
					canaryTrafficPercentage: 5, // Conservative for production
					enableAutoRollback: true,
					minHealthyPercentage: 75, // High availability requirement
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
					canaryTrafficPercentage: 20, // Faster feedback in dev
					enableAutoRollback: true,
					minHealthyPercentage: 50,
				}
		}
	}

	/**
	 * Create SNS topics for deployment notifications
	 */
	private createNotificationTopics(emails: string[]) {
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
		emails.forEach((email) => {
			deploymentStartTopic.addSubscription(
				new subscriptions.EmailSubscription(email),
			)
			deploymentSuccessTopic.addSubscription(
				new subscriptions.EmailSubscription(email),
			)
			deploymentFailureTopic.addSubscription(
				new subscriptions.EmailSubscription(email),
			)
			rollbackTriggeredTopic.addSubscription(
				new subscriptions.EmailSubscription(email),
			)
		})

		return {
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
		new cdk.CfnOutput(this, 'VpcId', {
			value: this.vpcConstruct.vpc.vpcId,
			description: 'VPC ID for the deployment infrastructure',
		})

		new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
			value: this.albConstruct.applicationLoadBalancer.loadBalancerDnsName,
			description: 'ALB DNS name for accessing the application',
		})

		new cdk.CfnOutput(this, 'AutoScalingGroupName', {
			value: this.autoScalingConstruct.autoScalingGroup.autoScalingGroupName,
			description: 'Auto Scaling Group name for deployment operations',
		})

		new cdk.CfnOutput(this, 'DeploymentStateMachineArn', {
			value: this.deploymentPipeline.deploymentStateMachine.stateMachineArn,
			description:
				'Step Functions state machine ARN for triggering deployments',
		})

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

/**
 * Example usage and deployment script
 */
export class DeploymentPipelineApp extends cdk.App {
	constructor() {
		super()

		// Production environment
		new ProductionDeploymentStack(this, 'MacroAiProductionDeployment', {
			environmentName: 'production',
			applicationName: 'macro-ai',
			notificationEmails: ['devops@company.com', 'alerts@company.com'],
			enableCostMonitoring: true,
			env: {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: 'us-east-1',
			},
		})

		// Staging environment
		new ProductionDeploymentStack(this, 'MacroAiStagingDeployment', {
			environmentName: 'staging',
			applicationName: 'macro-ai',
			notificationEmails: ['dev-team@company.com'],
			enableCostMonitoring: true,
			env: {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: 'us-east-1',
			},
		})
	}
}

// Example of how to trigger a deployment programmatically
export const triggerDeploymentExample = `
// Trigger a blue-green deployment
const deployment = deploymentPipeline.triggerBlueGreenDeployment({
	artifactLocation: 's3://my-artifacts/macro-ai-v1.2.3.tar.gz',
	version: 'v1.2.3',
	strategy: DeploymentStrategy.BLUE_GREEN
});

console.log('Deployment started:', deployment.executionArn);
`

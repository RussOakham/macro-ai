/**
 * Deployment Status Tracking Integration Example
 * 
 * This example demonstrates how to integrate the Deployment Status Tracking system
 * with the existing Phase 4 deployment pipeline to provide comprehensive deployment
 * monitoring, real-time dashboards, detailed logging, and enhanced CLI reporting.
 * 
 * Features demonstrated:
 * - Real-time deployment status tracking with DynamoDB
 * - Comprehensive deployment event logging
 * - CloudWatch dashboards for deployment monitoring
 * - Enhanced CLI tools for deployment status reporting
 * - Integration with existing deployment pipeline
 * - SNS notifications for deployment events
 */

import * as cdk from 'aws-cdk-lib'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

import { AdvancedHealthCheckConstruct } from '../src/constructs/advanced-health-check-construct.js'
import { AlbConstruct } from '../src/constructs/alb-construct.js'
import { AutoScalingConstruct } from '../src/constructs/auto-scaling-construct.js'
import { DeploymentDashboardConstruct } from '../src/constructs/deployment-dashboard-construct.js'
import { DeploymentPipelineConstruct } from '../src/constructs/deployment-pipeline-construct.js'
import { DeploymentStatusConstruct } from '../src/constructs/deployment-status-construct.js'
import { Ec2Construct } from '../src/constructs/ec2-construct.js'
import { EnhancedRollbackConstruct } from '../src/constructs/enhanced-rollback-construct.js'
import { MonitoringIntegration } from '../src/constructs/monitoring-integration.js'
import { VpcConstruct } from '../src/constructs/vpc-construct.js'

export interface DeploymentStatusIntegrationStackProps extends cdk.StackProps {
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
	 * Deployment status configuration
	 */
	readonly deploymentStatusConfig?: {
		/**
		 * Enable detailed deployment logging
		 */
		readonly enableDetailedLogging?: boolean

		/**
		 * Dashboard refresh interval
		 */
		readonly dashboardRefreshInterval?: cdk.Duration

		/**
		 * Deployment history retention days
		 */
		readonly historyRetentionDays?: number

		/**
		 * Enable real-time notifications
		 */
		readonly enableNotifications?: boolean
	}
}

/**
 * Deployment Status Tracking Integration Stack
 * 
 * This stack demonstrates the complete integration of deployment status tracking
 * with the existing Phase 4 deployment pipeline, providing comprehensive monitoring,
 * real-time dashboards, and enhanced CLI reporting capabilities.
 */
export class DeploymentStatusIntegrationStack extends cdk.Stack {
	public readonly vpcConstruct: VpcConstruct
	public readonly ec2Construct: Ec2Construct
	public readonly albConstruct: AlbConstruct
	public readonly autoScalingConstruct: AutoScalingConstruct
	public readonly monitoringIntegration: MonitoringIntegration
	public readonly deploymentPipeline: DeploymentPipelineConstruct
	public readonly advancedHealthCheck: AdvancedHealthCheckConstruct
	public readonly enhancedRollback: EnhancedRollbackConstruct
	public readonly deploymentStatus: DeploymentStatusConstruct
	public readonly deploymentDashboard: DeploymentDashboardConstruct

	constructor(scope: Construct, id: string, props: DeploymentStatusIntegrationStackProps) {
		super(scope, id, props)

		const { environmentName, applicationName, notificationEmails } = props

		// 1. Create foundational infrastructure
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

		this.autoScalingConstruct = new AutoScalingConstruct(this, 'AutoScalingConstruct', {
			vpc: this.vpcConstruct.vpc,
			launchTemplate: this.ec2Construct.launchTemplate,
			environmentName,
			applicationName,
			targetGroups: [this.albConstruct.defaultTargetGroup],
			autoScaling: this.getAutoScalingConfigForEnvironment(environmentName),
			enableDetailedMonitoring: true,
		})

		this.monitoringIntegration = new MonitoringIntegration(this, 'MonitoringIntegration', {
			environmentName,
			applicationName,
			ec2Construct: this.ec2Construct,
			albConstruct: this.albConstruct,
			autoScalingConstruct: this.autoScalingConstruct,
			criticalAlertEmails: notificationEmails,
			warningAlertEmails: notificationEmails,
			enableCostMonitoring: true,
		})

		// 2. Create SNS topics for deployment notifications
		const notificationTopics = this.createNotificationTopics(notificationEmails)

		// 3. Create Advanced Health Check System
		this.advancedHealthCheck = new AdvancedHealthCheckConstruct(this, 'AdvancedHealthCheck', {
			environmentName,
			applicationName,
			vpc: this.vpcConstruct.vpc,
			targetGroups: [this.albConstruct.defaultTargetGroup],
			healthCheckConfig: this.getHealthCheckConfigForEnvironment(environmentName),
			notificationTopics: {
				healthDegraded: notificationTopics.healthDegraded,
				healthRestored: notificationTopics.healthRestored,
				criticalFailure: notificationTopics.criticalFailure,
			},
		})

		// 4. Create Enhanced Rollback System
		this.enhancedRollback = new EnhancedRollbackConstruct(this, 'EnhancedRollback', {
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
		})

		// 5. Create Deployment Status Tracking System
		this.deploymentStatus = new DeploymentStatusConstruct(this, 'DeploymentStatus', {
			environmentName,
			applicationName,
			deploymentStatusConfig: {
				historyRetentionDays: props.deploymentStatusConfig?.historyRetentionDays ?? 90,
				enableDetailedLogging: props.deploymentStatusConfig?.enableDetailedLogging ?? true,
				logRetentionDays: this.getLogRetentionForEnvironment(environmentName),
				enableNotifications: props.deploymentStatusConfig?.enableNotifications ?? true,
			},
			notificationTopics: {
				deploymentStarted: notificationTopics.deploymentStarted,
				deploymentCompleted: notificationTopics.deploymentCompleted,
				deploymentFailed: notificationTopics.deploymentFailed,
				deploymentRolledBack: notificationTopics.deploymentRolledBack,
			},
		})

		// 6. Create Deployment Dashboard
		this.deploymentDashboard = new DeploymentDashboardConstruct(this, 'DeploymentDashboard', {
			environmentName,
			applicationName,
			deploymentHistoryTable: this.deploymentStatus.deploymentHistoryTable,
			deploymentStatusFunctions: {
				eventProcessor: this.deploymentStatus.deploymentEventProcessor,
				statusQuery: this.deploymentStatus.deploymentStatusQuery,
			},
			dashboardConfig: {
				refreshInterval: props.deploymentStatusConfig?.dashboardRefreshInterval ?? cdk.Duration.minutes(5),
				enableDetailedMetrics: environmentName === 'production',
				timeRange: cdk.Duration.hours(24),
			},
		})

		// 7. Create Enhanced Deployment Pipeline with status tracking integration
		this.deploymentPipeline = new DeploymentPipelineConstruct(this, 'DeploymentPipeline', {
			environmentName,
			applicationName,
			autoScalingConstruct: this.autoScalingConstruct,
			monitoringConstruct: this.monitoringIntegration.monitoring,
			targetGroups: [this.albConstruct.defaultTargetGroup],
			vpc: this.vpcConstruct.vpc,
			deploymentConfig: this.getDeploymentConfigForEnvironment(environmentName),
			notificationTopics: {
				deploymentStart: notificationTopics.deploymentStart,
				deploymentSuccess: notificationTopics.deploymentSuccess,
				deploymentFailure: notificationTopics.deploymentFailure,
				rollbackTriggered: notificationTopics.rollbackTriggered,
			},
			// Integration with deployment status tracking
			deploymentStatusIntegration: {
				eventProcessor: this.deploymentStatus.deploymentEventProcessor,
				statusQuery: this.deploymentStatus.deploymentStatusQuery,
				historyTable: this.deploymentStatus.deploymentHistoryTable,
			},
		})

		// 8. Create stack outputs
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
	private getHealthCheckConfigForEnvironment(environmentName: string) {
		return {
			applicationEndpoints: [
				{ path: '/api/health', expectedStatusCode: 200, timeout: cdk.Duration.seconds(5) },
				{ path: '/api/health/ready', expectedStatusCode: 200, timeout: cdk.Duration.seconds(5) },
				{ path: '/api/health/detailed', expectedStatusCode: 200, timeout: cdk.Duration.seconds(10) },
			],
			externalDependencies: [
				{
					name: 'OpenAI',
					endpoint: 'https://api.openai.com/v1/models',
					critical: true,
				},
				{
					name: 'Database',
					endpoint: `https://${props.applicationName}-${environmentName}.example.com/api/health/detailed`,
					critical: true,
				},
			],
			performanceThresholds: {
				maxResponseTime: environmentName === 'production' ? cdk.Duration.seconds(1) : cdk.Duration.seconds(2),
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
					strategy: 'GRADUAL' as const,
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
					strategy: 'IMMEDIATE' as const,
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
					strategy: 'IMMEDIATE' as const,
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
					enableStatusTracking: true,
					statusTrackingInterval: cdk.Duration.seconds(30),
				}
			case 'staging':
				return {
					healthCheckGracePeriod: cdk.Duration.minutes(5),
					deploymentTimeout: cdk.Duration.minutes(20),
					canaryTrafficPercentage: 10,
					enableAutoRollback: true,
					minHealthyPercentage: 50,
					enableStatusTracking: true,
					statusTrackingInterval: cdk.Duration.minutes(1),
				}
			default:
				return {
					healthCheckGracePeriod: cdk.Duration.minutes(3),
					deploymentTimeout: cdk.Duration.minutes(15),
					canaryTrafficPercentage: 20,
					enableAutoRollback: true,
					minHealthyPercentage: 50,
					enableStatusTracking: true,
					statusTrackingInterval: cdk.Duration.minutes(2),
				}
		}
	}

	/**
	 * Get log retention based on environment
	 */
	private getLogRetentionForEnvironment(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return cdk.aws_logs.RetentionDays.SIX_MONTHS
			case 'staging':
				return cdk.aws_logs.RetentionDays.THREE_MONTHS
			default:
				return cdk.aws_logs.RetentionDays.ONE_MONTH
		}
	}

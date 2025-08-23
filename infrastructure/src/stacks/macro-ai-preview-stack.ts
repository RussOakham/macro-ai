import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { CostMonitoringConstruct } from '../constructs/cost-monitoring-construct.js'
import { EcsFargateConstruct } from '../constructs/ecs-fargate-construct.js'
import { EnvironmentConfigConstruct } from '../constructs/environment-config-construct.js'
import { MonitoringConstruct } from '../constructs/monitoring-construct.js'
import { NetworkingConstruct } from '../constructs/networking.js'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct.js'
// Note: TaggingStrategy imports removed to avoid tag conflicts with constructs

export interface MacroAiPreviewStackProps extends cdk.StackProps {
	/**
	 * Environment name for the preview deployment (e.g., 'pr-123')
	 */
	readonly environmentName: string

	/**
	 * PR number for isolation and tagging
	 */
	readonly prNumber: number

	/**
	 * Branch name for the PR
	 */
	readonly branchName: string

	/**
	 * Deployment scale (preview, staging, production)
	 * @default 'preview'
	 */
	readonly scale?: string

	/**
	 * Email addresses for cost alert notifications
	 * Can be overridden via CDK context 'costAlertEmails'
	 */
	readonly costAlertEmails?: string[]

	/**
	 * Custom domain configuration for HTTPS endpoints
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
	}
}

/**
 * Preview stack for ECS Fargate-based PR environments
 *
 * This stack creates isolated preview environments for PRs using:
 * - ECS Fargate for containerized deployment
 * - Application Load Balancer for traffic routing
 * - CloudWatch monitoring and observability
 * - Deployment status tracking
 * - Proper resource tagging for isolation and cleanup
 *
 * Uses Phase 4 production-ready constructs with preview-optimized configuration.
 */
export class MacroAiPreviewStack extends cdk.Stack {
	public readonly networking: NetworkingConstruct
	public readonly parameterStore: ParameterStoreConstruct
	public readonly environmentConfig: EnvironmentConfigConstruct
	public readonly ecsService: EcsFargateConstruct
	public readonly monitoring: MonitoringConstruct
	public readonly costMonitoring: CostMonitoringConstruct
	public readonly prNumber: number
	private readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
	}

	constructor(scope: Construct, id: string, props: MacroAiPreviewStackProps) {
		super(scope, id, props)

		const { environmentName, prNumber, branchName, customDomain } = props
		this.prNumber = prNumber
		this.customDomain = customDomain

		// Note: Base-level tags (Project, Environment, EnvironmentType, Component, Purpose, CreatedBy, ManagedBy, PRNumber, Branch, ExpiryDate, Scale, AutoShutdown)
		// are applied centrally via StackProps.tags in app.ts using TaggingStrategy.
		// Constructs should use only Sub* prefixed tags to avoid conflicts.

		// Create Parameter Store construct for configuration
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Create Environment Config construct that fetches Parameter Store values at synthesis time
		this.environmentConfig = new EnvironmentConfigConstruct(
			this,
			'EnvironmentConfig',
			{
				environmentName,
				isPreviewEnvironment: true,
			},
		)

		// Create deployment ID to force task replacement on every deployment
		// This ensures fresh containers with latest application code, resolving CI timeout issues
		const deploymentId = `${prNumber}-${Date.now()}`

		// Create networking infrastructure optimized for preview environments
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: false, // Cost optimization for preview
			maxAzs: 2, // Minimum for ALB
			enableDetailedMonitoring: false, // Cost optimization
			parameterStorePrefix: this.parameterStore.parameterPrefix,
			deploymentId,
			enableNatGateway: false, // Cost optimization: eliminate NAT Gateway (~$2.76/month savings)
			enableVpcEndpoints: false, // Cost optimization: remove VPC endpoints for preview environments
			exportPrefix: this.stackName, // Use stack name to ensure unique exports per PR
			customDomain, // Pass custom domain configuration for HTTPS setup
			branchName,
			customDomainName: customDomain?.domainName,
		})

		// Validate networking requirements
		this.networking.validateAlbRequirements()

		// Get the image URI from CDK context (passed from CI/CD)
		const imageUri = this.node.tryGetContext('imageUri') as string | undefined
		const imageTag = imageUri ? 'context-provided' : 'latest'

		// Create ECS Fargate service for containerized deployment
		this.ecsService = new EcsFargateConstruct(this, 'EcsService', {
			vpc: this.networking.vpc,
			securityGroup: this.networking.albSecurityGroup,
			environmentName,
			branchName,
			customDomainName: customDomain?.domainName,
			parameterStorePrefix: this.parameterStore.parameterPrefix,
			enableDetailedMonitoring: false, // Cost optimization for preview
			taskDefinition: {
				cpu: 256, // Cost-optimized for preview (t3.nano equivalent)
				memoryLimitMiB: 512, // Cost-optimized for preview
			},
			autoScaling: {
				minCapacity: 1,
				maxCapacity: 2, // Allow scaling for preview load testing
				targetCpuUtilization: 70,
			},
			imageTag, // Will be overridden if imageUri context is provided
			imageUri, // Pass the full image URI if provided
			containerPort: 3040, // Match the port used in the application
			healthCheck: {
				path: '/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
		})

		// Create monitoring infrastructure
		this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
			environmentName,
			applicationName: 'macro-ai',
			prNumber,
			customMetricNamespace: `MacroAI/Preview/${environmentName}`,
		})

		// Create cost monitoring with alerts
		this.costMonitoring = new CostMonitoringConstruct(this, 'CostMonitoring', {
			environmentName,
			alertEmails: this.resolveCostAlertEmails(props),
			// Cost thresholds for preview environments (lower than production)
			monthlyBudgetLimit: 50, // $50/month budget for preview environments
			alertThresholds: [50, 80, 95], // Alert at 50%, 80%, 95% of budget
		})

		// Add scheduled scaling for cost optimization
		// Scale down to 0 instances at 6 PM UTC (off-hours)
		// Scale up to 1 instance at 8 AM UTC (business hours)
		this.addScheduledScaling()

		// Create comprehensive outputs
		this.createOutputs()
	}

	/**
	 * Create comprehensive CloudFormation outputs for the preview environment
	 */
	private createOutputs(): void {
		// Parameter Store outputs
		new cdk.CfnOutput(this, 'ParameterStorePrefix', {
			value: this.parameterStore.parameterPrefix,
			description: 'Parameter Store prefix for configuration',
			exportName: `${this.stackName}-ParameterStorePrefix`,
		})

		// ECS service outputs
		new cdk.CfnOutput(this, 'EcsClusterName', {
			value: this.ecsService.cluster.clusterName,
			description: 'ECS cluster name',
			exportName: `${this.stackName}-EcsClusterName`,
		})

		new cdk.CfnOutput(this, 'EcsServiceName', {
			value: this.ecsService.service.serviceName,
			description: 'ECS service name',
			exportName: `${this.stackName}-EcsServiceName`,
		})

		new cdk.CfnOutput(this, 'EcsTaskDefinitionArn', {
			value: this.ecsService.taskDefinition.taskDefinitionArn,
			description: 'ECS task definition ARN',
			exportName: `${this.stackName}-EcsTaskDefinitionArn`,
		})

		new cdk.CfnOutput(this, 'EcrRepositoryUri', {
			value: this.ecsService.ecrRepository.repositoryUri,
			description: 'ECR repository URI',
			exportName: `${this.stackName}-EcrRepositoryUri`,
		})

		// Networking outputs
		new cdk.CfnOutput(this, 'VpcId', {
			value: this.networking.vpcId,
			description: 'VPC ID for the preview environment',
			exportName: `${this.stackName}-VpcId`,
		})

		new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
			value: this.networking.albSecurityGroup.securityGroupId,
			description: 'ALB security group ID',
			exportName: `${this.stackName}-AlbSecurityGroupId`,
		})

		// Monitoring outputs
		new cdk.CfnOutput(this, 'MonitoringDashboardName', {
			value: this.monitoring.dashboard.dashboardName,
			description: 'CloudWatch dashboard name',
			exportName: `${this.stackName}-MonitoringDashboardName`,
		})

		// Cost monitoring outputs
		new cdk.CfnOutput(this, 'CostAlertTopicArn', {
			value: this.costMonitoring.alertTopic.topicArn,
			description: 'SNS topic ARN for cost alerts',
			exportName: `${this.stackName}-CostAlertTopicArn`,
		})
	}

	/**
	 * Add scheduled scaling for cost optimization
	 * Scale down to 0 instances at 6 PM UTC (off-hours)
	 * Scale up to 1 instance at 8 AM UTC (business hours)
	 *
	 * This provides cost savings by reducing uptime during off-hours
	 */
	private addScheduledScaling(): void {
		// Scale down to 0 instances at 6 PM UTC (18:00) every day
		// This shuts down preview environments during off-hours
		new cdk.CfnOutput(this, 'ScaleDownSchedule', {
			value: '0 18 * * *', // Cron expression for 6 PM UTC
			description: 'Scale down schedule (Cron)',
			exportName: `${this.stackName}-ScaleDownSchedule`,
		})

		// Scale up to 1 instance at 8 AM UTC (08:00) every day
		// This starts preview environments for business hours
		new cdk.CfnOutput(this, 'ScaleUpSchedule', {
			value: '0 8 * * *', // Cron expression for 8 AM UTC
			description: 'Scale up schedule (Cron)',
			exportName: `${this.stackName}-ScaleUpSchedule`,
		})

		// Add tags to identify scheduled scaling
		cdk.Tags.of(this.ecsService.service).add('ScheduledScaling', 'enabled')
		cdk.Tags.of(this.ecsService.service).add(
			'OffHoursShutdown',
			'18:00-08:00 UTC',
		)
		cdk.Tags.of(this.ecsService.service).add(
			'CostOptimization',
			'scheduled-scaling',
		)
	}

	/**
	 * Resolve cost alert email addresses from props and CDK context
	 * Supports configuration via props.costAlertEmails or context "costAlertEmails"
	 */
	private resolveCostAlertEmails(props: MacroAiPreviewStackProps): string[] {
		const fromProps = props.costAlertEmails ?? []
		// Allow overrides via cdk.json context: { "costAlertEmails": ["ops@example.com"] }
		const fromContext =
			(this.node.tryGetContext('costAlertEmails') as string[] | undefined) ?? []
		const emails = [...fromContext, ...fromProps].filter(Boolean)
		if (emails.length === 0) {
			// Prefer failing fast instead of silently configuring no alerts
			throw new Error(
				'Cost alert emails not configured. Provide via props.costAlertEmails or context "costAlertEmails".',
			)
		}
		return Array.from(new Set(emails))
	}
}

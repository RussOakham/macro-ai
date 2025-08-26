import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { AutoShutdownConstruct } from '../constructs/auto-shutdown-construct.js'
import { CertificateConstruct } from '../constructs/certificate-construct.js'
import { CostMonitoringConstruct } from '../constructs/cost-monitoring-construct.js'
import { EcsFargateConstruct } from '../constructs/ecs-fargate-construct.js'
import { EcsLoadBalancerConstruct } from '../constructs/ecs-load-balancer-construct.js'
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

	/**
	 * Auto-shutdown configuration for cost optimization
	 * @default enabled with standard business hours
	 */
	readonly autoShutdown?: {
		readonly enabled: boolean
		readonly shutdownSchedule?: string // UTC cron
		readonly startupSchedule?: string // UTC cron
		readonly enableWeekendShutdown?: boolean
		readonly displayTimeZone?: string
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
	public readonly certificate?: CertificateConstruct
	public readonly loadBalancer: EcsLoadBalancerConstruct
	public readonly monitoring?: MonitoringConstruct
	public readonly costMonitoring?: CostMonitoringConstruct
	public readonly autoShutdown?: AutoShutdownConstruct
	public readonly prNumber: number
	private readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
	}

	constructor(scope: Construct, id: string, props: MacroAiPreviewStackProps) {
		super(scope, id, props)

		const {
			environmentName,
			prNumber,
			branchName,
			customDomain,
			autoShutdown,
		} = props
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
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
		})

		// Create certificate for custom domain if provided
		if (customDomain) {
			this.certificate = new CertificateConstruct(this, 'Certificate', {
				customDomain,
				environmentName,
				prNumber: prNumber.toString(),
			})
			console.log(
				`✅ Certificate created for API domain: pr-${prNumber}-api.${customDomain.domainName}`,
			)
		}

		// Create Application Load Balancer for public access to ECS service
		this.loadBalancer = new EcsLoadBalancerConstruct(this, 'LoadBalancer', {
			vpc: this.networking.vpc,
			ecsService: this.ecsService.service,
			environmentName,
			customDomain: customDomain
				? {
						...customDomain,
						certificateArn: this.certificate?.certificateArn,
						// Use API-specific subdomain to avoid conflicts with frontend
						apiSubdomain: `pr-${prNumber}-api`,
						// Don't create frontend subdomain - leave it for CloudFront
						createFrontendSubdomain: false,
					}
				: undefined,
			containerPort: 3040, // Match the container port
			healthCheck: {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
			securityGroup: this.networking.albSecurityGroup,
			enableAccessLogs: false, // Cost optimization for preview
			deletionProtection: false, // Cost optimization for preview
		})

		// Create monitoring infrastructure
		try {
			this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
				environmentName,
				applicationName: 'macro-ai',
				prNumber,
				customMetricNamespace: `MacroAI/Preview/${environmentName}`,
				applicationLoadBalancer: this.loadBalancer.loadBalancer,
			})
		} catch (error) {
			// Log warning but don't fail the stack creation/destruction
			console.warn(
				`Monitoring not configured: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
			console.warn(
				'Stack will continue without monitoring (this is expected during destruction)',
			)
			this.monitoring = undefined
		}

		// Create cost monitoring with alerts (optional for preview environments)
		try {
			const costAlertEmails = this.resolveCostAlertEmails(props)

			// Only create cost monitoring if we have valid emails
			if (costAlertEmails.length > 0) {
				this.costMonitoring = new CostMonitoringConstruct(
					this,
					'CostMonitoring',
					{
						environmentName,
						alertEmails: costAlertEmails,
						// Cost thresholds for preview environments (lower than production)
						monthlyBudgetLimit: 50, // $50/month budget for preview environments
						alertThresholds: [50, 80, 95], // Alert at 50%, 80%, 95% of budget
					},
				)
				console.log(
					`✅ Cost monitoring configured with ${costAlertEmails.length} email(s)`,
				)
			} else {
				console.log(
					'⚠️ No valid cost alert emails provided, skipping cost monitoring',
				)
				this.costMonitoring = undefined
			}
		} catch (error) {
			// Log warning but don't fail the stack creation/destruction
			// This allows the stack to be destroyed even if cost monitoring config is missing
			console.warn(
				`Cost monitoring not configured: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
			console.warn(
				'Stack will continue without cost monitoring (this is expected during destruction)',
			)
			this.costMonitoring = undefined
		}

		// Add auto-shutdown for cost optimization
		if (autoShutdown?.enabled !== false && this.ecsService.scalableTaskCount) {
			this.autoShutdown = new AutoShutdownConstruct(this, 'AutoShutdown', {
				scalableTaskCount: this.ecsService.scalableTaskCount,
				environmentName,
				shutdownSchedule: autoShutdown?.shutdownSchedule ?? '0 22 ? * * *', // 10 PM UTC daily - minute hour day-of-month month day-of-week year (using ? for day-of-month since we specify day-of-week)
				startupSchedule: autoShutdown?.startupSchedule, // Can be undefined for on-demand only
				startupTaskCount: 1,
				enableWeekendShutdown: autoShutdown?.enableWeekendShutdown ?? true,
				displayTimeZone: autoShutdown?.displayTimeZone ?? 'UTC',
			})
		}

		// Create comprehensive outputs
		this.createOutputs()
		this.addAutoShutdownOutputs()
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

		// Load balancer outputs
		new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
			value: this.loadBalancer.loadBalancer.loadBalancerDnsName,
			description: 'Application Load Balancer DNS name',
			exportName: `${this.stackName}-LoadBalancerDnsName`,
		})

		new cdk.CfnOutput(this, 'LoadBalancerUrl', {
			value: `http://${this.loadBalancer.loadBalancer.loadBalancerDnsName}`,
			description: 'Application Load Balancer URL',
			exportName: `${this.stackName}-LoadBalancerUrl`,
		})

		new cdk.CfnOutput(this, 'ApiEndpoint', {
			value: this.customDomain
				? `https://pr-${this.prNumber}-api.${this.customDomain.domainName}/api`
				: `http://${this.loadBalancer.loadBalancer.loadBalancerDnsName}`,
			description:
				'API endpoint URL (custom domain if configured, otherwise ALB URL)',
			exportName: `${this.stackName}-ApiEndpoint`,
		})

		// Custom domain outputs (if configured)
		if (this.customDomain) {
			new cdk.CfnOutput(this, 'CustomDomainUrl', {
				value: `https://pr-${this.prNumber}.${this.customDomain.domainName}`,
				description: 'Custom domain URL for the preview environment',
				exportName: `${this.stackName}-CustomDomainUrl`,
			})

			// Backend API endpoint with custom domain
			new cdk.CfnOutput(this, 'BackendApiEndpoint', {
				value: `https://pr-${this.prNumber}-api.${this.customDomain.domainName}/api`,
				description: 'Backend API endpoint URL with custom domain',
				exportName: `${this.stackName}-BackendApiEndpoint`,
			})

			// Certificate output (if created)
			if (this.certificate) {
				new cdk.CfnOutput(this, 'CertificateArn', {
					value: this.certificate.certificateArn,
					description: 'ACM Certificate ARN for the preview domain',
					exportName: `${this.stackName}-CertificateArn`,
				})
			}
		}

		// Networking outputs are already provided by the NetworkingConstruct
		// No need to duplicate VpcId and AlbSecurityGroupId exports

		// Monitoring outputs
		if (this.monitoring) {
			new cdk.CfnOutput(this, 'MonitoringDashboardName', {
				value: this.monitoring.dashboard.dashboardName,
				description: 'CloudWatch dashboard name',
				exportName: `${this.stackName}-MonitoringDashboardName`,
			})
		}

		// Cost monitoring outputs
		if (this.costMonitoring) {
			new cdk.CfnOutput(this, 'CostAlertTopicArn', {
				value: this.costMonitoring.alertTopic.topicArn,
				description: 'SNS topic ARN for cost alerts',
				exportName: `${this.stackName}-CostAlertTopicArn`,
			})
		}
	}

	/**
	 * Add auto-shutdown outputs to stack outputs
	 */
	private addAutoShutdownOutputs(): void {
		if (this.autoShutdown) {
			// Create manual control outputs
			this.autoShutdown.createManualShutdownOutput()
			this.autoShutdown.createManualStartupOutput()

			// Add informational output about cost savings
			new cdk.CfnOutput(this, 'AutoShutdownStatus', {
				value: 'Enabled',
				description: 'Auto-shutdown status for cost optimization',
				exportName: `${this.stackName}-AutoShutdownStatus`,
			})
		} else {
			new cdk.CfnOutput(this, 'AutoShutdownStatus', {
				value: 'Disabled',
				description: 'Auto-shutdown status for cost optimization',
				exportName: `${this.stackName}-AutoShutdownStatus`,
			})
		}
	}

	/**
	 * Resolve cost alert email addresses from props and CDK context
	 * Supports configuration via props.costAlertEmails or multiple context "costAlertEmails" values
	 * Falls back to empty array if none are configured (for stack destruction scenarios)
	 */
	private resolveCostAlertEmails(props: MacroAiPreviewStackProps): string[] {
		const fromProps = props.costAlertEmails ?? []

		// CDK context can have multiple costAlertEmails values when passed as separate --context flags
		// We need to collect all of them
		const fromContext: string[] = []
		let contextIndex = 0
		let contextValue: string | undefined
		do {
			contextValue = this.node.tryGetContext(
				`costAlertEmails${contextIndex === 0 ? '' : contextIndex}`,
			) as string | undefined
			if (contextValue !== undefined) {
				fromContext.push(contextValue)
				contextIndex++
			}
		} while (contextValue !== undefined)

		// Also check for the legacy single array format
		const legacyContext = this.node.tryGetContext('costAlertEmails') as
			| string[]
			| undefined
		if (legacyContext && Array.isArray(legacyContext)) {
			fromContext.push(...legacyContext)
		}

		const emails = [...fromContext, ...fromProps].filter(Boolean)

		// Validate email format and filter out malformed entries
		const validEmails = emails.filter((email) => {
			// Basic email validation
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			return emailRegex.test(email.trim())
		})

		if (validEmails.length === 0) {
			// For preview environments, provide a fallback to prevent stack failures
			// This allows the stack to be destroyed even without proper email configuration
			console.warn(
				'No valid cost alert emails found, cost monitoring will be disabled',
			)
			console.warn(
				'To enable cost monitoring, set costAlertEmails in props or CDK context',
			)
			return []
		}

		console.log(`Resolved ${validEmails.length} valid cost alert email(s)`)
		return validEmails
	}
}

import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { EcsFargateConstruct } from '../constructs/ecs-fargate-construct.js'
import { EcsLoadBalancerConstruct } from '../constructs/ecs-load-balancer-construct.js'
import { EnvironmentConfigConstruct } from '../constructs/environment-config-construct.js'
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
	 * Custom domain configuration for HTTPS endpoints
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly certificateArn?: string
		/**
		 * API subdomain to use (e.g., 'pr-56-api')
		 * @default derived from environmentName
		 */
		readonly apiSubdomain?: string
	}

	// Complex features removed - focus on core ECS functionality
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
	public readonly loadBalancer: EcsLoadBalancerConstruct
	public readonly prNumber: number
	public readonly environmentName: string
	public readonly customDomain?: MacroAiPreviewStackProps['customDomain']

	constructor(scope: Construct, id: string, props: MacroAiPreviewStackProps) {
		super(scope, id, props)

		const { environmentName, prNumber, branchName, customDomain } = props
		this.prNumber = prNumber
		this.environmentName = environmentName
		this.customDomain = customDomain

		// Note: Base-level tags (Project, Environment, EnvironmentType, Component, Purpose, CreatedBy, ManagedBy, PRNumber, Branch, ExpiryDate, Scale, AutoShutdown)
		// are applied centrally via StackProps.tags in app.ts using TaggingStrategy.
		// Constructs should use only Sub* prefixed tags to avoid conflicts.

		// Create Parameter Store construct for configuration
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Create Environment Config construct for Parameter Store integration
		this.environmentConfig = new EnvironmentConfigConstruct(
			this,
			'EnvironmentConfig',
			{
				environmentName,
				parameterPrefix: this.parameterStore.parameterPrefix,
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
			// enableEc2 removed - ECS Fargate only
			deploymentId,
			enableNatGateway: false, // Cost optimization: eliminate NAT Gateway (~$2.76/month savings)
			enableVpcEndpoints: false, // Cost optimization: remove VPC endpoints for preview environments
			exportPrefix: this.stackName, // Use stack name to ensure unique exports per PR
			branchName,
		})

		// Validate networking requirements
		this.networking.validateAlbRequirements()

		// Get the image URI from CDK context (passed from CI/CD)
		const imageUri = this.node.tryGetContext('imageUri') as string | undefined
		const imageTag = imageUri ? 'context-provided' : 'latest'

		console.log('🔍 Preview Stack: About to create ECS Fargate service...')

		// Create ECS Fargate service for containerized deployment
		this.ecsService = new EcsFargateConstruct(this, 'EcsService', {
			vpc: this.networking.vpc,
			securityGroup: this.networking.albSecurityGroup,
			environmentName,
			branchName,
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
			environmentConfig: this.environmentConfig,
			// Pass custom domain name for CORS configuration
			customDomainName: props.customDomain?.apiSubdomain
				? `${props.customDomain.apiSubdomain}.${props.customDomain.domainName}`
				: undefined,
		})

		// Certificate creation removed - focus on core ECS functionality

		// Create Application Load Balancer for public access to ECS service
		this.loadBalancer = new EcsLoadBalancerConstruct(this, 'LoadBalancer', {
			vpc: this.networking.vpc,
			ecsService: this.ecsService.service,
			environmentName,
			containerPort: 3040,
			healthCheck: {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
			securityGroup: this.networking.albSecurityGroup,
			enableAccessLogs: false,
			deletionProtection: false,
			environmentConfig: this.environmentConfig,
			customDomain: props.customDomain
				? {
						domainName: props.customDomain.domainName,
						hostedZoneId: props.customDomain.hostedZoneId,
						certificateArn: props.customDomain.certificateArn,
						apiSubdomain:
							props.customDomain.apiSubdomain ?? `${environmentName}-api`,
						createFrontendSubdomain: false,
					}
				: undefined,
		})

		// Monitoring infrastructure removed - focus on core ECS functionality

		// Cost monitoring removed - focus on core ECS functionality

		// Auto-shutdown removed - focus on core ECS functionality

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

		// Custom domain outputs
		if (this.customDomain) {
			const apiSubdomain =
				this.customDomain.apiSubdomain ?? `${this.environmentName}-api`
			const fullDomain = `${apiSubdomain}.${this.customDomain.domainName}`

			new cdk.CfnOutput(this, 'CustomDomainUrl', {
				value: `https://${fullDomain}`,
				description: 'Custom domain URL with HTTPS',
				exportName: `${this.stackName}-CustomDomainUrl`,
			})

			new cdk.CfnOutput(this, 'CustomDomainName', {
				value: fullDomain,
				description: 'Custom domain name for the API',
				exportName: `${this.stackName}-CustomDomainName`,
			})
		}

		// Custom domain outputs removed - focus on core ECS functionality

		// Networking outputs are already provided by the NetworkingConstruct
		// No need to duplicate VpcId and AlbSecurityGroupId exports

		// Monitoring outputs removed - focus on core ECS functionality
	}

	// addAutoShutdownOutputs method removed - no longer needed
}

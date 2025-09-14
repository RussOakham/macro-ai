import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { EcsFargateConstruct } from '../constructs/ecs-fargate-construct'
import { EcsLoadBalancerConstruct } from '../constructs/ecs-load-balancer-construct'
import { EnvironmentConfigConstruct } from '../constructs/environment-config-construct'
import { NetworkingConstruct } from '../constructs/networking'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct'

export interface MacroAiStagingStackProps extends cdk.StackProps {
	/**
	 * Branch name for staging (typically 'develop')
	 */
	readonly branchName: string

	/**
	 * Custom domain configuration for HTTPS endpoints
	 */
	readonly customDomain?: {
		/**
		 * API subdomain to use (e.g., 'api-staging')
		 * @default 'api-staging'
		 */
		readonly apiSubdomain?: string
		readonly certificateArn?: string
		readonly domainName: string
		readonly hostedZoneId: string
	}

	/**
	 * Docker image URI for the container (optional - will be fetched from CDK context if not provided)
	 */
	readonly imageUri?: string

	/**
	 * Deployment type for resource naming
	 */
	readonly deploymentType: 'staging'

	/**
	 * Deployment scale for resource sizing
	 */
	readonly deploymentScale: 'preview' | 'production'
}

export class MacroAiStagingStack extends cdk.Stack {
	public readonly ecsService: EcsFargateConstruct
	public readonly environmentConfig: EnvironmentConfigConstruct
	public readonly loadBalancer: EcsLoadBalancerConstruct
	public readonly parameterStore: ParameterStoreConstruct

	constructor(scope: Construct, id: string, props: MacroAiStagingStackProps) {
		super(scope, id, props)

		const { branchName, customDomain } = props

		// Get the image URI from CDK context (passed from CI/CD)
		const imageUri = this.node.tryGetContext('imageUri') as string | undefined

		// Check if we're in a destroy context (CDK destroy operations)
		const isDestroyContext =
			this.node.tryGetContext('imageUri') === 'dummy-image-uri-for-destroy'

		if (!imageUri && !isDestroyContext) {
			throw new Error(
				'❌ No imageUri provided in CDK context. ' +
					'This suggests the GitHub workflow did not pass the correct image URI. ' +
					'Please check that the workflow is building and pushing the Docker image correctly.',
			)
		}

		// Create networking construct
		const networking = new NetworkingConstruct(this, 'Networking', {
			environmentName: 'staging',
		})

		// Create Parameter Store construct
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName: 'staging',
		})

		// Create Environment Config construct for Parameter Store integration
		// Staging is NOT a preview environment
		this.environmentConfig = new EnvironmentConfigConstruct(
			this,
			'EnvironmentConfig',
			{
				environmentName: 'staging',
				parameterPrefix: this.parameterStore.parameterPrefix,
				isPreviewEnvironment: false, // Staging is not a preview environment
			},
		)

		// Create ECS Fargate construct
		this.ecsService = new EcsFargateConstruct(this, 'EcsService', {
			vpc: networking.vpc,
			securityGroup: networking.ecsServiceSecurityGroup,
			environmentName: 'staging',
			branchName,
			enableDetailedMonitoring: false, // Cost optimization for staging
			taskDefinition: {
				cpu: 256, // Cost-optimized for staging
				memoryLimitMiB: 512, // Cost-optimized for staging
			},
			autoScaling: {
				minCapacity: 1,
				maxCapacity: 2, // Allow scaling for staging load testing
				targetCpuUtilization: 70,
			},
			imageUri,
			environmentConfig: this.environmentConfig,
		})

		// Create Load Balancer construct
		this.loadBalancer = new EcsLoadBalancerConstruct(this, 'LoadBalancer', {
			environmentName: 'staging',
			vpc: networking.vpc,
			ecsService: this.ecsService.service,
			customDomain,
		})

		// Output the API endpoint
		new cdk.CfnOutput(this, 'ApiEndpoint', {
			value: this.loadBalancer.serviceUrl,
			description: 'API endpoint URL for staging environment',
		})

		// Output the parameter prefix for reference
		new cdk.CfnOutput(this, 'ParameterPrefix', {
			value: this.parameterStore.parameterPrefix,
			description:
				'Parameter Store prefix for staging environment (manually managed)',
		})
	}
}

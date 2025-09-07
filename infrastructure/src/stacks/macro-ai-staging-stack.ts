import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { CloudWatchMonitoringConstruct } from '../constructs/cloudwatch-monitoring-construct'
import { EcsFargateConstruct } from '../constructs/ecs-fargate-construct'
import { EcsLoadBalancerConstruct } from '../constructs/ecs-load-balancer-construct'
import { EnvironmentConfigConstruct } from '../constructs/environment-config-construct'
import { NetworkingConstruct } from '../constructs/networking'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct'

export interface MacroAiStagingStackProps extends cdk.StackProps {
	/**
	 * Environment name (should be 'staging')
	 */
	readonly environmentName: string

	/**
	 * Branch name (should be 'staging')
	 */
	readonly branchName: string

	/**
	 * Deployment scale (staging)
	 */
	readonly scale?: string

	/**
	 * Custom domain configuration for HTTPS endpoints
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly certificateArn?: string
		readonly apiSubdomain?: string
	}
}

/**
 * Staging stack for ECS Fargate-based staging environment
 *
 * This stack creates a staging environment with:
 * - ECS Fargate for containerized deployment
 * - Application Load Balancer for traffic routing
 * - Cost-optimized configuration for staging workloads
 * - Scheduled scaling (evening shutdown, morning startup)
 * - Neon database branching integration
 *
 * Uses cost-optimized configurations suitable for staging workloads.
 */
export class MacroAiStagingStack extends cdk.Stack {
	public readonly networking: NetworkingConstruct
	public readonly parameterStore: ParameterStoreConstruct
	public readonly environmentConfig: EnvironmentConfigConstruct
	public readonly ecsService: EcsFargateConstruct
	public readonly loadBalancer: EcsLoadBalancerConstruct
	public readonly monitoring: CloudWatchMonitoringConstruct
	public readonly environmentName: string
	public readonly customDomain?: MacroAiStagingStackProps['customDomain']

	constructor(scope: Construct, id: string, props: MacroAiStagingStackProps) {
		super(scope, id, props)

		const { environmentName, branchName, customDomain } = props
		this.environmentName = environmentName
		this.customDomain = customDomain

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
				isPreviewEnvironment: false,
			},
		)

		// Create deployment ID to force task replacement on every deployment
		const deploymentId = `${environmentName}-${Date.now()}`

		console.log('🔍 Staging Stack: About to create ECS Fargate service...')

		// Create networking infrastructure optimized for staging
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: true, // Enable for staging monitoring
			maxAzs: 2, // Minimum for ALB
			enableDetailedMonitoring: true, // Enable for staging
			enableNatGateway: true, // Required for external Neon/Upstash connections
			enableVpcEndpoints: true, // Enable VPC endpoints for cost optimization
			exportPrefix: this.stackName,
			branchName,
			deploymentId,
		})

		// Validate networking requirements
		this.networking.validateAlbRequirements()

		// Get the image URI from CDK context (passed from CI/CD)
		const imageUri = this.node.tryGetContext('imageUri') as string | undefined
		const imageTag = imageUri ? 'context-provided' : 'latest'

		// Create ECS Fargate service optimized for staging
		this.ecsService = new EcsFargateConstruct(this, 'EcsService', {
			vpc: this.networking.vpc,
			securityGroup: this.networking.ecsServiceSecurityGroup,
			environmentName,
			branchName,
			enableDetailedMonitoring: true, // Enable for staging
			taskDefinition: {
				cpu: 512, // Moderate CPU for staging workloads
				memoryLimitMiB: 1024, // Moderate memory for staging
			},
			autoScaling: {
				minCapacity: 1,
				maxCapacity: 3, // Allow scaling for staging load testing
				targetCpuUtilization: 70,
				// Enable scheduled scaling for cost optimization
				enableScheduledScaling: true,
				scheduledActions: [
					{
						name: 'evening-shutdown',
						scheduleExpression: 'cron(0 22 * * ? *)', // 10 PM UTC daily
						minCapacity: 0, // Scale to zero
						maxCapacity: 0,
					},
					{
						name: 'morning-startup',
						scheduleExpression: 'cron(0 6 * * ? *)', // 6 AM UTC daily
						minCapacity: 1, // Scale back up
						maxCapacity: 3,
					},
				],
			},
			imageTag,
			imageUri,
			containerPort: 3040,
			healthCheck: {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
			environmentConfig: this.environmentConfig,
			customDomainName: props.customDomain?.apiSubdomain
				? `${props.customDomain.apiSubdomain}.${props.customDomain.domainName}`
				: undefined,
		})

		// Create Application Load Balancer for public access
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
			enableAccessLogs: true, // Enable for staging monitoring
			deletionProtection: false,
			environmentConfig: this.environmentConfig,
			customDomain: props.customDomain
				? {
						domainName: props.customDomain.domainName,
						hostedZoneId: props.customDomain.hostedZoneId,
						certificateArn: props.customDomain.certificateArn,
						apiSubdomain: props.customDomain.apiSubdomain ?? 'staging-api',
						createFrontendSubdomain: false,
					}
				: undefined,
		})

		// Create CloudWatch monitoring and alerting
		this.monitoring = new CloudWatchMonitoringConstruct(
			this,
			'CloudWatchMonitoring',
			{
				environment: environmentName,
				service: this.ecsService.service,
				loadBalancer: this.loadBalancer.loadBalancer,
				clusterName: this.ecsService.cluster.clusterName,
				serviceName: this.ecsService.service.serviceName,
				enableDetailedMonitoring: true, // Enable detailed monitoring for staging
				enableCostMonitoring: false, // Cost monitoring primarily for production
			},
		)

		// Create comprehensive outputs
		this.createOutputs()
	}

	/**
	 * Create comprehensive CloudFormation outputs for the staging environment
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
			const apiSubdomain = this.customDomain.apiSubdomain ?? 'staging-api'
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

		// Auto-scaling outputs
		new cdk.CfnOutput(this, 'EcsScalingGroupName', {
			value: this.ecsService.autoScalingGroup?.autoScalingGroupName ?? 'N/A',
			description: 'ECS auto scaling group name',
			exportName: `${this.stackName}-EcsScalingGroupName`,
		})

		// Staging-specific outputs
		new cdk.CfnOutput(this, 'StagingScheduledShutdown', {
			value: '22:00 UTC (10 PM UTC) - Scales to 0 instances',
			description: 'Evening scheduled shutdown time',
			exportName: `${this.stackName}-StagingScheduledShutdown`,
		})

		new cdk.CfnOutput(this, 'StagingScheduledStartup', {
			value: '06:00 UTC (6 AM UTC) - Scales to 1-3 instances',
			description: 'Morning scheduled startup time',
			exportName: `${this.stackName}-StagingScheduledStartup`,
		})

		// Monitoring outputs
		new cdk.CfnOutput(this, 'MonitoringDashboardUrl', {
			value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.monitoring.dashboard.dashboardName}`,
			description: 'CloudWatch monitoring dashboard URL',
			exportName: `${this.stackName}-MonitoringDashboardUrl`,
		})

		new cdk.CfnOutput(this, 'AlarmTopicArn', {
			value: this.monitoring.alarmTopic.topicArn,
			description: 'SNS topic ARN for monitoring alarms',
			exportName: `${this.stackName}-AlarmTopicArn`,
		})

		new cdk.CfnOutput(this, 'ActiveAlarms', {
			value: this.monitoring.alarms.length.toString(),
			description: 'Number of active CloudWatch alarms configured',
			exportName: `${this.stackName}-ActiveAlarms`,
		})
	}
}

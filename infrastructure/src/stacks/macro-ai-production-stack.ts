import * as cdk from 'aws-cdk-lib'
import * as events from 'aws-cdk-lib/aws-events'
import * as events_targets from 'aws-cdk-lib/aws-events-targets'
import type { Construct } from 'constructs'

import { CloudWatchMonitoringConstruct } from '../constructs/cloudwatch-monitoring-construct'
import { CostMonitoringConstruct } from '../constructs/cost-monitoring-construct'
import { CostOptimizationLambdaConstruct } from '../constructs/cost-optimization-lambda-construct'
import { EcsFargateConstruct } from '../constructs/ecs-fargate-construct'
import { EcsLoadBalancerConstruct } from '../constructs/ecs-load-balancer-construct'
import { EnvironmentConfigConstruct } from '../constructs/environment-config-construct'
import { NetworkingConstruct } from '../constructs/networking'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct'

export interface MacroAiProductionStackProps extends cdk.StackProps {
	/**
	 * Environment name (should be 'production')
	 */
	readonly environmentName: string

	/**
	 * Branch name (should be 'main')
	 */
	readonly branchName: string

	/**
	 * Deployment scale (production)
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
 * Production stack for ECS Fargate-based production environment
 *
 * This stack creates a production environment with:
 * - ECS Fargate for containerized deployment (24/7 availability)
 * - Application Load Balancer for traffic routing
 * - Production-optimized configuration for high availability
 * - Enhanced monitoring and security
 * - Neon database production branch integration
 *
 * Uses production-grade configurations with high availability and monitoring.
 */
export class MacroAiProductionStack extends cdk.Stack {
	public readonly networking: NetworkingConstruct
	public readonly parameterStore: ParameterStoreConstruct
	public readonly environmentConfig: EnvironmentConfigConstruct
	public readonly ecsService: EcsFargateConstruct
	public readonly loadBalancer: EcsLoadBalancerConstruct
	public readonly monitoring: CloudWatchMonitoringConstruct
	public readonly costMonitoring: CostMonitoringConstruct
	public readonly costOptimizationLambda: CostOptimizationLambdaConstruct
	public readonly environmentName: string
	public readonly customDomain?: MacroAiProductionStackProps['customDomain']

	constructor(
		scope: Construct,
		id: string,
		props: MacroAiProductionStackProps,
	) {
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

		console.log('🔍 Production Stack: About to create ECS Fargate service...')

		// Create networking infrastructure optimized for production
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: true, // Enable for production monitoring
			maxAzs: 3, // High availability across multiple AZs
			enableDetailedMonitoring: true, // Enable for production
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

		// Create ECS Fargate service optimized for production
		this.ecsService = new EcsFargateConstruct(this, 'EcsService', {
			vpc: this.networking.vpc,
			securityGroup: this.networking.ecsServiceSecurityGroup,
			environmentName,
			branchName,
			enableDetailedMonitoring: true, // Enable for production
			taskDefinition: {
				cpu: 1024, // Higher CPU for production workloads
				memoryLimitMiB: 2048, // Higher memory for production
			},
			autoScaling: {
				minCapacity: 2, // Minimum 2 instances for high availability
				maxCapacity: 10, // Allow scaling for production traffic
				targetCpuUtilization: 70,
				// Production runs 24/7 with manual scaling controls
				enableScheduledScaling: false,
			},
			imageTag,
			imageUri,
			containerPort: 3040,
			healthCheck: {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 3, // Higher threshold for production
				unhealthyThresholdCount: 2,
			},
			environmentConfig: this.environmentConfig,
			customDomainName: props.customDomain?.apiSubdomain
				? `${props.customDomain.apiSubdomain}.${props.customDomain.domainName}`
				: undefined,
		})

		// Create Application Load Balancer for production traffic
		this.loadBalancer = new EcsLoadBalancerConstruct(this, 'LoadBalancer', {
			vpc: this.networking.vpc,
			ecsService: this.ecsService.service,
			environmentName,
			containerPort: 3040,
			healthCheck: {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 3,
				unhealthyThresholdCount: 2,
			},
			securityGroup: this.networking.albSecurityGroup,
			enableAccessLogs: true, // Enable for production monitoring
			deletionProtection: true, // Protect production resources
			environmentConfig: this.environmentConfig,
			customDomain: props.customDomain
				? {
						domainName: props.customDomain.domainName,
						hostedZoneId: props.customDomain.hostedZoneId,
						certificateArn: props.customDomain.certificateArn,
						apiSubdomain: props.customDomain.apiSubdomain ?? 'api',
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
				enableDetailedMonitoring: true, // Enable detailed monitoring for production
				enableCostMonitoring: true, // Enable cost monitoring for production
			},
		)

		// Create cost monitoring with budget alerts
		this.costMonitoring = new CostMonitoringConstruct(this, 'CostMonitoring', {
			environment: environmentName,
			budgetAmount: 300, // $300 monthly budget for production
			alertThresholds: [75, 90, 100],
			costAnomalyDetection: true,
			enableCostOptimization: true,
			tags: {
				Environment: environmentName,
				Project: 'macro-ai',
				Application: 'api',
			},
		})

		// Create cost optimization Lambda function
		this.costOptimizationLambda = new CostOptimizationLambdaConstruct(
			this,
			'CostOptimizationLambda',
			{
				environment: environmentName,
				costOptimizationRole: this.costMonitoring.costOptimizationRole,
			},
		)

		// Schedule cost optimization analysis (weekly on Mondays at 2 AM UTC)
		const costOptimizationRule = new events.Rule(
			this,
			'CostOptimizationSchedule',
			{
				ruleName: `${environmentName}-cost-optimization-schedule`,
				description:
					'Weekly cost optimization analysis for production environment',
				schedule: events.Schedule.cron({
					minute: '0',
					hour: '2',
					weekDay: 'MON', // Every Monday
				}),
			},
		)

		costOptimizationRule.addTarget(
			new events_targets.LambdaFunction(this.costOptimizationLambda.function, {
				event: events.RuleTargetInput.fromObject({
					environment: environmentName,
					budgetThreshold: 75,
					currentSpend: 0, // Will be calculated by Lambda
					budgetLimit: 300,
				}),
			}),
		)

		// Create comprehensive outputs
		this.createOutputs()
	}

	/**
	 * Create comprehensive CloudFormation outputs for the production environment
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
			const apiSubdomain = this.customDomain.apiSubdomain ?? 'api'
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

		// Production-specific outputs
		new cdk.CfnOutput(this, 'ProductionAvailability', {
			value: '24/7 - High Availability Configuration',
			description: 'Production availability configuration',
			exportName: `${this.stackName}-ProductionAvailability`,
		})

		new cdk.CfnOutput(this, 'ProductionScaling', {
			value: '2-10 instances based on CPU utilization',
			description: 'Production auto-scaling configuration',
			exportName: `${this.stackName}-ProductionScaling`,
		})

		new cdk.CfnOutput(this, 'NeonDatabaseBranch', {
			value: 'main-production-branch (Parent Branch)',
			description: 'Neon database branch used in production',
			exportName: `${this.stackName}-NeonDatabaseBranch`,
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

		// Cost monitoring outputs
		new cdk.CfnOutput(this, 'CostDashboardUrl', {
			value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.costMonitoring.dashboard.dashboardName}`,
			description: 'Cost monitoring dashboard URL',
			exportName: `${this.stackName}-CostDashboardUrl`,
		})

		new cdk.CfnOutput(this, 'BudgetName', {
			value: this.costMonitoring.budget.ref,
			description: 'AWS Budget name for cost monitoring',
			exportName: `${this.stackName}-BudgetName`,
		})

		new cdk.CfnOutput(this, 'MonthlyBudgetLimit', {
			value: '300', // Fixed budget limit for production
			description: 'Monthly budget limit in USD',
			exportName: `${this.stackName}-MonthlyBudgetLimit`,
		})

		new cdk.CfnOutput(this, 'CostAlertTopicArn', {
			value: this.costMonitoring.alertTopic.topicArn,
			description: 'SNS topic ARN for cost alerts',
			exportName: `${this.stackName}-CostAlertTopicArn`,
		})

		new cdk.CfnOutput(this, 'CostOptimizationRoleArn', {
			value: this.costMonitoring.costOptimizationRole?.roleArn || 'N/A',
			description: 'IAM role ARN for cost optimization (if enabled)',
			exportName: `${this.stackName}-CostOptimizationRoleArn`,
		})

		new cdk.CfnOutput(this, 'CostOptimizationLambdaArn', {
			value: this.costOptimizationLambda.function.functionArn,
			description: 'Cost optimization Lambda function ARN',
			exportName: `${this.stackName}-CostOptimizationLambdaArn`,
		})

		new cdk.CfnOutput(this, 'CostOptimizationScheduleRule', {
			value: `${this.environmentName}-cost-optimization-schedule`,
			description: 'EventBridge rule name for cost optimization schedule',
			exportName: `${this.stackName}-CostOptimizationScheduleRule`,
		})
	}
}

import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as logs from 'aws-cdk-lib/aws-logs'

import { Construct } from 'constructs'
import { CloudWatchMonitoringConstruct } from '../constructs/cloudwatch-monitoring-construct'

export interface MacroAiFeatureStackProps extends cdk.StackProps {
	readonly environmentName: string
	readonly featureName: string
	readonly branchName: string
	readonly scale: string
	readonly customDomain: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly apiSubdomain: string
		readonly certificateArn?: string
	}
	readonly tags: { [key: string]: string }
}

export class MacroAiFeatureStack extends cdk.Stack {
	public readonly loadBalancer: ecsPatterns.ApplicationLoadBalancedFargateService
	public readonly ecsService: ecs.FargateService
	public readonly monitoring: CloudWatchMonitoringConstruct

	constructor(scope: Construct, id: string, props: MacroAiFeatureStackProps) {
		super(scope, id, props)

		// Import existing VPC
		const vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
			vpcId: 'vpc-0d6c6b6f7c8e9a1b2', // Replace with your actual VPC ID
		})

		// Create ECS Cluster
		const cluster = new ecs.Cluster(this, 'EcsCluster', {
			vpc,
			clusterName: `macro-ai-feature-${props.featureName}`,
		})

		// Create CloudWatch Log Group
		const logGroup = new logs.LogGroup(this, 'LogGroup', {
			logGroupName: `/ecs/macro-ai-feature-${props.featureName}`,
			retention: logs.RetentionDays.ONE_WEEK,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		})

		// Create ECS Task Definition
		const taskDefinition = new ecs.FargateTaskDefinition(
			this,
			'TaskDefinition',
			{
				memoryLimitMiB: 512, // Minimal memory for feature environments
				cpu: 256, // Minimal CPU for feature environments
				family: `macro-ai-feature-${props.featureName}`,
			},
		)

		// Add container to task definition
		const container = taskDefinition.addContainer('AppContainer', {
			image: ecs.ContainerImage.fromRegistry(
				'nginx:latest', // Placeholder - will be replaced by actual app image
			),
			memoryLimitMiB: 512,
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: 'ecs',
				logGroup,
			}),
			environment: {
				APP_ENV: 'feature',
				NODE_ENV: 'development',
				FEATURE_NAME: props.featureName,
				BRANCH_NAME: props.branchName,
			},
		})

		// Add port mapping
		container.addPortMappings({
			containerPort: 80,
			protocol: ecs.Protocol.TCP,
		})

		// Create Fargate Service with Load Balancer
		const fargateService =
			new ecsPatterns.ApplicationLoadBalancedFargateService(
				this,
				'FargateService',
				{
					cluster,
					taskDefinition,
					desiredCount: 1, // Single instance for feature environments
					publicLoadBalancer: true,
					assignPublicIp: true,
					serviceName: `macro-ai-feature-${props.featureName}`,
					loadBalancerName: `macro-ai-feature-${props.featureName}`,
				},
			)

		// Configure health check
		fargateService.targetGroup.configureHealthCheck({
			path: '/health',
			healthyHttpCodes: '200',
			interval: cdk.Duration.seconds(30),
			timeout: cdk.Duration.seconds(5),
			healthyThresholdCount: 2,
			unhealthyThresholdCount: 2,
		})

		// Store references
		this.loadBalancer = fargateService
		this.ecsService = fargateService.service

		// DNS Configuration (optional for feature environments)
		if (props.customDomain) {
			this.setupCustomDomain(fargateService, props.customDomain)
		}

		// Auto-scaling configuration (minimal for feature environments)
		const scalableTaskCount = fargateService.service.autoScaleTaskCount({
			minCapacity: 1,
			maxCapacity: 2, // Allow scaling to 2 for testing
		})

		scalableTaskCount.scaleOnCpuUtilization('CpuScaling', {
			targetUtilizationPercent: 70,
			scaleInCooldown: cdk.Duration.seconds(60),
			scaleOutCooldown: cdk.Duration.seconds(60),
		})

		// Create CloudWatch monitoring and alerting
		this.monitoring = new CloudWatchMonitoringConstruct(
			this,
			'CloudWatchMonitoring',
			{
				environment: props.environmentName,
				service: this.ecsService,
				loadBalancer: this.loadBalancer.loadBalancer,
				clusterName: cluster.clusterName,
				serviceName: this.ecsService.serviceName!,
				enableDetailedMonitoring: false, // Basic monitoring for feature environments
				enableCostMonitoring: false, // Cost monitoring primarily for production
			},
		)

		// Outputs
		new cdk.CfnOutput(this, 'ApiUrl', {
			value: fargateService.loadBalancer.loadBalancerDnsName,
			description: 'Load Balancer DNS Name',
		})

		new cdk.CfnOutput(this, 'EcsServiceName', {
			value: fargateService.service.serviceName!,
			description: 'ECS Service Name',
		})

		new cdk.CfnOutput(this, 'EcsClusterName', {
			value: cluster.clusterName,
			description: 'ECS Cluster Name',
		})

		new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
			value: fargateService.loadBalancer.loadBalancerDnsName,
			description: 'Load Balancer DNS Name',
		})

		new cdk.CfnOutput(this, 'FeatureName', {
			value: props.featureName,
			description: 'Feature Name',
		})

		new cdk.CfnOutput(this, 'BranchName', {
			value: props.branchName,
			description: 'Git Branch Name',
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

	private setupCustomDomain(
		fargateService: ecsPatterns.ApplicationLoadBalancedFargateService,
		customDomain: MacroAiFeatureStackProps['customDomain'],
	) {
		// Import hosted zone
		const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
			this,
			'HostedZone',
			{
				zoneName: customDomain.domainName,
				hostedZoneId: customDomain.hostedZoneId,
			},
		)

		// Create SSL certificate
		const certificate = new certificatemanager.Certificate(
			this,
			'Certificate',
			{
				domainName: `${customDomain.apiSubdomain}.${customDomain.domainName}`,
				validation:
					certificatemanager.CertificateValidation.fromDns(hostedZone),
			},
		)

		// Add custom domain to load balancer
		fargateService.loadBalancer.addListener('HttpsListener', {
			port: 443,
			certificates: [certificate],
			defaultAction: cdk.aws_elasticloadbalancingv2.ListenerAction.forward([
				fargateService.targetGroup,
			]),
		})

		// Create DNS record
		new route53.ARecord(this, 'ApiAliasRecord', {
			zone: hostedZone,
			recordName: customDomain.apiSubdomain,
			target: route53.RecordTarget.fromAlias(
				new route53Targets.LoadBalancerTarget(fargateService.loadBalancer),
			),
		})

		new cdk.CfnOutput(this, 'ApiDomain', {
			value: `https://${customDomain.apiSubdomain}.${customDomain.domainName}`,
			description: 'API Custom Domain',
		})
	}
}

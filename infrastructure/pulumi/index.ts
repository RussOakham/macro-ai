/* eslint-disable sonarjs/no-dead-store */
/* eslint-disable sonarjs/no-unused-vars */
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

// Import our new components
import { AlbListenerRule, FargateService, SharedAlb, SharedVpc } from './src'
import { APP_CONFIG, COST_OPTIMIZATION } from './src/config/constants'
import { getCommonTagsAsRecord } from './src/config/tags'
import {
	constructCustomDomain,
	getDopplerConfig,
	getDopplerSecrets,
	resolveImageUri,
} from './src/utils/environment'

// Get configuration
const config = new pulumi.Config()
const environmentName = config.get('environmentName') || 'dev'
const deploymentType = config.get('deploymentType') || 'dev'
const imageUri = config.get('imageUri')
const imageTag = config.get('imageTag') || 'latest'
const baseDomainName =
	config.get('customDomainName') || 'macro-ai.russoakham.dev'
const hostedZoneId = config.get('hostedZoneId')

// Determine environment type
const isPreviewEnvironment = environmentName.startsWith('pr-')
const isPermanentEnvironment = ['dev', 'prd', 'production', 'staging'].includes(
	environmentName,
)

// Common tags for all resources
const commonTags = getCommonTagsAsRecord(environmentName, deploymentType)

// Construct custom domain name
const customDomainName = hostedZoneId
	? constructCustomDomain(environmentName, baseDomainName)
	: undefined

// ECR repository configuration
const ecrRepositoryName = 'macro-ai-staging-express-api'

// ===================================================================
// SHARED RESOURCES (Created by dev stack, referenced by PR stacks)
// ===================================================================

// Initialize variables that will be assigned in conditional blocks
let vpc: SharedVpc | undefined
let sharedAlb: SharedAlb | undefined
let sharedAlbSecurityGroupId: pulumi.Output<string> | undefined

// Variables for workflow compatibility exports
let prFargateService: FargateService | undefined
let prCustomDomainName: string | undefined

if (isPreviewEnvironment) {
	// ========================
	// PR PREVIEW STACK
	// ========================

	// Reference shared dev stack resources via StackReference
	const devStack = new pulumi.StackReference('dev-stack', {
		name: `${pulumi.getOrganization()}/macro-ai-infrastructure/dev`,
	})

	// Get shared VPC from dev
	const sharedVpcId = devStack.requireOutput('vpcId')
	vpc = new SharedVpc('shared-vpc', {
		environmentName,
		existingVpcId: sharedVpcId,
		tags: commonTags,
	})

	// Get shared ALB resources
	sharedAlbSecurityGroupId = devStack.requireOutput(
		'albSecurityGroupId',
	) as pulumi.Output<string>
	const sharedHttpsListenerArn = devStack.requireOutput('httpsListenerArn')
	const sharedAlbDnsName = devStack.requireOutput('albDnsName')
	const sharedAlbZoneId = devStack.requireOutput('albZoneId')

	// ===================================================================
	// PR-SPECIFIC RESOURCES
	// ===================================================================

	// Extract PR number for unique resource naming
	const prNumber = parseInt(environmentName.replace('pr-', ''), 10)
	prCustomDomainName = `pr-${prNumber}.api.${baseDomainName}`

	// Create target group for this PR
	const prTargetGroup = new aws.lb.TargetGroup(`pr-${prNumber}-tg`, {
		name: `macro-ai-pr-${prNumber}-tg`,
		port: APP_CONFIG.port,
		protocol: 'HTTP',
		vpcId: vpc.vpcId,
		targetType: 'ip',
		healthCheck: {
			enabled: true,
			healthyThreshold: 2,
			interval: 30,
			matcher: '200',
			path: '/api/health',
			protocol: 'HTTP',
			timeout: 5,
			unhealthyThreshold: 3,
		},
		deregistrationDelay: 30,
		tags: {
			Name: `macro-ai-pr-${prNumber}-tg`,
			...commonTags,
		},
	})

	// Create listener rule for host-based routing
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const prListenerRule = new AlbListenerRule(`pr-${prNumber}-listener-rule`, {
		environmentName,
		listenerArn: sharedHttpsListenerArn,
		targetGroupArn: prTargetGroup.arn,
		customDomainName: prCustomDomainName,
		priority: 100 + prNumber, // Unique priority per PR
		hostedZoneId,
		albDnsName: sharedAlbDnsName,
		albZoneId: sharedAlbZoneId,
		tags: commonTags,
	})

	// Create ECS cluster for this PR
	const prCluster = new aws.ecs.Cluster(`pr-${prNumber}-cluster`, {
		name: `macro-ai-pr-${prNumber}-cluster`,
		tags: {
			Name: `macro-ai-pr-${prNumber}-cluster`,
			...commonTags,
		},
	})

	// Get Doppler secrets
	const prDopplerToken = config.getSecret('doppler:dopplerToken')
	const prEnvironmentVariables = getDopplerSecrets(
		prDopplerToken,
		'macro-ai',
		'dev', // PR previews use dev config
		{
			NODE_ENV: 'production',
			SERVER_PORT: String(APP_CONFIG.port),
			APP_ENV: environmentName,
			CUSTOM_DOMAIN_NAME: prCustomDomainName,
		},
	)

	// Resolve image URI
	const prResolvedImageUri = resolveImageUri(
		imageUri,
		ecrRepositoryName,
		imageTag,
	)

	// Create Fargate service
	// prFargateService is intentionally unused - created for Pulumi resource side effects
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	prFargateService = new FargateService(`pr-${prNumber}-service`, {
		environmentName,
		clusterArn: prCluster.arn,
		vpcId: vpc.vpcId,
		subnetIds: vpc.publicSubnetIds,
		imageUri: prResolvedImageUri,
		environmentVariables: prEnvironmentVariables,
		targetGroupArn: prTargetGroup.arn,
		albSecurityGroupId: sharedAlbSecurityGroupId,
		cpu: COST_OPTIMIZATION.ecsCpu,
		memory: COST_OPTIMIZATION.ecsMemory,
		desiredCount: 1,
		logRetentionDays: COST_OPTIMIZATION.logRetentionDays.preview,
		tags: commonTags,
	})
} else {
	// ========================
	// PERMANENT ENVIRONMENT (dev, staging, production)
	// ========================

	// Create VPC (not shared)
	vpc = new SharedVpc('vpc', {
		environmentName,
		// eslint-disable-next-line sonarjs/no-hardcoded-ip
		cidrBlock: '10.0.0.0/16',
		numberOfAvailabilityZones: 2,
		createNatGateways: false, // Cost optimization
		tags: commonTags,
	})

	// Create ALB security group
	const permAlbSecurityGroup = new aws.ec2.SecurityGroup('alb-sg', {
		vpcId: vpc.vpcId,
		description: `Security group for ${environmentName} ALB`,
		ingress: [
			{
				protocol: 'tcp',
				fromPort: 80,
				toPort: 80,
				cidrBlocks: ['0.0.0.0/0'],
				description: 'HTTP',
			},
			{
				protocol: 'tcp',
				fromPort: 443,
				toPort: 443,
				cidrBlocks: ['0.0.0.0/0'],
				description: 'HTTPS',
			},
		],
		egress: [
			{
				protocol: '-1',
				fromPort: 0,
				toPort: 0,
				cidrBlocks: ['0.0.0.0/0'],
				description: 'All outbound',
			},
		],
		tags: {
			Name: `macro-ai-${environmentName}-alb-sg`,
			...commonTags,
		},
	})

	sharedAlbSecurityGroupId = permAlbSecurityGroup.id

	// Create shared ALB (for dev, also shared by PRs)
	sharedAlb = new SharedAlb('alb', {
		environmentName,
		vpcId: vpc.vpcId,
		subnetIds: vpc.publicSubnetIds,
		securityGroupId: permAlbSecurityGroup.id,
		baseDomainName: hostedZoneId ? baseDomainName : undefined,
		hostedZoneId,
		enableDeletionProtection: environmentName === 'production',
		tags: commonTags,
	})

	// Create target group
	const permTargetGroup = new aws.lb.TargetGroup(`${environmentName}-tg`, {
		name: `macro-ai-${environmentName}-tg`,
		port: APP_CONFIG.port,
		protocol: 'HTTP',
		vpcId: vpc.vpcId,
		targetType: 'ip',
		healthCheck: {
			enabled: true,
			healthyThreshold: 2,
			interval: 30,
			matcher: '200',
			path: '/api/health',
			protocol: 'HTTP',
			timeout: 5,
			unhealthyThreshold: 3,
		},
		deregistrationDelay: 30,
		tags: {
			Name: `macro-ai-${environmentName}-tg`,
			...commonTags,
		},
	})

	// Create listener rule (if custom domain)
	if (customDomainName && sharedAlb.httpsListener) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const permListenerRule = new AlbListenerRule(
			`${environmentName}-listener-rule`,
			{
				environmentName,
				listenerArn: sharedAlb.httpsListener.arn,
				targetGroupArn: permTargetGroup.arn,
				customDomainName,
				priority: 100, // Base priority for permanent environments
				hostedZoneId,
				albDnsName: sharedAlb.albDnsName,
				albZoneId: sharedAlb.albZoneId,
				tags: commonTags,
			},
		)
	}

	// Create ECS cluster
	const permCluster = new aws.ecs.Cluster(`${environmentName}-cluster`, {
		name: `macro-ai-${environmentName}-cluster`,
		tags: {
			Name: `macro-ai-${environmentName}-cluster`,
			...commonTags,
		},
	})

	// Get Doppler secrets
	const dopplerConfig = getDopplerConfig(environmentName, deploymentType)
	const permDopplerToken = config.getSecret('doppler:dopplerToken')
	const permEnvironmentVariables = getDopplerSecrets(
		permDopplerToken,
		'macro-ai',
		dopplerConfig,
		{
			NODE_ENV: 'production',
			SERVER_PORT: String(APP_CONFIG.port),
			APP_ENV: environmentName,
			CUSTOM_DOMAIN_NAME: customDomainName || '',
		},
	)

	// Resolve image URI
	const permResolvedImageUri = resolveImageUri(
		imageUri,
		ecrRepositoryName,
		imageTag,
	)

	// Create Fargate service
	// permFargateService is intentionally unused - created for Pulumi resource side effects
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const permFargateService = new FargateService(`${environmentName}-service`, {
		environmentName,
		clusterArn: permCluster.arn,
		vpcId: vpc.vpcId,
		subnetIds: vpc.publicSubnetIds,
		imageUri: permResolvedImageUri,
		environmentVariables: permEnvironmentVariables,
		targetGroupArn: permTargetGroup.arn,
		albSecurityGroupId: sharedAlbSecurityGroupId,
		cpu: COST_OPTIMIZATION.ecsCpu,
		memory: COST_OPTIMIZATION.ecsMemory,
		desiredCount: 1,
		logRetentionDays: isPermanentEnvironment
			? COST_OPTIMIZATION.logRetentionDays.permanent
			: COST_OPTIMIZATION.logRetentionDays.preview,
		tags: commonTags,
	})

	// ===================================================================
	// SHARED RESOURCE INITIALIZATION COMPLETE
	// ===================================================================
}

// ===================================================================
// FINAL EXPORTS (Guaranteed to be available after all initialization)
// ===================================================================

// These exports are guaranteed to be available since they're set in both code paths
export const finalVpcId = vpc!.vpcId
export const finalAlbSecurityGroupId = sharedAlbSecurityGroupId!
export const finalAlbDnsName = sharedAlb!.albDnsName
export const finalAlbZoneId = sharedAlb!.albZoneId
export const finalHttpsListenerArn = sharedAlb!.httpsListener?.arn

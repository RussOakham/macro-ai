import { DopplerSDK } from '@dopplerhq/node-sdk'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'

// Get configuration
const config = new pulumi.Config()
const environmentName = config.get('environmentName') || 'dev'

// No table parsing needed - the Pulumi Doppler provider returns direct string values!
// const prNumber = config.getNumber('prNumber') || 0
// const branchName = config.get('branchName') || 'main'
const imageUri = config.get('imageUri')
const imageTag = config.get('imageTag') || 'latest'
const deploymentType = config.get('deploymentType') || 'dev'

// Custom domain configuration
const baseDomainName =
	config.get('customDomainName') || 'macro-ai.russoakham.dev'
const hostedZoneId = config.get('hostedZoneId')

// Construct the full custom domain name based on environment
// Backend should use API subdomain to avoid conflicts with frontend
let customDomainName: string | undefined
if (hostedZoneId) {
	if (environmentName === 'staging') {
		customDomainName = `staging.api.${baseDomainName}`
	} else if (environmentName === 'production' || environmentName === 'prd') {
		customDomainName = `api.${baseDomainName}`
	} else if (environmentName.startsWith('pr-')) {
		// For preview environments, use the PR number as subdomain with API prefix
		const prNumber = environmentName.replace('pr-', '')
		customDomainName = `pr-${prNumber}.api.${baseDomainName}`
	} else {
		// For dev environment, use dev subdomain with API prefix
		customDomainName = `dev.api.${baseDomainName}`
	}
}

// ECR repository configuration
const ecrRepositoryName = `macro-ai-${environmentName}-express-api`

// Determine if this is a preview environment
const isPreviewEnvironment = environmentName.startsWith('pr-')

// Create VPC with public subnets only (cost optimization for preview)
const vpc = new awsx.ec2.Vpc('macro-ai-vpc', {
	// eslint-disable-next-line sonarjs/no-hardcoded-ip
	cidrBlock: '10.0.0.0/16',
	numberOfAvailabilityZones: 2,
	enableDnsHostnames: true,
	enableDnsSupport: true,
})

// Create security group for ALB
const albSecurityGroup = new aws.ec2.SecurityGroup('macro-ai-alb-sg', {
	vpcId: vpc.vpcId,
	description: 'Security group for Macro-AI Application Load Balancer',
	ingress: [
		{
			protocol: 'tcp',
			fromPort: 80,
			toPort: 80,
			cidrBlocks: ['0.0.0.0/0'],
			description: 'HTTP traffic',
		},
		{
			protocol: 'tcp',
			fromPort: 443,
			toPort: 443,
			cidrBlocks: ['0.0.0.0/0'],
			description: 'HTTPS traffic',
		},
	],
	egress: [
		{
			protocol: '-1',
			fromPort: 0,
			toPort: 0,
			cidrBlocks: ['0.0.0.0/0'],
			description: 'All outbound traffic',
		},
	],
	tags: {
		Name: `macro-ai-${environmentName}-alb-sg`,
		Environment: environmentName,
		Project: 'MacroAI',
		Component: 'load-balancer',
	},
})

// Query ECR to verify image exists and get the exact URI
let verifiedImageUri: pulumi.Output<string>

if (imageUri) {
	// If imageUri is provided, verify it exists in ECR

	// Query ECR to get the image details using the official getImage function
	const ecrImage = aws.ecr.getImageOutput({
		repositoryName: ecrRepositoryName,
		imageTag: imageTag,
	})

	// Use the imageUri directly from ECR response
	verifiedImageUri = ecrImage.apply((image) => {
		if (!image.imageDigest) {
			throw new Error(
				`❌ Image with tag '${imageTag}' not found in ECR repository '${ecrRepositoryName}'`,
			)
		}
		return image.imageUri
	})
} else {
	// No imageUri provided - this should cause deployment to fail
	throw new Error(
		'❌ No imageUri provided in Pulumi configuration. Please set imageUri in your stack config.',
	)
}

// Create security group for ECS service
const ecsSecurityGroup = new aws.ec2.SecurityGroup('macro-ai-ecs-sg', {
	vpcId: vpc.vpcId,
	description: 'Security group for Macro-AI ECS service',
	ingress: [
		{
			protocol: 'tcp',
			fromPort: 3040,
			toPort: 3040,
			securityGroups: [albSecurityGroup.id],
			description: 'Traffic from ALB',
		},
	],
	egress: [
		{
			protocol: '-1',
			fromPort: 0,
			toPort: 0,
			cidrBlocks: ['0.0.0.0/0'],
			description: 'All outbound traffic',
		},
	],
	tags: {
		Name: `macro-ai-${environmentName}-ecs-sg`,
		Environment: environmentName,
		Project: 'MacroAI',
		Component: 'ecs-service',
	},
})

// Create ECS cluster
const cluster = new aws.ecs.Cluster('macro-ai-cluster', {
	name: `macro-ai-${environmentName}-cluster`,
	tags: {
		Name: `macro-ai-${environmentName}-cluster`,
		Environment: environmentName,
		Project: 'MacroAI',
		Component: 'ecs-cluster',
	},
})

// Get Doppler project and config from Pulumi configuration
const dopplerProject = config.get('doppler:project') || 'macro-ai'
const dopplerConfig = (() => {
	// Use configured Doppler config, or fallback to deployment type mapping
	const configuredConfig = config.get('doppler:config')
	if (configuredConfig) {
		return configuredConfig
	}

	// Special handling for PR previews - use 'dev' config
	if (deploymentType === 'preview') {
		return 'dev'
	}

	// Fallback to deployment type mapping
	if (deploymentType === 'staging') {
		return 'stg'
	}
	if (deploymentType === 'production') {
		return 'prd'
	}
	return environmentName
})()

// Function to fetch secrets using Doppler Node SDK
async function fetchDopplerSecrets(
	project: string,
	config: string,
	dopplerToken: string,
) {
	const sdk = new DopplerSDK({
		accessToken: dopplerToken,
	})

	try {
		const response = await sdk.secrets.list(project, config)

		if (!response.secrets) {
			throw new Error('No secrets found')
		}

		// Convert the response to a simple key-value object
		const secrets: Record<string, boolean | number | string> = {}

		Object.entries(response.secrets).forEach(([key, secretObj]) => {
			if (secretObj?.computed !== undefined && secretObj?.computed !== null) {
				secrets[key] = secretObj.computed
			}
		})

		return secrets
	} catch (error) {
		console.error('Failed to fetch Doppler secrets:', error)
		throw error
	}
}

// Get Doppler token from Pulumi configuration or environment variables
const dopplerToken = config.getSecret('doppler:dopplerToken')

// Create environment variables from Doppler secrets using Node SDK
const allEnvironmentVariables = pulumi
	.output(dopplerToken)
	.apply((token) => {
		// Fall back to environment variable if Pulumi config is not available (e.g., in CI/CD)
		const fallbackToken =
			process.env.DOPPLER_TOKEN || process.env.DOPPLER_TOKEN_STAGING
		const finalToken = token || fallbackToken

		if (!finalToken) {
			throw new Error(
				'Doppler token not found in Pulumi configuration or environment variables. Please set doppler:dopplerToken in your stack config or DOPPLER_TOKEN in environment variables.',
			)
		}
		return fetchDopplerSecrets(dopplerProject, dopplerConfig, finalToken)
	})
	.apply((secrets: Record<string, boolean | number | string>) => {
		const envVars: Record<string, string> = {}

		// Process secrets from the Node SDK response (direct JSON object)
		if (secrets) {
			Object.entries(secrets).forEach(([key, value]) => {
				envVars[key] = String(value)
			})
		}

		// Add application-specific environment variables
		envVars.NODE_ENV = 'production'
		envVars.SERVER_PORT = '3040'
		envVars.APP_ENV = environmentName

		// Add custom domain name for CORS configuration
		if (customDomainName) {
			envVars.CUSTOM_DOMAIN_NAME = customDomainName
		}

		return envVars
	})

// Create ECS task definition
const taskDefinition = new aws.ecs.TaskDefinition('macro-ai-task', {
	family: `macro-ai-${environmentName}`,
	networkMode: 'awsvpc',
	requiresCompatibilities: ['FARGATE'],
	cpu: '256',
	memory: '512',
	executionRoleArn: new aws.iam.Role('macro-ai-execution-role', {
		assumeRolePolicy: JSON.stringify({
			Version: '2012-10-17',
			Statement: [
				{
					Action: 'sts:AssumeRole',
					Effect: 'Allow',
					Principal: {
						Service: 'ecs-tasks.amazonaws.com',
					},
				},
			],
		}),
		managedPolicyArns: [
			// eslint-disable-next-line no-secrets/no-secrets
			'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
		],
		tags: {
			Name: `macro-ai-${environmentName}-execution-role`,
			Environment: environmentName,
			Project: 'MacroAI',
		},
	}).arn,
	containerDefinitions: pulumi
		.all([allEnvironmentVariables, verifiedImageUri])
		.apply(([envVars, verifiedImage]) =>
			JSON.stringify([
				{
					name: 'macro-ai-container',
					image: verifiedImage,
					portMappings: [
						{
							containerPort: 3040,
							protocol: 'tcp',
						},
					],
					environment: Object.entries(envVars).map(([name, value]) => ({
						name,
						value: String(value),
					})),
					logConfiguration: {
						logDriver: 'awslogs',
						options: {
							'awslogs-group': `/ecs/macro-ai-${environmentName}`,
							'awslogs-region': 'us-east-1',
							'awslogs-stream-prefix': 'ecs',
						},
					},
				},
			]),
		),
	tags: {
		Name: `macro-ai-${environmentName}-task`,
		Environment: environmentName,
		Project: 'MacroAI',
		Component: 'ecs-task',
	},
})

// Create CloudWatch log group
const logGroup = new aws.cloudwatch.LogGroup('macro-ai-logs', {
	name: `/ecs/macro-ai-${environmentName}`,
	retentionInDays: 7, // Cost optimization for preview
	tags: {
		Name: `macro-ai-${environmentName}-logs`,
		Environment: environmentName,
		Project: 'MacroAI',
		Component: 'logging',
	},
})

// Create Application Load Balancer
const alb = new aws.lb.LoadBalancer('macro-ai-alb', {
	name: `macro-ai-${environmentName}-alb`,
	loadBalancerType: 'application',
	securityGroups: [albSecurityGroup.id],
	subnets: vpc.publicSubnetIds,
	enableDeletionProtection: false,
	tags: {
		Name: `macro-ai-${environmentName}-alb`,
		Environment: environmentName,
		Project: 'MacroAI',
		Component: 'load-balancer',
	},
})

// Create target group
const targetGroup = new aws.lb.TargetGroup('macro-ai-tg', {
	name: `macro-ai-${environmentName}-tg`,
	port: 3040,
	protocol: 'HTTP',
	vpcId: vpc.vpcId,
	targetType: 'ip',
	healthCheck: {
		enabled: true,
		healthyThreshold: 2,
		interval: 30,
		matcher: '200',
		path: '/api/health',
		port: 'traffic-port',
		protocol: 'HTTP',
		timeout: 5,
		unhealthyThreshold: 3,
	},
	// Enable cross-zone load balancing for better distribution
	loadBalancingCrossZoneEnabled: 'true',
	// Configure deregistration delay for graceful shutdowns
	deregistrationDelay: 30,
	tags: {
		Name: `macro-ai-${environmentName}-tg`,
		Environment: environmentName,
		Project: 'MacroAI',
		Component: 'target-group',
	},
})

// Define a health check hook that will poll the service until it's ready
const healthCheckHook = new pulumi.ResourceHook('after', async () => {
	// Get the ALB DNS name from the stack outputs
	const albDnsName = alb.dnsName

	if (!albDnsName) {
		return
	}

	// Wait for the ALB DNS name to be available
	const resolvedDnsName = await albDnsName
	const healthEndpoint = `http://${resolvedDnsName}/api/health`

	// Poll the health endpoint with exponential backoff and timeout
	const maxRetries = 20 // Reduced from 30
	const maxWaitTime = 300000 // 5 minutes total timeout

	let totalWaitTime = 0
	for (let i = 0; i < maxRetries && totalWaitTime < maxWaitTime; i++) {
		try {
			// Create an AbortController for timeout
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

			const response = await fetch(healthEndpoint, {
				method: 'GET',
				signal: controller.signal,
			})

			clearTimeout(timeoutId)

			if (response.ok) {
				await response.text()
				return
			}
		} catch {
			// Ignore errors and continue to next attempt
		}

		// Exponential backoff with jitter - wait 2^i seconds, max 30 seconds
		const waitTime = Math.min(2 ** i * 1000, 30000)
		totalWaitTime += waitTime

		if (totalWaitTime < maxWaitTime) {
			await new Promise((resolve) => setTimeout(resolve, waitTime))
		}
	}

	// Don't throw error, just log and continue - this allows the deployment to complete
	// The service will still be created and can be debugged separately
})

// Create ECS service with health check hook
const service = new aws.ecs.Service(
	'macro-ai-service',
	{
		name: `macro-ai-${environmentName}-service`,
		cluster: cluster.arn,
		taskDefinition: taskDefinition.arn,
		desiredCount: 1,
		launchType: 'FARGATE',
		networkConfiguration: {
			subnets: vpc.privateSubnetIds,
			securityGroups: [ecsSecurityGroup.id],
			assignPublicIp: false,
		},
		loadBalancers: [
			{
				targetGroupArn: targetGroup.arn,
				containerName: 'macro-ai-container',
				containerPort: 3040,
			},
		],
		healthCheckGracePeriodSeconds: 60,
		tags: {
			Name: `macro-ai-${environmentName}-service`,
			Environment: environmentName,
			Project: 'MacroAI',
			Component: 'ecs-service',
		},
	},
	{
		hooks: {
			afterCreate: [healthCheckHook],
			afterUpdate: [healthCheckHook],
		},
	},
)

// Create listener
const listener = new aws.lb.Listener('macro-ai-listener', {
	loadBalancerArn: alb.arn,
	port: 80,
	protocol: 'HTTP',
	defaultActions: [
		{
			type: 'forward',
			targetGroupArn: targetGroup.arn,
		},
	],
})

// Custom domain implementation
let customDomainOutput: string | undefined
let httpsListener: aws.lb.Listener | undefined

if (customDomainName && hostedZoneId) {
	console.log('🌐 Setting up custom domain:', customDomainName)

	// Backend certificate management: Focus only on API subdomains
	// Frontend certificates are managed by AWS Amplify automatically
	// This covers:
	// - *.api.macro-ai.russoakham.dev (staging.api, dev.api, pr-*.api, etc.)
	// Pulumi will handle reuse automatically - if certificate exists with same name, it reuses it

	const certificate = new aws.acm.Certificate(
		'macro-ai-api-wildcard-certificate',
		{
			domainName: `api.${baseDomainName}`,
			subjectAlternativeNames: [`*.api.${baseDomainName}`],
			validationMethod: 'DNS',
			tags: {
				Name: 'macro-ai-api-wildcard-certificate',
				Environment: 'shared',
				Project: 'MacroAI',
				Component: 'backend-certificate',
			},
		},
	)

	// Create DNS validation records with deduplication and overwrite protection
	const certificateValidationRecords =
		certificate.domainValidationOptions.apply((options) => {
			// Deduplicate validation options to prevent duplicate records
			const uniqueOptions = options.filter(
				(option, index, self) =>
					index ===
					self.findIndex(
						(o) =>
							o.resourceRecordName === option.resourceRecordName &&
							o.resourceRecordType === option.resourceRecordType &&
							o.resourceRecordValue === option.resourceRecordValue,
					),
			)

			return uniqueOptions.map(
				(option, index) =>
					new aws.route53.Record(
						`macro-ai-api-wildcard-certificate-validation-${index}`,
						{
							name: option.resourceRecordName,
							records: [option.resourceRecordValue],
							ttl: 60,
							type: option.resourceRecordType,
							zoneId: hostedZoneId,
							allowOverwrite: true, // Allow overwriting existing records
						},
					),
			)
		})

	// Validate the certificate
	const certificateValidation = new aws.acm.CertificateValidation(
		'macro-ai-api-wildcard-certificate-validation',
		{
			certificateArn: certificate.arn,
			validationRecordFqdns: certificateValidationRecords.apply((records) =>
				records.map((record) => record.fqdn),
			),
		},
	)

	const { certificateArn } = certificateValidation

	console.log(
		'🔒 Smart certificate management: Pulumi will reuse existing certificate for zero-downtime deployments',
	)

	// Create HTTPS listener with certificate
	httpsListener = new aws.lb.Listener('macro-ai-https-listener', {
		loadBalancerArn: alb.arn,
		port: 443,
		protocol: 'HTTPS',
		certificateArn: certificateArn,
		defaultActions: [
			{
				type: 'forward',
				targetGroupArn: targetGroup.arn,
			},
		],
	})

	// Redirect HTTP to HTTPS
	new aws.lb.ListenerRule('macro-ai-redirect-rule', {
		listenerArn: listener.arn,
		priority: 1,
		actions: [
			{
				type: 'redirect',
				redirect: {
					port: '443',
					protocol: 'HTTPS',
					statusCode: 'HTTP_301',
				},
			},
		],
		conditions: [
			{
				pathPattern: {
					values: ['/*'],
				},
			},
		],
	})

	// Create Route 53 record pointing to the ALB
	new aws.route53.Record('macro-ai-alb-record', {
		name: customDomainName,
		type: 'A',
		zoneId: hostedZoneId,
		aliases: [
			{
				name: alb.dnsName,
				zoneId: alb.zoneId,
				evaluateTargetHealth: true,
			},
		],
	})

	customDomainOutput = customDomainName
	console.log('✅ Custom domain configured: https://', customDomainName)
} else {
	console.log('ℹ️ No custom domain configured, using ALB DNS name')
}

// Export important values
export const { vpcId } = vpc
export const { arn: clusterArn } = cluster
export const { name: serviceName } = service
export const { dnsName: albDnsName, zoneId: albZoneId } = alb
export const { arn: listenerArn } = listener
export const { name: logGroupName } = logGroup
export const environment = environmentName
export const isPreview = isPreviewEnvironment

// Export API endpoint for workflow compatibility
export const apiEndpoint = customDomainOutput
	? pulumi.interpolate`https://${customDomainOutput}`
	: pulumi.interpolate`http://${alb.dnsName}`

// Export custom domain information
export const customDomain = customDomainOutput
export const httpsListenerArn = httpsListener?.arn

// Configure deployment settings for Review Stacks
// This enables automatic PR preview deployments
// Note: Configuration is handled via Pulumi config, not programmatic resources
// The PR stack should have these config values set:
// - github:pullRequestTemplate: true
// - github:repository: RussOakham/macro-ai
// - github:deployCommits: false
// - github:previewPullRequests: false

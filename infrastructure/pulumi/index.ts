import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'
import * as doppler from '@pulumiverse/doppler'

// Get configuration
const config = new pulumi.Config()
const environmentName = config.get('environmentName') || 'dev'
// const prNumber = config.getNumber('prNumber') || 0
// const branchName = config.get('branchName') || 'main'
const imageUri = config.get('imageUri') || 'nginx:latest'
const imageTag = config.get('imageTag') || 'latest'
const deploymentType = config.get('deploymentType') || 'dev'
// const deploymentScale = config.get('deploymentScale') || 'preview'

// ECR repository configuration
const ecrRepositoryName = `macro-ai-${environmentName}-express-api`
const awsRegion = 'us-east-1'

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

if (imageUri && imageUri !== 'nginx:latest') {
	// If imageUri is provided, verify it exists in ECR
	console.log(`🔍 Verifying image exists in ECR: ${imageUri}`)

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
		console.log(`✅ Verified image URI from ECR: ${image.imageUri}`)
		return image.imageUri
	})
} else {
	// Fallback to provided imageUri or default
	verifiedImageUri = pulumi.output(imageUri)
	console.log(`⚠️  Using fallback image URI: ${imageUri}`)
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

// Get secrets from Doppler using the official provider
// Map deployment type to Doppler config
const dopplerConfig = (() => {
	if (deploymentType === 'staging') {
		return 'stg'
	}
	if (deploymentType === 'production') {
		return 'prd'
	}
	return environmentName
})()

const dopplerSecrets = doppler.getSecretsOutput({
	project: 'macro-ai',
	config: dopplerConfig,
})

// Helper function to extract secret value from Doppler table format
function extractSecretFromTable(value: string, key: string): null | string {
	// The values are in a formatted table, we need to extract the actual value
	// Look for the pattern: '│ KEY_NAME │ actual_value │'
	const regex = /│\s+\w+\s+│\s+([^│\s]+)\s+│/u
	const match = regex.exec(value)
	if (match && match[1]) {
		// Clean up the extracted value
		const cleanValue = match[1].trim()
		// Skip table headers and empty values
		if (
			cleanValue &&
			cleanValue !== 'VALUE' &&
			cleanValue !== 'RAW VALUE' &&
			cleanValue !== 'NOTE' &&
			cleanValue !== 'NAME' &&
			cleanValue !== '─' &&
			!cleanValue.startsWith('├') &&
			!cleanValue.startsWith('└') &&
			!cleanValue.startsWith('┌')
		) {
			// eslint-disable-next-line no-console
			console.log(`Extracted ${key}: [REDACTED]`)
			return cleanValue
		}
	}

	// Fallback: try to extract from the table format more broadly
	// Look for lines that contain the key and extract the value from the VALUE column
	const lines = value.split('\n')
	for (const line of lines) {
		if (line.includes('│') && line.includes(key)) {
			const parts = line.split('│')
			if (parts.length >= 3 && parts[2]) {
				const cleanValue = parts[2].trim()
				// Skip table headers and empty values
				if (
					cleanValue &&
					cleanValue !== 'VALUE' &&
					cleanValue !== 'RAW VALUE' &&
					cleanValue !== 'NOTE' &&
					cleanValue !== 'NAME' &&
					cleanValue !== '─' &&
					!cleanValue.startsWith('├') &&
					!cleanValue.startsWith('└') &&
					!cleanValue.startsWith('┌')
				) {
					// eslint-disable-next-line no-console
					console.log(`Extracted ${key}: [REDACTED]`)
					return cleanValue
				}
			}
		}
	}

	// Additional fallback: look for multi-line values that span multiple rows
	// This handles cases where the value is split across multiple lines
	const valueLines = []
	let inValueSection = false
	for (const line of lines) {
		if (line.includes('│') && line.includes(key) && !line.includes('NAME')) {
			inValueSection = true
			const parts = line.split('│')
			if (parts.length >= 3 && parts[2]) {
				const cleanValue = parts[2].trim()
				if (
					cleanValue &&
					cleanValue !== 'VALUE' &&
					cleanValue !== 'RAW VALUE'
				) {
					valueLines.push(cleanValue)
				}
			}
		} else if (inValueSection && line.includes('│') && !line.includes('└')) {
			const parts = line.split('│')
			if (parts.length >= 3 && parts[2]) {
				const cleanValue = parts[2].trim()
				if (
					cleanValue &&
					cleanValue !== 'VALUE' &&
					cleanValue !== 'RAW VALUE'
				) {
					valueLines.push(cleanValue)
				}
			}
		} else if (inValueSection && line.includes('└')) {
			break
		}
	}

	if (valueLines.length > 0) {
		const fullValue = valueLines.join('')
		// eslint-disable-next-line no-console
		console.log(`Extracted ${key} (multi-line): [REDACTED]`)
		return fullValue
	}

	return null
}

// Create environment variables from Doppler secrets
const allEnvironmentVariables = dopplerSecrets.apply((secrets) => {
	const envVars: Record<string, string> = {}

	// Debug: Log what we're getting from Doppler (keys only for security)
	// eslint-disable-next-line no-console
	console.log('Doppler secrets received:', Object.keys(secrets))

	// The Doppler provider returns secrets in a different structure
	// The actual secrets are in the 'map' property
	if (secrets && secrets.map && typeof secrets.map === 'object') {
		// Extract actual secret values from the map
		Object.entries(secrets.map).forEach(([key, value]) => {
			const extractedValue = extractSecretFromTable(String(value), key)
			if (extractedValue) {
				envVars[key] = extractedValue
			}
		})
	}

	// Add application-specific environment variables
	envVars.NODE_ENV = 'production'
	envVars.SERVER_PORT = '3040'
	envVars.APP_ENV = environmentName

	// eslint-disable-next-line no-console
	console.log('Final environment variables count:', Object.keys(envVars).length)
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
	const albDnsName = alb.dnsName.apply((dns) => dns)

	if (!albDnsName) {
		// eslint-disable-next-line no-console
		console.log('Health check: ALB DNS name not available yet')
		return
	}

	// Wait for the ALB DNS name to be available
	const resolvedDnsName = await albDnsName
	const healthEndpoint = `http://${resolvedDnsName}/api/health`
	// eslint-disable-next-line no-console
	console.log('Health check: Starting health check for', healthEndpoint)

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
				const data = await response.text()
				// eslint-disable-next-line no-console
				console.log('Health check passed:', data)
				return
			} else {
				// eslint-disable-next-line no-console
				console.log(
					'Health check attempt',
					i + 1,
					'failed: HTTP',
					response.status,
				)
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.log('Health check attempt', i + 1, 'failed:', String(error))
		}

		// Exponential backoff with jitter - wait 2^i seconds, max 30 seconds
		const waitTime = Math.min(2 ** i * 1000, 30000)
		totalWaitTime += waitTime

		if (totalWaitTime < maxWaitTime) {
			// eslint-disable-next-line no-console
			console.log(`Waiting ${waitTime / 1000} seconds before next attempt...`)
			await new Promise((resolve) => setTimeout(resolve, waitTime))
		}
	}

	// eslint-disable-next-line no-console
	console.log(
		`Health check failed after ${maxRetries} attempts or ${totalWaitTime / 1000} seconds`,
	)
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
export const apiEndpoint = pulumi.interpolate`http://${alb.dnsName}`

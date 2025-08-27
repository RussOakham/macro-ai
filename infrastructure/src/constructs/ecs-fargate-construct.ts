import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

import { EnvironmentConfigConstruct } from './environment-config-construct.js'

export interface EcsFargateConstructProps {
	/**
	 * VPC where ECS services will be deployed
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Security group for ECS tasks
	 */
	readonly securityGroup: ec2.ISecurityGroup

	/**
	 * Environment name for resource naming and tagging
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * Branch name for deployment tracking
	 */
	readonly branchName?: string

	/**
	 * Custom domain name for CORS configuration
	 */
	readonly customDomainName?: string

	/**
	 * ECS Task CPU and Memory configuration
	 * @default { cpu: 256, memoryLimitMiB: 512 } (cost-optimized for development)
	 */
	readonly taskDefinition?: {
		readonly cpu: number
		readonly memoryLimitMiB: number
	}

	/**
	 * Enable detailed monitoring and logging
	 * @default false (cost optimization)
	 */
	readonly enableDetailedMonitoring?: boolean

	/**
	 * Auto-scaling configuration
	 */
	readonly autoScaling?: {
		readonly minCapacity: number
		readonly maxCapacity: number
		readonly targetCpuUtilization: number
	}

	/**
	 * ECR repository for the container image
	 * If not provided, will create a new one
	 */
	readonly ecrRepository?: ecr.IRepository

	/**
	 * Container image tag to deploy
	 * @default 'latest'
	 */
	readonly imageTag?: string

	/**
	 * Full container image URI to deploy (overrides ecrRepository and imageTag)
	 * If provided, this will be used instead of constructing the image URI
	 * from ecrRepository and imageTag
	 */
	readonly imageUri?: string

	/**
	 * Container port for the application
	 * @default 3000
	 */
	readonly containerPort?: number

	/**
	 * Health check configuration
	 */
	readonly healthCheck?: {
		readonly path: string
		readonly interval: cdk.Duration
		readonly timeout: cdk.Duration
		readonly healthyThresholdCount: number
		readonly unhealthyThresholdCount: number
	}

	/**
	 * Environment configuration construct for Parameter Store integration
	 * This provides all environment variables from Parameter Store
	 */
	readonly environmentConfig: EnvironmentConfigConstruct
}

export interface PrEcsServiceProps {
	/**
	 * PR number for resource naming and tagging
	 */
	readonly prNumber: number

	/**
	 * VPC where the service will be deployed
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Security group for the PR service
	 */
	readonly securityGroup: ec2.ISecurityGroup

	/**
	 * Environment name for resource naming
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * ECS Task CPU and Memory configuration
	 * @default { cpu: 256, memoryLimitMiB: 512 }
	 */
	readonly taskDefinition?: {
		readonly cpu: number
		readonly memoryLimitMiB: number
	}

	/**
	 * ECR repository for the container image
	 */
	readonly ecrRepository?: ecr.IRepository

	/**
	 * Container image tag to deploy
	 * @default 'latest'
	 */
	readonly imageTag?: string
}

/**
 * ECS Fargate Construct for Macro AI Express API
 *
 * This construct replaces the EC2-based deployment with a modern containerized approach:
 * - ECS Fargate for serverless container management
 * - Auto-scaling based on CPU/memory utilization
 * - Integrated logging and monitoring
 * - Parameter Store integration for configuration
 * - Health checks and load balancer integration
 * - Cost-optimized task sizing for different environments
 */
export class EcsFargateConstruct extends Construct {
	public readonly cluster: ecs.ICluster
	public readonly taskDefinition: ecs.FargateTaskDefinition
	public readonly service: ecs.FargateService
	public readonly autoScalingGroup?: autoscaling.AutoScalingGroup
	public readonly ecrRepository: ecr.IRepository
	public readonly taskRole: iam.Role
	public readonly executionRole: iam.Role
	public readonly scalableTaskCount?: ecs.ScalableTaskCount
	public readonly environmentConfig: EnvironmentConfigConstruct

	constructor(scope: Construct, id: string, props: EcsFargateConstructProps) {
		super(scope, id)

		console.log('🔍 ECS Fargate Construct: Starting construction...')

		const {
			vpc,
			securityGroup,
			environmentName = 'development',
			branchName,
			customDomainName,
			taskDefinition: taskConfig = { cpu: 256, memoryLimitMiB: 512 },
			// Note: parameterStorePrefix is no longer needed - the application determines it from APP_ENV
			enableDetailedMonitoring = false,
			autoScaling: scalingConfig,
			ecrRepository: providedEcrRepository,
			imageTag = 'latest',
			imageUri,
			containerPort = 3000,
			healthCheck = {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
			environmentConfig,
		} = props

		// Store environment config for use in task definition
		this.environmentConfig = environmentConfig
		console.log(
			'🔍 ECS Fargate Construct: Environment config stored successfully',
		)

		// Create or use provided ECR repository
		this.ecrRepository =
			providedEcrRepository ??
			new ecr.Repository(this, 'EcrRepository', {
				repositoryName: `macro-ai-${environmentName}-express-api`,
				imageScanOnPush: true, // Security best practice
				removalPolicy: cdk.RemovalPolicy.DESTROY, // Clean up on stack deletion
			})

		// Create ECS cluster
		this.cluster = new ecs.Cluster(this, 'EcsCluster', {
			vpc,
			clusterName: `macro-ai-${environmentName}-cluster`,
			// Note: containerInsightsV2 has complex type requirements, disabling for now
			// TODO: Re-enable when type issues are resolved
			enableFargateCapacityProviders: true,
		})

		// Create IAM roles for ECS tasks
		// Note: parameterStorePrefix is no longer needed for the task role since the application determines it from APP_ENV
		this.taskRole = this.createTaskRole(environmentName)
		this.executionRole = this.createExecutionRole(environmentName)

		// Create Fargate task definition
		this.taskDefinition = new ecs.FargateTaskDefinition(
			this,
			'TaskDefinition',
			{
				taskRole: this.taskRole,
				executionRole: this.executionRole,
				cpu: taskConfig.cpu,
				memoryLimitMiB: taskConfig.memoryLimitMiB,
				family: `macro-ai-${environmentName}-task`,
			},
		)

		// Determine container image source
		const containerImage = imageUri
			? ecs.ContainerImage.fromRegistry(imageUri)
			: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, imageTag)

		// Add container to task definition
		this.taskDefinition.addContainer('ExpressApiContainer', {
			image: containerImage,
			containerName: 'express-api',
			portMappings: [{ containerPort }],
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: `macro-ai-${environmentName}`,
				logRetention: logs.RetentionDays.ONE_WEEK, // Cost optimization
			}),
			environment: {
				// Use all environment variables from Parameter Store via EnvironmentConfigConstruct
				...this.environmentConfig.getAllEnvironmentVariables(),
				// Override with container-specific values
				NODE_ENV:
					environmentName === 'production' ? 'production' : 'development',
				APP_ENV: environmentName,
				// Add PR number for CORS configuration
				...(environmentName.startsWith('pr-') && {
					PR_NUMBER: environmentName.replace('pr-', ''),
				}),
				// Add custom domain for CORS configuration
				...(customDomainName && {
					CUSTOM_DOMAIN_NAME: customDomainName,
				}),
			},
			healthCheck: {
				command: [
					'CMD-SHELL',
					`wget --no-verbose --tries=1 --spider http://localhost:${containerPort}${healthCheck.path} || exit 1`,
				],
				interval: healthCheck.interval,
				timeout: healthCheck.timeout,
				retries: 3,
				startPeriod: cdk.Duration.seconds(60),
			},
		})

		// Create Fargate service
		this.service = new ecs.FargateService(this, 'FargateService', {
			cluster: this.cluster,
			taskDefinition: this.taskDefinition,
			serviceName: `macro-ai-${environmentName}-service`,
			desiredCount: scalingConfig?.minCapacity ?? 1,
			securityGroups: [securityGroup],
			vpcSubnets: {
				subnetType: ec2.SubnetType.PUBLIC, // Ensure service is in public subnets for internet access
			},
			assignPublicIp: true, // Cost optimization: no NAT Gateway needed
			platformVersion: ecs.FargatePlatformVersion.LATEST,
			enableExecuteCommand: true, // Enable ECS Exec for debugging
			circuitBreaker: { rollback: true }, // Auto-rollback on deployment failures
			healthCheckGracePeriod: cdk.Duration.seconds(60), // Match the task definition's startPeriod
			minHealthyPercent: 100, // Ensure 100% of desired tasks are running during deployments
		})

		// Configure auto-scaling if specified
		if (scalingConfig) {
			this.scalableTaskCount = this.service.autoScaleTaskCount({
				minCapacity: scalingConfig.minCapacity,
				maxCapacity: scalingConfig.maxCapacity,
			})

			// Scale up on CPU utilization
			this.scalableTaskCount.scaleOnCpuUtilization('CpuScaling', {
				targetUtilizationPercent: scalingConfig.targetCpuUtilization,
				scaleInCooldown: cdk.Duration.seconds(60),
				scaleOutCooldown: cdk.Duration.seconds(60),
			})

			// Scale up on memory utilization
			this.scalableTaskCount.scaleOnMemoryUtilization('MemoryScaling', {
				targetUtilizationPercent: 80,
				scaleInCooldown: cdk.Duration.seconds(60),
				scaleOutCooldown: cdk.Duration.seconds(60),
			})
		}

		// Add tags for resource management
		cdk.Tags.of(this).add('SubComponent', 'ECS-Fargate')
		cdk.Tags.of(this).add('SubEnvironmentType', environmentName)
		if (branchName) {
			cdk.Tags.of(this).add('SubBranch', branchName)
		}
		if (customDomainName) {
			cdk.Tags.of(this).add('SubCustomDomain', customDomainName)
		}
	}

	/**
	 * Create PR-specific ECS service for isolated preview environments
	 */
	public createPrService(props: PrEcsServiceProps): ecs.FargateService {
		const {
			prNumber,
			securityGroup,
			environmentName = 'development',
			taskDefinition: taskConfig = { cpu: 256, memoryLimitMiB: 512 },
			ecrRepository: providedEcrRepository,
			imageTag = 'latest',
		} = props

		// Create PR-specific ECR repository if not provided
		const ecrRepository =
			providedEcrRepository ??
			new ecr.Repository(this, `Pr${prNumber}EcrRepository`, {
				repositoryName: `macro-ai-${environmentName}-pr-${prNumber}-express-api`,
				imageScanOnPush: true,
				removalPolicy: cdk.RemovalPolicy.DESTROY,
			})

		// Create PR-specific task definition
		const taskDefinition = new ecs.FargateTaskDefinition(
			this,
			`Pr${prNumber}TaskDefinition`,
			{
				taskRole: this.taskRole,
				executionRole: this.executionRole,
				cpu: taskConfig.cpu,
				memoryLimitMiB: taskConfig.memoryLimitMiB,
				family: `macro-ai-${environmentName}-pr-${prNumber}-task`,
			},
		)

		// Add container to PR task definition
		taskDefinition.addContainer('ExpressApiContainer', {
			image: ecs.ContainerImage.fromEcrRepository(ecrRepository, imageTag),
			containerName: 'express-api',
			portMappings: [{ containerPort: 3000 }],
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: `macro-ai-${environmentName}-pr-${prNumber}`,
				logRetention: logs.RetentionDays.THREE_DAYS, // Shorter retention for PRs
			}),
			environment: {
				NODE_ENV: 'development',
				APP_ENV: `pr-${prNumber}`,
			},
			healthCheck: {
				command: [
					'CMD-SHELL',
					'curl -f http://localhost:3000/health || exit 1',
				],
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				retries: 3,
				startPeriod: cdk.Duration.seconds(60),
			},
		})

		// Create PR-specific Fargate service
		const service = new ecs.FargateService(this, `Pr${prNumber}Service`, {
			cluster: this.cluster,
			taskDefinition,
			serviceName: `macro-ai-${environmentName}-pr-${prNumber}-service`,
			desiredCount: 1, // Single instance for PRs
			securityGroups: [securityGroup],
			assignPublicIp: true,
			platformVersion: ecs.FargatePlatformVersion.LATEST,
			enableExecuteCommand: true,
			circuitBreaker: { rollback: true },
			healthCheckGracePeriod: cdk.Duration.seconds(60), // Match the task definition's startPeriod
		})

		// Add PR-specific tags
		cdk.Tags.of(service).add('SubComponent', 'ECS-Fargate-PR')
		cdk.Tags.of(service).add('SubEnvironmentType', `pr-${prNumber}`)
		cdk.Tags.of(service).add('SubPRNumber', prNumber.toString())

		return service
	}

	/**
	 * Create IAM role for ECS tasks with least-privilege access
	 */
	private createTaskRole(environmentName: string): iam.Role {
		const role = new iam.Role(this, 'EcsTaskRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			roleName: `macro-ai-${environmentName}-ecs-task-role`,
			description:
				'IAM role for Macro AI ECS tasks with least-privilege access',
		})

		// Parameter Store access for runtime configuration
		// The application automatically determines the parameter store prefix from APP_ENV
		// Grant access to all parameter store prefixes that might be needed
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ssm:GetParameter',
					'ssm:GetParameters',
					'ssm:GetParametersByPath',
				],
				resources: [
					// Access to all Macro AI parameter store prefixes
					'arn:aws:ssm:*:*:parameter/macro-ai/development/*',
					'arn:aws:ssm:*:*:parameter/macro-ai/staging/*',
					'arn:aws:ssm:*:*:parameter/macro-ai/production/*',
				],
			}),
		)

		// CloudWatch Logs (for application logging)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
					'logs:DescribeLogStreams',
				],
				resources: [
					`arn:aws:logs:*:*:log-group:/macro-ai/${environmentName}/*`,
				],
			}),
		)

		// CloudWatch Metrics (for monitoring)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
				conditions: {
					StringEquals: {
						'cloudwatch:namespace': 'MacroAI/ECS',
					},
				},
			}),
		)

		// AWS Cognito access for authentication
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'cognito-idp:AdminInitiateAuth',
					'cognito-idp:AdminRespondToAuthChallenge',
					'cognito-idp:AdminGetUser',
					'cognito-idp:AdminSetUserPassword',
					'cognito-idp:AdminCreateUser',
					'cognito-idp:AdminDeleteUser',
					'cognito-idp:AdminUpdateUserAttributes',
					'cognito-idp:AdminGetUserAttributes',
					'cognito-idp:AdminConfirmSignUp',
					'cognito-idp:AdminSetUserMFAPreference',
					'cognito-idp:AdminGetUserMFAPreference',
					'cognito-idp:AdminListUserAuthEvents',
					'cognito-idp:AdminListGroupsForUser',
					'cognito-idp:AdminAddUserToGroup',
					'cognito-idp:AdminRemoveUserFromGroup',
					'cognito-idp:AdminListUsers',
					'cognito-idp:AdminListGroups',
					'cognito-idp:AdminCreateGroup',
					'cognito-idp:AdminDeleteGroup',
					'cognito-idp:AdminUpdateGroupAttributes',
					'cognito-idp:AdminGetGroup',
					'cognito-idp:AdminListUsersInGroup',
					// Add non-admin Cognito actions that the application actually uses
					'cognito-idp:ListUsers',
					'cognito-idp:GetUser',
					'cognito-idp:DescribeUserPool',
					'cognito-idp:DescribeUserPoolClient',
				],
				resources: ['*'], // Cognito resources are regional, so we need broad access
			}),
		)

		// Additional AWS service permissions for application functionality
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'sts:GetCallerIdentity', // For getting current AWS account/region info
					'iam:GetUser', // For user information
					'iam:GetRole', // For role information
					// CloudWatch Logs for application logging
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
					'logs:DescribeLogStreams',
				],
				resources: ['*'],
			}),
		)

		// CloudWatch Logs specific permissions with proper resource scoping
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
					'logs:DescribeLogStreams',
				],
				resources: [
					`arn:aws:logs:*:*:log-group:/macro-ai/${environmentName}/*`,
					`arn:aws:logs:*:*:log-group:/macro-ai/${environmentName}:*`,
				],
			}),
		)

		// KMS permissions for decrypting Parameter Store SecureString values
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['kms:Decrypt', 'kms:DescribeKey'],
				resources: ['*'],
				conditions: {
					StringLike: {
						'kms:ViaService': 'ssm.*.amazonaws.com',
					},
				},
			}),
		)

		return role
	}

	/**
	 * Create IAM role for ECS task execution (pulling images, etc.)
	 */
	private createExecutionRole(environmentName: string): iam.Role {
		const role = new iam.Role(this, 'EcsExecutionRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			roleName: `macro-ai-${environmentName}-ecs-execution-role`,
			description: 'IAM role for Macro AI ECS task execution',
		})

		// ECR access for pulling images
		role.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName(
				'service-role/AmazonECSTaskExecutionRolePolicy',
			),
		)

		// Parameter Store access for task execution
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ssm:GetParameter',
					'ssm:GetParameters',
					'ssm:GetParametersByPath',
				],
				resources: ['*'], // Needed for task execution
			}),
		)

		return role
	}
}

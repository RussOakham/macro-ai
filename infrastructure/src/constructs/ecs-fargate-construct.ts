import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

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
	 * Parameter Store prefix for configuration
	 */
	readonly parameterStorePrefix: string

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
	 * Parameter Store prefix for configuration
	 */
	readonly parameterStorePrefix: string

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

	constructor(scope: Construct, id: string, props: EcsFargateConstructProps) {
		super(scope, id)

		const {
			vpc,
			securityGroup,
			environmentName = 'development',
			branchName,
			customDomainName,
			taskDefinition: taskConfig = { cpu: 256, memoryLimitMiB: 512 },
			parameterStorePrefix,
			enableDetailedMonitoring = false,
			autoScaling: scalingConfig,
			ecrRepository: providedEcrRepository,
			imageTag = 'latest',
			containerPort = 3000,
			healthCheck = {
				path: '/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
		} = props

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
			containerInsights: enableDetailedMonitoring,
			enableFargateCapacityProviders: true,
		})

		// Create IAM roles for ECS tasks
		this.taskRole = this.createTaskRole(parameterStorePrefix, environmentName)
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

		// Add container to task definition
		this.taskDefinition.addContainer('ExpressApiContainer', {
			image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, imageTag),
			containerName: 'express-api',
			portMappings: [{ containerPort }],
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: `macro-ai-${environmentName}`,
				logRetention: logs.RetentionDays.ONE_WEEK, // Cost optimization
			}),
			environment: {
				NODE_ENV:
					environmentName === 'production' ? 'production' : 'development',
				APP_ENV: environmentName,
				PARAMETER_STORE_PREFIX: parameterStorePrefix,
				// Other environment variables will be injected via Parameter Store at runtime
			},
			// Note: Parameter Store values will be accessed at runtime via the task role
			// The application should use the AWS SDK to fetch parameters using the PARAMETER_STORE_PREFIX
			healthCheck: {
				command: [
					'CMD-SHELL',
					`curl -f http://localhost:${containerPort}${healthCheck.path} || exit 1`,
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
			assignPublicIp: true, // Cost optimization: no NAT Gateway needed
			platformVersion: ecs.FargatePlatformVersion.LATEST,
			enableExecuteCommand: true, // Enable ECS Exec for debugging
			circuitBreaker: { rollback: true }, // Auto-rollback on deployment failures
		})

		// Configure auto-scaling if specified
		if (scalingConfig) {
			const scaling = this.service.autoScaleTaskCount({
				minCapacity: scalingConfig.minCapacity,
				maxCapacity: scalingConfig.maxCapacity,
			})

			// Scale up on CPU utilization
			scaling.scaleOnCpuUtilization('CpuScaling', {
				targetUtilizationPercent: scalingConfig.targetCpuUtilization,
				scaleInCooldown: cdk.Duration.seconds(60),
				scaleOutCooldown: cdk.Duration.seconds(60),
			})

			// Scale up on memory utilization
			scaling.scaleOnMemoryUtilization('MemoryScaling', {
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
	private createTaskRole(
		parameterStorePrefix: string,
		environmentName: string,
	): iam.Role {
		const role = new iam.Role(this, 'EcsTaskRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			roleName: `macro-ai-${environmentName}-ecs-task-role`,
			description:
				'IAM role for Macro AI ECS tasks with least-privilege access',
		})

		// Parameter Store access for runtime configuration
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ssm:GetParameter',
					'ssm:GetParameters',
					'ssm:GetParametersByPath',
				],
				resources: [`arn:aws:ssm:*:*:parameter${parameterStorePrefix}/*`],
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

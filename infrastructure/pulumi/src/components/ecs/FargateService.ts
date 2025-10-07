import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { APP_CONFIG, COST_OPTIMIZATION } from '../../config/constants'
import { getCommonTags } from '../../config/tags'
import { getCostOptimizedSettings } from '../../utils/environment'

export interface FargateServiceArgs {
	/**
	 * Environment name
	 */
	environmentName: string

	/**
	 * ECS Cluster ARN
	 */
	clusterArn: pulumi.Input<string>

	/**
	 * VPC ID
	 */
	vpcId: pulumi.Input<string>

	/**
	 * Subnet IDs for ECS tasks
	 */
	subnetIds: pulumi.Input<string[]>

	/**
	 * Container image URI
	 */
	imageUri: pulumi.Input<string>

	/**
	 * Environment variables for container
	 */
	environmentVariables: pulumi.Input<Record<string, string>>

	/**
	 * Target group ARN for load balancer
	 */
	targetGroupArn: pulumi.Input<string>

	/**
	 * ALB security group ID (for ingress rules)
	 */
	albSecurityGroupId: pulumi.Input<string>

	/**
	 * CPU units (256, 512, 1024, etc.)
	 */
	cpu?: string

	/**
	 * Memory in MB
	 */
	memory?: string

	/**
	 * Desired task count
	 */
	desiredCount?: number

	/**
	 * CloudWatch log retention days
	 */
	logRetentionDays?: number

	/**
	 * Common tags
	 */
	tags?: Record<string, string>
}

export class FargateService extends pulumi.ComponentResource {
	public readonly logGroup: aws.cloudwatch.LogGroup
	public readonly securityGroup: aws.ec2.SecurityGroup
	public readonly service: aws.ecs.Service
	public readonly taskDefinition: aws.ecs.TaskDefinition

	constructor(
		name: string,
		args: FargateServiceArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super('macro-ai:ecs:FargateService', name, {}, opts)

		const commonTags = getCommonTags(args.environmentName, args.environmentName)
		const costSettings = getCostOptimizedSettings(args.environmentName)

		// Create security group for ECS tasks
		this.securityGroup = new aws.ec2.SecurityGroup(
			`${name}-sg`,
			{
				vpcId: args.vpcId,
				description: `Security group for ${args.environmentName} ECS service`,
				ingress: [
					{
						protocol: 'tcp',
						fromPort: APP_CONFIG.port,
						toPort: APP_CONFIG.port,
						securityGroups: [args.albSecurityGroupId],
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
					Name: `macro-ai-${args.environmentName}-ecs-sg`,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		// Create CloudWatch log group
		this.logGroup = new aws.cloudwatch.LogGroup(
			`${name}-logs`,
			{
				name: `/ecs/macro-ai-${args.environmentName}`,
				retentionInDays: args.logRetentionDays ?? costSettings.logRetentionDays,
				tags: {
					Name: `macro-ai-${args.environmentName}-logs`,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		// Create ECS execution role
		const executionRole = new aws.iam.Role(
			`${name}-execution-role`,
			{
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
					Name: `macro-ai-${args.environmentName}-execution-role`,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		// Get AWS region for log configuration
		const awsRegion = pulumi.output(aws.getRegionOutput().name)

		// Create task definition
		this.taskDefinition = new aws.ecs.TaskDefinition(
			`${name}-task`,
			{
				family: `macro-ai-${args.environmentName}`,
				networkMode: 'awsvpc',
				requiresCompatibilities: ['FARGATE'],
				cpu: args.cpu || COST_OPTIMIZATION.ecsCpu,
				memory: args.memory || COST_OPTIMIZATION.ecsMemory,
				executionRoleArn: executionRole.arn,
				containerDefinitions: pulumi
					.all([
						args.environmentVariables,
						args.imageUri,
						this.logGroup.name,
						awsRegion,
					])
					.apply(([envVars, image, logGroupName, region]) =>
						JSON.stringify([
							{
								name: 'macro-ai-container',
								image: image,
								portMappings: [
									{
										containerPort: APP_CONFIG.port,
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
										'awslogs-group': logGroupName,
										'awslogs-region': region,
										'awslogs-stream-prefix': 'ecs',
									},
								},
							},
						]),
					),
				tags: {
					Name: `macro-ai-${args.environmentName}-task`,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		// Create ECS service
		this.service = new aws.ecs.Service(
			`${name}-service`,
			{
				name: `macro-ai-${args.environmentName}-service`,
				cluster: args.clusterArn,
				taskDefinition: this.taskDefinition.arn,
				desiredCount: args.desiredCount || 1,
				launchType: 'FARGATE',
				networkConfiguration: {
					subnets: args.subnetIds,
					securityGroups: [this.securityGroup.id],
					assignPublicIp: true,
				},
				loadBalancers: [
					{
						targetGroupArn: args.targetGroupArn,
						containerName: 'macro-ai-container',
						containerPort: APP_CONFIG.port,
					},
				],
				healthCheckGracePeriodSeconds: 60,
				tags: {
					Name: `macro-ai-${args.environmentName}-service`,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		this.registerOutputs({
			serviceName: this.service.name,
			serviceArn: this.service.id,
			logGroupName: this.logGroup.name,
		})
	}
}

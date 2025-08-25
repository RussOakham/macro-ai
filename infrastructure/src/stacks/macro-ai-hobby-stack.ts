import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { EcsFargateConstruct } from '../constructs/ecs-fargate-construct.js'
import { NetworkingConstruct } from '../constructs/networking.js'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct.js'

export interface MacroAiHobbyStackProps extends cdk.StackProps {
	/**
	 * Environment name for the deployment
	 * @default 'hobby'
	 */
	readonly environmentName?: string

	/**
	 * Enable ECS Fargate deployment alongside EC2
	 * @default false
	 */
	readonly enableEcs?: boolean

	/**
	 * ECS task configuration for hobby environment
	 */
	readonly ecsConfig?: {
		readonly cpu: number
		readonly memoryLimitMiB: number
		readonly minCapacity: number
		readonly maxCapacity: number
	}
}

/**
 * Main stack for Macro AI hobby deployment
 *
 * This stack creates infrastructure including:
 * - VPC and networking infrastructure for both EC2 and ECS deployments
 * - Parameter Store for secure configuration
 * - IAM roles and policies for secure access
 * - Optional ECS Fargate for containerized deployment
 *
 * Phase 3 of Lambda-to-EC2 migration: Added networking foundation
 * for EC2-based preview environments with cost-optimized shared infrastructure.
 * Now enhanced with ECS Fargate support for containerized deployment.
 */
export class MacroAiHobbyStack extends cdk.Stack {
	public readonly networking: NetworkingConstruct
	public readonly parameterStore: ParameterStoreConstruct
	public readonly ecsService?: EcsFargateConstruct

	constructor(
		scope: Construct,
		id: string,
		props: MacroAiHobbyStackProps = {},
	) {
		super(scope, id, props)

		const environmentName = props.environmentName ?? 'hobby'
		const enableEcs = props.enableEcs ?? false
		const ecsConfig = props.ecsConfig ?? {
			cpu: 256,
			memoryLimitMiB: 512,
			minCapacity: 1,
			maxCapacity: 2,
		}

		// Create Parameter Store construct first (needed for both EC2 and ECS configuration)
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Create networking infrastructure for both EC2 and ECS deployments
		// This provides the foundation for ALB, EC2 instances, ECS services, and security groups
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: false, // Cost optimization for development
			maxAzs: 2, // Minimum for ALB, cost-optimized
			enableDetailedMonitoring: false, // Cost optimization
			parameterStorePrefix: this.parameterStore.parameterPrefix, // Enable EC2 construct
		})

		// Validate networking requirements for ALB deployment
		this.networking.validateAlbRequirements()

		// Create ECS Fargate service if enabled
		if (enableEcs) {
			this.ecsService = new EcsFargateConstruct(this, 'EcsService', {
				vpc: this.networking.vpc,
				securityGroup: this.networking.albSecurityGroup,
				environmentName,
				parameterStorePrefix: this.parameterStore.parameterPrefix,
				enableDetailedMonitoring: false, // Cost optimization for hobby environment
				taskDefinition: {
					cpu: ecsConfig.cpu,
					memoryLimitMiB: ecsConfig.memoryLimitMiB,
				},
				autoScaling: {
					minCapacity: ecsConfig.minCapacity,
					maxCapacity: ecsConfig.maxCapacity,
					targetCpuUtilization: 70,
				},
				imageTag: 'latest', // Will be overridden by CI/CD pipeline
				containerPort: 3000, // Standard Express API port
				healthCheck: {
					path: '/api/health',
					interval: cdk.Duration.seconds(30),
					timeout: cdk.Duration.seconds(5),
					healthyThresholdCount: 2,
					unhealthyThresholdCount: 3,
				},
			})
		}

		// Output important values
		new cdk.CfnOutput(this, 'ParameterStorePrefix', {
			value: this.parameterStore.parameterPrefix,
			description: 'Parameter Store prefix for configuration',
			exportName: `${this.stackName}-ParameterStorePrefix`,
		})

		// Output networking information for future constructs
		// VPC exports are handled by NetworkingConstruct

		new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
			value: this.networking.albSecurityGroup.securityGroupId,
			description: 'Shared ALB security group ID',
			exportName: `${this.stackName}-AlbSecurityGroupId`,
		})

		// Output EC2-related information if EC2 construct is available
		if (this.networking.ec2Construct) {
			new cdk.CfnOutput(this, 'Ec2InstanceRoleArn', {
				value: this.networking.ec2Construct.instanceRole.roleArn,
				description: 'IAM role ARN for EC2 instances',
				exportName: `${this.stackName}-Ec2InstanceRoleArn`,
			})

			new cdk.CfnOutput(this, 'Ec2LaunchTemplateId', {
				value:
					this.networking.ec2Construct.launchTemplate.launchTemplateId ??
					'undefined',
				description: 'Launch template ID for EC2 instances',
				exportName: `${this.stackName}-Ec2LaunchTemplateId`,
			})
		}

		// Output ECS-related information if ECS service is enabled
		if (this.ecsService) {
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
		}

		// Output ALB-related information if ALB construct is available
		// Note: ALB is not configured in the simplified networking construct
		// ALB outputs will be added when ALB functionality is restored
	}
}

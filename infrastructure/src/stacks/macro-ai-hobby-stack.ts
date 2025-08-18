import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { NetworkingConstruct } from '../constructs/networking.js'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct.js'

export interface MacroAiHobbyStackProps extends cdk.StackProps {
	/**
	 * Environment name for the deployment
	 * @default 'hobby'
	 */
	readonly environmentName?: string
}

/**
 * Main stack for Macro AI hobby deployment
 *
 * This stack creates infrastructure including:
 * - VPC and networking infrastructure for EC2-based preview environments
 * - Parameter Store for secure configuration
 * - IAM roles and policies for secure access
 *
 * Phase 3 of Lambda-to-EC2 migration: Added networking foundation
 * for EC2-based preview environments with cost-optimized shared infrastructure.
 */
export class MacroAiHobbyStack extends cdk.Stack {
	public readonly networking: NetworkingConstruct
	public readonly parameterStore: ParameterStoreConstruct

	constructor(
		scope: Construct,
		id: string,
		props: MacroAiHobbyStackProps = {},
	) {
		super(scope, id, props)

		const environmentName = props.environmentName ?? 'hobby'

		// Create Parameter Store construct first (needed for EC2 configuration)
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Create networking infrastructure for EC2-based preview environments
		// This provides the foundation for ALB, EC2 instances, and security groups
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: false, // Cost optimization for development
			maxAzs: 2, // Minimum for ALB, cost-optimized
			enableDetailedMonitoring: false, // Cost optimization
			parameterStorePrefix: this.parameterStore.parameterPrefix, // Enable EC2 construct
		})

		// Validate networking requirements for ALB deployment
		this.networking.validateAlbRequirements()

		// Output important values
		new cdk.CfnOutput(this, 'ParameterStorePrefix', {
			value: this.parameterStore.parameterPrefix,
			description: 'Parameter Store prefix for configuration',
			exportName: `${this.stackName}-ParameterStorePrefix`,
		})

		// Output networking information for future constructs
		// VPC exports are handled by VpcConstruct to avoid duplication

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

		// Output ALB-related information if ALB construct is available
		if (this.networking.albConstruct) {
			new cdk.CfnOutput(this, 'AlbDnsName', {
				value:
					this.networking.albConstruct.applicationLoadBalancer
						.loadBalancerDnsName,
				description: 'ALB DNS name for accessing preview environments',
				exportName: `${this.stackName}-AlbDnsName`,
			})

			new cdk.CfnOutput(this, 'AlbArn', {
				value:
					this.networking.albConstruct.applicationLoadBalancer.loadBalancerArn,
				description: 'ALB ARN for reference in other stacks',
				exportName: `${this.stackName}-AlbArn`,
			})

			new cdk.CfnOutput(this, 'AlbHostedZoneId', {
				value:
					this.networking.albConstruct.applicationLoadBalancer
						.loadBalancerCanonicalHostedZoneId,
				description: 'ALB hosted zone ID for Route 53 alias records',
				exportName: `${this.stackName}-AlbHostedZoneId`,
			})
		}
	}
}

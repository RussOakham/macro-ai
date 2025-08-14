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

		// Create networking infrastructure for EC2-based preview environments
		// This provides the foundation for ALB, EC2 instances, and security groups
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: false, // Cost optimization for development
			maxAzs: 2, // Minimum for ALB, cost-optimized
			enableDetailedMonitoring: false, // Cost optimization
		})

		// Validate networking requirements for ALB deployment
		this.networking.validateAlbRequirements()

		// Create Parameter Store construct for secure configuration management
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Output important values
		new cdk.CfnOutput(this, 'ParameterStorePrefix', {
			value: this.parameterStore.parameterPrefix,
			description: 'Parameter Store prefix for configuration',
			exportName: `${this.stackName}-ParameterStorePrefix`,
		})

		// Output networking information for future constructs
		new cdk.CfnOutput(this, 'VpcId', {
			value: this.networking.vpcId,
			description: 'VPC ID for EC2-based preview environments',
			exportName: `${this.stackName}-VpcId`,
		})

		new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
			value: this.networking.albSecurityGroup.securityGroupId,
			description: 'Shared ALB security group ID',
			exportName: `${this.stackName}-AlbSecurityGroupId`,
		})
	}
}

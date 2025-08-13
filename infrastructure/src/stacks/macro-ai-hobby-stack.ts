import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

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
 * - Parameter Store for secure configuration
 * - IAM roles and policies for secure access
 *
 * Note: Lambda and API Gateway constructs have been removed as part of
 * the migration to EC2-based deployment.
 */
export class MacroAiHobbyStack extends cdk.Stack {
	public readonly parameterStore: ParameterStoreConstruct

	constructor(
		scope: Construct,
		id: string,
		props: MacroAiHobbyStackProps = {},
	) {
		super(scope, id, props)

		const environmentName = props.environmentName ?? 'hobby'

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
	}
}

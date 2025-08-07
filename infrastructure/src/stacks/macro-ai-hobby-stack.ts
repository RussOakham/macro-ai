import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'

import { ApiGatewayConstruct } from '../constructs/api-gateway-construct.js'
import { LambdaConstruct } from '../constructs/lambda-construct.js'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct.js'

export interface MacroAiHobbyStackProps extends cdk.StackProps {
	/**
	 * Environment name for the deployment
	 * @default 'hobby'
	 */
	readonly environmentName?: string

	/**
	 * Domain name for the API (optional)
	 * If provided, will set up custom domain
	 */
	readonly domainName?: string

	/**
	 * Whether to enable detailed monitoring
	 * @default false (to minimize costs)
	 */
	readonly enableDetailedMonitoring?: boolean
}

/**
 * Main stack for Macro AI hobby deployment
 *
 * This stack creates a cost-optimized serverless architecture including:
 * - AWS Lambda function for the API backend
 * - API Gateway for HTTP routing
 * - Parameter Store for secure configuration
 * - IAM roles and policies for secure access
 */
export class MacroAiHobbyStack extends cdk.Stack {
	public readonly lambda: LambdaConstruct
	public readonly apiGateway: ApiGatewayConstruct
	public readonly parameterStore: ParameterStoreConstruct

	constructor(
		scope: Construct,
		id: string,
		props: MacroAiHobbyStackProps = {},
	) {
		super(scope, id, props)

		const environmentName = props.environmentName ?? 'hobby'
		const enableDetailedMonitoring = props.enableDetailedMonitoring ?? false

		// Create Parameter Store construct for secure configuration management
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Create Lambda construct for the API backend
		this.lambda = new LambdaConstruct(this, 'Lambda', {
			environmentName,
			parameterStoreConstruct: this.parameterStore,
			enableDetailedMonitoring,
		})

		// Create API Gateway construct for HTTP routing
		this.apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
			environmentName,
			lambdaFunction: this.lambda.function,
			domainName: props.domainName,
		})

		// Output important values
		new cdk.CfnOutput(this, 'ApiEndpoint', {
			value: this.apiGateway.restApi.url,
			description: 'API Gateway endpoint URL',
			exportName: `${this.stackName}-ApiEndpoint`,
		})

		new cdk.CfnOutput(this, 'LambdaFunctionName', {
			value: this.lambda.function.functionName,
			description: 'Lambda function name',
			exportName: `${this.stackName}-LambdaFunctionName`,
		})

		new cdk.CfnOutput(this, 'ParameterStorePrefix', {
			value: this.parameterStore.parameterPrefix,
			description: 'Parameter Store prefix for configuration',
			exportName: `${this.stackName}-ParameterStorePrefix`,
		})

		if (props.domainName) {
			new cdk.CfnOutput(this, 'CustomDomainUrl', {
				value: `https://${props.domainName}`,
				description: 'Custom domain URL',
				exportName: `${this.stackName}-CustomDomainUrl`,
			})
		}
	}
}

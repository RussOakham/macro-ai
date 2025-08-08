import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

export interface ParameterStoreConstructProps {
	/**
	 * Environment name for parameter organization
	 */
	readonly environmentName: string

	/**
	 * Custom parameter prefix
	 * @default '/macro-ai/{environmentName}'
	 */
	readonly parameterPrefix?: string
}

/**
 * Construct for managing Parameter Store parameters and IAM policies
 *
 * Creates the parameter hierarchy and IAM policies needed for the Lambda function
 * to securely access configuration values from Parameter Store.
 */
export class ParameterStoreConstruct extends Construct {
	public readonly parameterPrefix: string
	public readonly readPolicy: iam.ManagedPolicy
	public readonly parameters: Record<string, ssm.StringParameter>

	constructor(
		scope: Construct,
		id: string,
		props: ParameterStoreConstructProps,
	) {
		super(scope, id)

		this.parameterPrefix =
			props.parameterPrefix ?? `/macro-ai/${props.environmentName}`

		// Create placeholder parameters that will be updated manually or via CI/CD
		this.parameters = this.createParameters()

		// Create IAM policy for Lambda to read parameters
		this.readPolicy = this.createReadPolicy()

		// Output the parameter prefix for reference
		new cdk.CfnOutput(this, 'ParameterPrefix', {
			value: this.parameterPrefix,
			description: 'Parameter Store prefix for this environment',
		})
	}

	private createParameters(): Record<string, ssm.StringParameter> {
		const parameters: Record<string, ssm.StringParameter> = {}

		// Critical parameters (Advanced tier for higher throughput)
		const criticalParams = [
			{
				name: 'api-key',
				description: 'Application API key for authentication',
				isSecure: true,
				tier: ssm.ParameterTier.ADVANCED,
			},
			{
				name: 'cookie-encryption-key',
				description: 'Cookie encryption key for session security',
				isSecure: true,
				tier: ssm.ParameterTier.ADVANCED,
			},
			{
				name: 'cognito-user-pool-secret-key',
				description: 'AWS Cognito User Pool Client Secret',
				isSecure: true,
				tier: ssm.ParameterTier.ADVANCED,
			},
			{
				name: 'cognito-access-key',
				description: 'AWS IAM Access Key for Cognito operations',
				isSecure: true,
				tier: ssm.ParameterTier.ADVANCED,
			},
			{
				name: 'cognito-secret-key',
				description: 'AWS IAM Secret Key for Cognito operations',
				isSecure: true,
				tier: ssm.ParameterTier.ADVANCED,
			},
			{
				name: 'openai-api-key',
				description: 'OpenAI API key for AI chat functionality',
				isSecure: true,
				tier: ssm.ParameterTier.ADVANCED,
			},
			{
				name: 'neon-database-url',
				description: 'Neon PostgreSQL connection string',
				isSecure: true,
				tier: ssm.ParameterTier.ADVANCED,
			},
		]

		// Standard parameters (Standard tier for cost optimization)
		const standardParams = [
			{
				name: 'cognito-user-pool-id',
				description: 'AWS Cognito User Pool ID',
				isSecure: false,
				tier: ssm.ParameterTier.STANDARD,
			},
			{
				name: 'cognito-user-pool-client-id',
				description: 'AWS Cognito User Pool Client ID',
				isSecure: false,
				tier: ssm.ParameterTier.STANDARD,
			},
		]

		// Move Upstash Redis URL to critical parameters (Advanced tier)
		criticalParams.push({
			name: 'upstash-redis-url',
			description: 'Upstash Redis connection string',
			isSecure: true,
			tier: ssm.ParameterTier.ADVANCED,
		})

		// Create critical parameters
		for (const param of criticalParams) {
			const parameterName = `${this.parameterPrefix}/critical/${param.name}`
			parameters[param.name] = new ssm.StringParameter(
				this,
				`Critical${this.toPascalCase(param.name)}`,
				{
					parameterName,
					description: param.description,
					tier: param.tier,
					stringValue: 'PLACEHOLDER_VALUE_UPDATE_AFTER_DEPLOYMENT',
				},
			)
		}

		// Create standard parameters
		for (const param of standardParams) {
			const parameterName = `${this.parameterPrefix}/standard/${param.name}`
			parameters[param.name] = new ssm.StringParameter(
				this,
				`Standard${this.toPascalCase(param.name)}`,
				{
					parameterName,
					description: param.description,
					tier: param.tier,
					stringValue: 'PLACEHOLDER_VALUE_UPDATE_AFTER_DEPLOYMENT',
				},
			)
		}

		return parameters
	}

	private createReadPolicy(): iam.ManagedPolicy {
		return new iam.ManagedPolicy(this, 'ParameterStoreReadPolicy', {
			description:
				'Policy allowing read access to Macro AI Parameter Store parameters',
			statements: [
				new iam.PolicyStatement({
					effect: iam.Effect.ALLOW,
					actions: [
						'ssm:GetParameter',
						'ssm:GetParameters',
						'ssm:GetParametersByPath',
					],
					resources: [
						`arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${this.parameterPrefix}/*`,
					],
				}),
				new iam.PolicyStatement({
					effect: iam.Effect.ALLOW,
					actions: ['kms:Decrypt'],
					resources: ['*'],
					conditions: {
						StringEquals: {
							'kms:ViaService': `ssm.${cdk.Stack.of(this).region}.amazonaws.com`,
						},
					},
				}),
			],
		})
	}

	private toPascalCase(str: string): string {
		return str
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join('')
	}

	/**
	 * Get the full parameter name for a given parameter key
	 */
	public getParameterName(
		key: string,
		tier: 'critical' | 'standard' = 'standard',
	): string {
		return `${this.parameterPrefix}/${tier}/${key}`
	}

	/**
	 * Get parameter ARN for a given parameter key
	 */
	public getParameterArn(
		key: string,
		tier: 'critical' | 'standard' = 'standard',
	): string {
		const parameterName = this.getParameterName(key, tier)
		return `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${parameterName}`
	}
}

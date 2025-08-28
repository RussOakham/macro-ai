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
 * Creates the parameter hierarchy and IAM policies needed for applications
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

		// Detect ephemeral preview environments and use shared development parameters
		const isPreviewEnvironment = props.environmentName
			.toLowerCase()
			.startsWith('pr-')

		if (isPreviewEnvironment) {
			// Use shared development parameter prefix for all preview environments
			// Note: No trailing slash to avoid double slashes when joining with tier names
			this.parameterPrefix = '/macro-ai/development'

			// Skip parameter creation for preview environments (use existing shared parameters)
			this.parameters = {}

			console.log(`✅ Preview environment detected: ${props.environmentName}`)
			console.log(`📋 Using shared parameter prefix: ${this.parameterPrefix}`)
			console.log(
				`💰 Cost optimization: No new parameters created for ephemeral environment`,
			)
		} else {
			// Standard behavior for staging/production environments
			this.parameterPrefix =
				props.parameterPrefix ?? `/macro-ai/${props.environmentName}`

			// Create placeholder parameters that will be updated manually or via CI/CD
			this.parameters = this.createParameters()

			console.log(`✅ Persistent environment: ${props.environmentName}`)
			console.log(`📋 Parameter prefix: ${this.parameterPrefix}`)
			console.log(
				`🔧 Created ${Object.keys(this.parameters).length.toString()} parameter placeholders`,
			)
		}

		// Create IAM policy for applications to read parameters (works for both modes)
		this.readPolicy = this.createReadPolicy()

		// Output the parameter prefix for reference
		new cdk.CfnOutput(this, 'ParameterPrefix', {
			value: this.parameterPrefix,
			description: `Parameter Store prefix for ${props.environmentName} environment${isPreviewEnvironment ? ' (shared development)' : ''}`,
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
			parameters[param.name] = this.createParameter(
				param,
				parameterName,
				`Critical${this.toPascalCase(param.name)}`,
			)
		}

		// Create standard parameters
		for (const param of standardParams) {
			const parameterName = `${this.parameterPrefix}/standard/${param.name}`
			parameters[param.name] = this.createParameter(
				param,
				parameterName,
				`Standard${this.toPascalCase(param.name)}`,
			)
		}

		return parameters
	}

	/**
	 * Creates a parameter as String type initially (CloudFormation requirement)
	 * Parameters marked with isSecure will be converted to SecureString post-deployment
	 * @param param Parameter configuration
	 * @param parameterName Full parameter name with prefix
	 * @param constructId Unique construct ID
	 * @returns StringParameter instance
	 */
	private createParameter(
		param: {
			name: string
			description: string
			isSecure: boolean
			tier: ssm.ParameterTier
		},
		parameterName: string,
		constructId: string,
	): ssm.StringParameter {
		// Create all parameters as String type initially (CloudFormation requirement)
		// SecureString conversion happens post-deployment via update script
		const parameter = new ssm.StringParameter(this, constructId, {
			parameterName,
			description: param.description,
			tier: param.tier,
			stringValue: 'PLACEHOLDER_VALUE_UPDATE_AFTER_DEPLOYMENT',
		})

		// Add metadata to indicate which parameters should be converted to SecureString
		if (param.isSecure) {
			parameter.node.addMetadata('SecureStringConversion', {
				required: true,
				postDeploymentAction: `Convert to SecureString: aws ssm put-parameter --name "${parameterName}" --type SecureString --tier ${param.tier} --overwrite --value "ACTUAL_VALUE"`,
				parameterName,
				tier: param.tier,
			})
		}

		return parameter
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
		// Handle both naming conventions for backward compatibility
		if (this.parameterPrefix.includes('/')) {
			// Legacy format: /macro-ai/development/critical/api-key
			return `${this.parameterPrefix}/${tier}/${key}`
		} else {
			// New format: macro-ai-development-critical-api-key
			return `${this.parameterPrefix}${tier}-${key}`
		}
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

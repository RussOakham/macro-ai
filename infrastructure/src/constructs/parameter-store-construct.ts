/* eslint-disable security-node/detect-crlf */
import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import type * as ssm from 'aws-cdk-lib/aws-ssm'
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
	public readonly parameters: Record<string, ssm.StringParameter>
	public readonly readPolicy: iam.ManagedPolicy

	constructor(
		scope: Construct,
		id: string,
		props: ParameterStoreConstructProps,
	) {
		super(scope, id)

		// Set parameter prefix based on environment
		// All environments use manually managed parameters (no CDK parameter creation)
		const isPreviewEnvironment = props.environmentName
			.toLowerCase()
			.startsWith('pr-')

		if (isPreviewEnvironment) {
			// Preview environments use shared development parameters
			this.parameterPrefix = '/macro-ai/development'
			console.log(`✅ Preview environment detected: ${props.environmentName}`)
			console.log(`📋 Using shared parameter prefix: ${this.parameterPrefix}`)
		} else {
			// All other environments use their own parameter prefix
			this.parameterPrefix =
				props.parameterPrefix ?? `/macro-ai/${props.environmentName}`
			console.log(`✅ Environment: ${props.environmentName}`)
			console.log(`📋 Using parameter prefix: ${this.parameterPrefix}`)
		}

		// No parameter creation - all parameters are manually managed
		this.parameters = {}
		console.log(`🔧 Using manually managed parameters (no CDK parameter creation)`)

		// Create IAM policy for applications to read parameters (works for both modes)
		this.readPolicy = this.createReadPolicy()

		// Output the parameter prefix for reference
		new cdk.CfnOutput(this, 'ParameterPrefix', {
			value: this.parameterPrefix,
			description: `Parameter Store prefix for ${props.environmentName} environment (manually managed)${isPreviewEnvironment ? ' (shared development)' : ''}`,
		})
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

	// eslint-disable-next-line class-methods-use-this
	private toPascalCase(str: string): string {
		return str
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join('')
	}
}

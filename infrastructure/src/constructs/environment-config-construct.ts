import * as cdk from 'aws-cdk-lib'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

export interface EnvironmentConfigConstructProps {
	/**
	 * Environment name for parameter organization
	 */
	readonly environmentName: string

	/**
	 * Parameter prefix to use for fetching values
	 * @default 'macro-ai-development-'
	 */
	readonly parameterPrefix?: string

	/**
	 * Whether this is a preview environment
	 */
	readonly isPreviewEnvironment?: boolean
}

/**
 * Construct for managing environment configuration at CDK synthesis time
 *
 * This construct fetches Parameter Store values during synthesis and creates
 * complete environment configuration that can be injected into EC2 instances.
 * This approach ensures applications are environment-agnostic and receive
 * all required configuration at deployment time.
 */
export class EnvironmentConfigConstruct extends Construct {
	public readonly parameterPrefix: string
	public readonly envFileContent: string
	public readonly environmentVariables: Record<string, string>

	constructor(
		scope: Construct,
		id: string,
		props: EnvironmentConfigConstructProps,
	) {
		super(scope, id)

		// Use shared development parameters for preview environments
		this.parameterPrefix = props.parameterPrefix ?? 'macro-ai-development-'

		// Fetch Parameter Store values during synthesis
		this.environmentVariables = this.fetchParameterStoreValues()

		// Generate complete .env file content
		this.envFileContent = this.generateEnvFileContent()

		// Output the configuration for reference
		new cdk.CfnOutput(this, 'EnvironmentConfigStatus', {
			value: 'Configuration resolved at synthesis time',
			description: `Environment configuration for ${props.environmentName}`,
		})

		new cdk.CfnOutput(this, 'ParameterPrefix', {
			value: this.parameterPrefix,
			description: `Parameter Store prefix used for configuration`,
		})
	}

	/**
	 * Fetch Parameter Store values during CDK synthesis
	 * This happens at deployment time, not at runtime
	 */
	private fetchParameterStoreValues(): Record<string, string> {
		const envVars: Record<string, string> = {}

		// Define the parameter mappings (Parameter Store key -> Environment variable name)
		const parameterMappings = [
			// API Configuration
			{ paramKey: 'API_KEY', envVar: 'API_KEY' },
			{ paramKey: 'COOKIE_ENCRYPTION_KEY', envVar: 'COOKIE_ENCRYPTION_KEY' },

			// AWS Cognito Configuration
			{
				paramKey: 'AWS_COGNITO_REGION',
				envVar: 'AWS_COGNITO_REGION',
				defaultValue: 'us-east-1',
			},
			{
				paramKey: 'AWS_COGNITO_USER_POOL_ID',
				envVar: 'AWS_COGNITO_USER_POOL_ID',
			},
			{
				paramKey: 'AWS_COGNITO_USER_POOL_CLIENT_ID',
				envVar: 'AWS_COGNITO_USER_POOL_CLIENT_ID',
			},
			{
				paramKey: 'AWS_COGNITO_USER_POOL_SECRET_KEY',
				envVar: 'AWS_COGNITO_USER_POOL_SECRET_KEY',
			},
			{ paramKey: 'AWS_COGNITO_ACCESS_KEY', envVar: 'AWS_COGNITO_ACCESS_KEY' },
			{ paramKey: 'AWS_COGNITO_SECRET_KEY', envVar: 'AWS_COGNITO_SECRET_KEY' },

			// Database Configuration
			{
				paramKey: 'RELATIONAL_DATABASE_URL',
				envVar: 'RELATIONAL_DATABASE_URL',
			},
			{
				paramKey: 'NON_RELATIONAL_DATABASE_URL',
				envVar: 'NON_RELATIONAL_DATABASE_URL',
			},

			// OpenAI Configuration
			{ paramKey: 'OPENAI_API_KEY', envVar: 'OPENAI_API_KEY' },

			// Redis Configuration
			{ paramKey: 'REDIS_URL', envVar: 'REDIS_URL' },

			// Rate Limiting Configuration
			{
				paramKey: 'RATE_LIMIT_WINDOW_MS',
				envVar: 'RATE_LIMIT_WINDOW_MS',
				defaultValue: '900000',
			},
			{
				paramKey: 'RATE_LIMIT_MAX_REQUESTS',
				envVar: 'RATE_LIMIT_MAX_REQUESTS',
				defaultValue: '100',
			},
			{
				paramKey: 'AUTH_RATE_LIMIT_WINDOW_MS',
				envVar: 'AUTH_RATE_LIMIT_WINDOW_MS',
				defaultValue: '3600000',
			},
			{
				paramKey: 'AUTH_RATE_LIMIT_MAX_REQUESTS',
				envVar: 'AUTH_RATE_LIMIT_MAX_REQUESTS',
				defaultValue: '10',
			},
			{
				paramKey: 'API_RATE_LIMIT_WINDOW_MS',
				envVar: 'API_RATE_LIMIT_WINDOW_MS',
				defaultValue: '60000',
			},
			{
				paramKey: 'API_RATE_LIMIT_MAX_REQUESTS',
				envVar: 'API_RATE_LIMIT_MAX_REQUESTS',
				defaultValue: '60',
			},

			// Optional Configuration
			{
				paramKey: 'CORS_ALLOWED_ORIGINS',
				envVar: 'CORS_ALLOWED_ORIGINS',
				defaultValue: '*',
			},
			{
				paramKey: 'COOKIE_DOMAIN',
				envVar: 'COOKIE_DOMAIN',
				defaultValue: 'localhost',
			},
			{
				paramKey: 'AWS_COGNITO_REFRESH_TOKEN_EXPIRY',
				envVar: 'AWS_COGNITO_REFRESH_TOKEN_EXPIRY',
				defaultValue: '30',
			},
		]

		// Fetch each parameter value
		for (const mapping of parameterMappings) {
			try {
				// Try to fetch from Parameter Store first
				const paramName = `${this.parameterPrefix}${mapping.paramKey}`
				const paramValue = ssm.StringParameter.valueForStringParameter(
					this,
					paramName,
					1, // Version - use latest
				)

				envVars[mapping.envVar] = paramValue
				console.log(
					`✅ Fetched ${mapping.envVar} from Parameter Store: ${paramName}`,
				)
			} catch {
				// If Parameter Store fetch fails, use default value or throw error for required params
				if (mapping.defaultValue) {
					envVars[mapping.envVar] = mapping.defaultValue
					console.log(
						`⚠️ Using default value for ${mapping.envVar}: ${mapping.defaultValue}`,
					)
				} else {
					// For required parameters without defaults, this will cause deployment to fail
					console.error(
						`❌ Failed to fetch required parameter ${mapping.envVar} from ${this.parameterPrefix}${mapping.paramKey}`,
					)
					throw new Error(
						`Required parameter ${mapping.envVar} not found in Parameter Store. Please ensure ${this.parameterPrefix}${mapping.paramKey} exists.`,
					)
				}
			}
		}

		// Add environment-specific configuration
		envVars.NODE_ENV = 'production'
		envVars.APP_ENV =
			(this.node.tryGetContext('environmentName') as string) || 'preview'
		envVars.SERVER_PORT = '3040'

		return envVars
	}

	/**
	 * Generate complete .env file content
	 */
	private generateEnvFileContent(): string {
		const lines: string[] = []

		// Add header comment
		lines.push('# Environment configuration generated at CDK synthesis time')
		lines.push('# This file contains all required environment variables')
		lines.push(
			`# Generated for environment: ${(this.node.tryGetContext('environmentName') as string) || 'unknown'}`,
		)
		lines.push('')

		// Add all environment variables
		for (const [key, value] of Object.entries(this.environmentVariables)) {
			// Escape special characters in values
			const escapedValue = this.escapeEnvValue(value)
			lines.push(`${key}=${escapedValue}`)
		}

		return lines.join('\n')
	}

	/**
	 * Escape environment variable values for .env file format
	 */
	private escapeEnvValue(value: string): string {
		// If value contains spaces, quotes, or special characters, wrap in quotes
		if (
			value.includes(' ') ||
			value.includes('"') ||
			value.includes("'") ||
			value.includes('\\')
		) {
			// Escape quotes and backslashes
			const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
			return `"${escaped}"`
		}
		return value
	}

	/**
	 * Get environment variable value by name
	 */
	public getEnvironmentVariable(name: string): string {
		return this.environmentVariables[name] ?? ''
	}

	/**
	 * Get all environment variables as a record
	 */
	public getAllEnvironmentVariables(): Record<string, string> {
		return { ...this.environmentVariables }
	}

	/**
	 * Get the .env file content for injection into user data
	 */
	public getEnvFileContent(): string {
		return this.envFileContent
	}

	/**
	 * Get environment variables formatted for systemd service
	 */
	public getSystemdEnvironmentVariables(): string {
		return Object.entries(this.environmentVariables)
			.map(([key, value]) => `${key}="${value}"`)
			.join('\n')
	}

	/**
	 * Get environment variables formatted for /etc/environment
	 */
	public getSystemEnvironmentVariables(): string {
		return Object.entries(this.environmentVariables)
			.map(([key, value]) => `${key}="${value}"`)
			.join('\n')
	}
}

import * as cdk from 'aws-cdk-lib'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

interface ParameterMapping {
	paramKey: string
	envVar: string
	isSecure: boolean
	defaultValue?: string
}

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
 * complete environment configuration that can be injected into ECS Fargate tasks.
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
		// Note: No trailing slash to avoid double slashes when joining with parameter keys
		this.parameterPrefix = props.parameterPrefix ?? '/macro-ai/development'

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
	 * Parameter mappings (Parameter Store key -> Environment variable name)
	 * Note: Secure parameters are marked with isSecure: true
	 */
	private readonly parameterMappings: ParameterMapping[] = [
		// API Configuration
		{ paramKey: 'api-key', envVar: 'API_KEY', isSecure: false },
		{
			paramKey: 'cookie-encryption-key',
			envVar: 'COOKIE_ENCRYPTION_KEY',
			isSecure: true,
		},

		// AWS Cognito Configuration
		{
			paramKey: 'aws-cognito-region',
			envVar: 'AWS_COGNITO_REGION',
			defaultValue: 'us-east-1',
			isSecure: false,
		},
		{
			paramKey: 'aws-cognito-user-pool-id',
			envVar: 'AWS_COGNITO_USER_POOL_ID',
			isSecure: true,
		},
		{
			paramKey: 'aws-cognito-user-pool-client-id',
			envVar: 'AWS_COGNITO_USER_POOL_CLIENT_ID',
			isSecure: true,
		},
		{
			paramKey: 'aws-cognito-user-pool-secret-key',
			envVar: 'AWS_COGNITO_USER_POOL_SECRET_KEY',
			isSecure: true,
		},
		// AWS Cognito credentials removed - using IAM roles instead

		// Database Configuration
		{
			paramKey: 'relational-database-url',
			envVar: 'RELATIONAL_DATABASE_URL',
			isSecure: true,
		},
		{
			paramKey: 'non-relational-database-url',
			envVar: 'REDIS_URL',
			isSecure: true,
		},

		// OpenAI Configuration
		{ paramKey: 'openai-api-key', envVar: 'OPENAI_API_KEY', isSecure: true },

		// Redis Configuration
		{ paramKey: 'redis-url', envVar: 'REDIS_URL', isSecure: true },

		// Rate Limiting Configuration
		{
			paramKey: 'rate-limit-window-ms',
			envVar: 'RATE_LIMIT_WINDOW_MS',
			defaultValue: '900000',
			isSecure: false,
		},
		{
			paramKey: 'rate-limit-max-requests',
			envVar: 'RATE_LIMIT_MAX_REQUESTS',
			defaultValue: '100',
			isSecure: false,
		},
		{
			paramKey: 'auth-rate-limit-window-ms',
			envVar: 'AUTH_RATE_LIMIT_WINDOW_MS',
			defaultValue: '3600000',
			isSecure: false,
		},
		{
			paramKey: 'auth-rate-limit-max-requests',
			envVar: 'AUTH_RATE_LIMIT_MAX_REQUESTS',
			defaultValue: '10',
			isSecure: false,
		},
		{
			paramKey: 'api-rate-limit-window-ms',
			envVar: 'API_RATE_LIMIT_WINDOW_MS',
			defaultValue: '60000',
			isSecure: false,
		},
		{
			paramKey: 'api-rate-limit-max-requests',
			envVar: 'API_RATE_LIMIT_MAX_REQUESTS',
			defaultValue: '60',
			isSecure: false,
		},

		// Optional Configuration
		{
			paramKey: 'cors-allowed-origins',
			envVar: 'CORS_ALLOWED_ORIGINS',
			defaultValue: '*',
			isSecure: false,
		},
		{
			paramKey: 'cookie-domain',
			envVar: 'COOKIE_DOMAIN',
			defaultValue: 'localhost',
			isSecure: false,
		},
		{
			paramKey: 'aws-cognito-refresh-token-expiry',
			envVar: 'AWS_COGNITO_REFRESH_TOKEN_EXPIRY',
			defaultValue: '30',
			isSecure: false,
		},
	]

	/**
	 * Fetch Parameter Store values during CDK synthesis
	 * This happens at deployment time, not at runtime
	 */
	private fetchParameterStoreValues(): Record<string, string> {
		const envVars: Record<string, string> = {}

		// Fetch each parameter value
		for (const mapping of this.parameterMappings) {
			try {
				// Try to fetch from Parameter Store first
				const paramName = `${this.parameterPrefix}/${mapping.paramKey}`

				// Use appropriate method based on whether parameter is secure
				let paramValue: string
				if (mapping.isSecure) {
					paramValue = cdk.SecretValue.ssmSecure(paramName).unsafeUnwrap()
				} else {
					paramValue = ssm.StringParameter.valueForStringParameter(
						this,
						paramName,
						1, // Version - use latest
					)
				}

				envVars[mapping.envVar] = paramValue
				console.log(
					`✅ Fetched ${mapping.envVar} from Parameter Store: ${paramName} (${mapping.isSecure ? 'secure' : 'standard'})`,
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
						`❌ Failed to fetch required parameter ${mapping.envVar} from ${this.parameterPrefix}/${mapping.paramKey}`,
					)
					throw new Error(
						`Required parameter ${mapping.envVar} not found in Parameter Store. Please ensure ${this.parameterPrefix}/${mapping.paramKey} exists.`,
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
	 * Get only non-secure environment variables for ECS task definition
	 */
	public getNonSecureEnvironmentVariables(): Record<string, string> {
		const nonSecureVars: Record<string, string> = {}

		for (const mapping of this.parameterMappings) {
			if (!mapping.isSecure) {
				const envVarName = mapping.envVar
				if (this.environmentVariables[envVarName]) {
					nonSecureVars[envVarName] = this.environmentVariables[envVarName]
				}
			}
		}

		// Add environment-specific configuration (these are always non-secure)
		nonSecureVars.NODE_ENV = 'production'
		nonSecureVars.APP_ENV =
			(this.node.tryGetContext('environmentName') as string) || 'preview'
		nonSecureVars.SERVER_PORT = '3040'

		return nonSecureVars
	}

	/**
	 * Get secure parameters as ECS secrets configuration
	 */
	public getSecureParametersAsSecrets(): Record<string, cdk.aws_ecs.Secret> {
		const secrets: Record<string, cdk.aws_ecs.Secret> = {}

		for (const mapping of this.parameterMappings) {
			if (mapping.isSecure) {
				const paramName = `${this.parameterPrefix}/${mapping.paramKey}`
				secrets[mapping.envVar] = cdk.aws_ecs.Secret.fromSsmParameter(
					ssm.StringParameter.fromSecureStringParameterAttributes(
						this,
						`SecureParam-${mapping.paramKey}`,
						{
							parameterName: paramName,
							version: 1,
						},
					),
				)
			}
		}

		return secrets
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

import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export interface SecurityHeadersConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * Enable detailed logging
	 */
	enableDetailedLogging?: boolean

	/**
	 * Custom security headers configuration
	 */
	customHeaders?: Record<string, string>

	/**
	 * Content Security Policy directives
	 */
	contentSecurityPolicy?: string

	/**
	 * CORS allowed origins
	 */
	corsAllowedOrigins?: string[]

	/**
	 * Enable HSTS (HTTP Strict Transport Security)
	 */
	enableHsts?: boolean

	/**
	 * HSTS max age in seconds
	 */
	hstsMaxAge?: number

	/**
	 * Enable X-Frame-Options header
	 */
	enableXFrameOptions?: boolean

	/**
	 * X-Frame-Options value (DENY, SAMEORIGIN, ALLOW-FROM)
	 */
	xFrameOptionsValue?: string

	/**
	 * CloudWatch log group retention period
	 */
	logRetention?: logs.RetentionDays
}

export class SecurityHeadersConstruct extends Construct {
	public readonly lambdaFunction: lambda.Function
	public readonly lambdaVersion: lambda.Version

	constructor(
		scope: Construct,
		id: string,
		props: SecurityHeadersConstructProps,
	) {
		super(scope, id)

		const {
			environmentName,
			enableDetailedLogging = true,
			customHeaders = {},
			contentSecurityPolicy = this.getDefaultContentSecurityPolicy(),
			corsAllowedOrigins = ['https://macro-ai.com'],
			enableHsts = true,
			hstsMaxAge = 31536000, // 1 year
			enableXFrameOptions = true,
			xFrameOptionsValue = 'DENY',
			logRetention = logs.RetentionDays.ONE_WEEK,
		} = props

		// Create Lambda function for security headers processing
		this.lambdaFunction = new lambda.Function(this, 'SecurityHeadersFunction', {
			runtime: lambda.Runtime.NODEJS_18_X,
			code: lambda.Code.fromAsset('src/lambda/security-headers'),
			handler: 'index.handler',
			timeout: cdk.Duration.seconds(5),
			memorySize: 128,
			logRetention,
			environment: {
				ENVIRONMENT: environmentName,
				ENABLE_DETAILED_LOGGING: enableDetailedLogging.toString(),
				CUSTOM_HEADERS: JSON.stringify(customHeaders),
				CONTENT_SECURITY_POLICY: contentSecurityPolicy,
				CORS_ALLOWED_ORIGINS: JSON.stringify(corsAllowedOrigins),
				ENABLE_HSTS: enableHsts.toString(),
				HSTS_MAX_AGE: hstsMaxAge.toString(),
				ENABLE_X_FRAME_OPTIONS: enableXFrameOptions.toString(),
				X_FRAME_OPTIONS_VALUE: xFrameOptionsValue,
			},
		})

		// Create a version for the Lambda function (required for Lambda@Edge)
		this.lambdaVersion = new lambda.Version(
			this,
			'SecurityHeadersFunctionVersion',
			{
				lambda: this.lambdaFunction,
			},
		)

		// Add necessary permissions for Lambda@Edge
		this.lambdaFunction.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
				],
				resources: ['arn:aws:logs:*:*:*'],
			}),
		)
	}

	private getDefaultContentSecurityPolicy(): string {
		return [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.macro-ai.com",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' data: https: blob:",
			"connect-src 'self' https://api.macro-ai.com wss://*.macro-ai.com",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join('; ')
	}

	/**
	 * Get the Lambda function ARN for use with Lambda@Edge
	 */
	public getLambdaFunctionArn(): string {
		return this.lambdaVersion.functionArn
	}

	/**
	 * Get the Lambda function version ARN
	 */
	public getLambdaVersionArn(): string {
		return this.lambdaVersion.functionArn
	}

	/**
	 * Update security headers configuration
	 */
	public updateSecurityConfig(
		updates: Partial<SecurityHeadersConstructProps>,
	): void {
		const currentEnv = this.lambdaFunction.environment

		const newEnvironment = {
			...currentEnv,
			...(updates.customHeaders && {
				CUSTOM_HEADERS: JSON.stringify(updates.customHeaders),
			}),
			...(updates.contentSecurityPolicy && {
				CONTENT_SECURITY_POLICY: updates.contentSecurityPolicy,
			}),
			...(updates.corsAllowedOrigins && {
				CORS_ALLOWED_ORIGINS: JSON.stringify(updates.corsAllowedOrigins),
			}),
			...(updates.enableHsts !== undefined && {
				ENABLE_HSTS: updates.enableHsts.toString(),
			}),
			...(updates.hstsMaxAge && {
				HSTS_MAX_AGE: updates.hstsMaxAge.toString(),
			}),
			...(updates.enableXFrameOptions !== undefined && {
				ENABLE_X_FRAME_OPTIONS: updates.enableXFrameOptions.toString(),
			}),
			...(updates.xFrameOptionsValue && {
				X_FRAME_OPTIONS_VALUE: updates.xFrameOptionsValue,
			}),
		}

		// Update the function environment (this will create a new version)
		this.lambdaFunction.addEnvironment('UPDATED_AT', Date.now().toString())

		// Note: In a real implementation, you might want to use Lambda function configuration updates
		// or create a new version with updated environment variables
	}
}

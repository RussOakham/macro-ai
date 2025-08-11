import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

import type { ParameterStoreConstruct } from './parameter-store-construct.js'

export interface LambdaConstructProps {
	/**
	 * Environment name for resource naming
	 */
	readonly environmentName: string

	/**
	 * Parameter Store construct for IAM permissions
	 */
	readonly parameterStoreConstruct: ParameterStoreConstruct

	/**
	 * Whether to enable detailed monitoring
	 * @default false
	 */
	readonly enableDetailedMonitoring?: boolean

	/**
	 * Lambda function timeout in seconds
	 * @default 30
	 */
	readonly timeoutSeconds?: number

	/**
	 * Lambda function memory size in MB
	 * @default 512
	 */
	readonly memorySize?: number

	/**
	 * Path to the Lambda deployment package
	 * @default '../apps/express-api/dist/lambda.zip'
	 */
	readonly deploymentPackagePath?: string
}

/**
 * Construct for the Macro AI Lambda function
 *
 * Creates the Lambda function with proper IAM permissions, environment variables,
 * and monitoring configuration for the hobby deployment.
 */
export class LambdaConstruct extends Construct {
	public readonly function: lambda.Function
	public readonly logGroup: logs.LogGroup
	public readonly executionRole: iam.Role

	constructor(scope: Construct, id: string, props: LambdaConstructProps) {
		super(scope, id)

		const {
			environmentName,
			parameterStoreConstruct,
			enableDetailedMonitoring = false,
			timeoutSeconds = 30,
			memorySize = 512,
			deploymentPackagePath = '../apps/express-api/dist/lambda.zip',
		} = props

		// Create execution role for Lambda
		this.executionRole = this.createExecutionRole(
			parameterStoreConstruct,
			enableDetailedMonitoring,
		)

		// Create CloudWatch log group
		this.logGroup = this.createLogGroup(environmentName)

		// Create Lambda function
		this.function = this.createLambdaFunction({
			environmentName,
			parameterStoreConstruct,
			enableDetailedMonitoring,
			timeoutSeconds,
			memorySize,
			deploymentPackagePath,
		})

		// Output function details
		new cdk.CfnOutput(this, 'FunctionName', {
			value: this.function.functionName,
			description: 'Lambda function name',
		})

		new cdk.CfnOutput(this, 'FunctionArn', {
			value: this.function.functionArn,
			description: 'Lambda function ARN',
		})
	}

	private createExecutionRole(
		parameterStoreConstruct: ParameterStoreConstruct,
		enableDetailedMonitoring: boolean,
	): iam.Role {
		const role = new iam.Role(this, 'ExecutionRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			description: 'Execution role for Macro AI Lambda function',
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
				parameterStoreConstruct.readPolicy,
			],
		})

		// Add X-Ray permissions only when detailed monitoring (tracing) is enabled
		if (enableDetailedMonitoring) {
			role.addToPolicy(
				new iam.PolicyStatement({
					effect: iam.Effect.ALLOW,
					actions: [
						'xray:PutTraceSegments',
						'xray:PutTelemetryRecords',
						'xray:GetSamplingRules',
						'xray:GetSamplingTargets',
					],
					resources: [
						`arn:aws:xray:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`,
					],
				}),
			)
		}

		return role
	}

	private createLogGroup(environmentName: string): logs.LogGroup {
		return new logs.LogGroup(this, 'LogGroup', {
			logGroupName: `/aws/lambda/macro-ai-${environmentName}-api`,
			retention: logs.RetentionDays.ONE_WEEK, // Cost optimization: shorter retention
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		})
	}

	private createLambdaFunction(config: {
		environmentName: string
		parameterStoreConstruct: ParameterStoreConstruct
		enableDetailedMonitoring: boolean
		timeoutSeconds: number
		memorySize: number
		deploymentPackagePath: string
	}): lambda.Function {
		const {
			environmentName,
			parameterStoreConstruct,
			enableDetailedMonitoring,
			timeoutSeconds,
			memorySize,
			deploymentPackagePath,
		} = config

		// Use the actual built Lambda package
		// Check if the deployment package path is a zip file or directory
		const code = deploymentPackagePath.endsWith('.zip')
			? lambda.Code.fromAsset(deploymentPackagePath)
			: lambda.Code.fromAsset(deploymentPackagePath, {
					// Exclude source maps from deployment to reduce package size
					exclude: ['*.map'],
				})

		return new lambda.Function(this, 'Function', {
			functionName: `macro-ai-${environmentName}-api`,
			description: 'Macro AI API backend for hobby deployment',
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'lambda.handler',
			code,
			role: this.executionRole,
			timeout: cdk.Duration.seconds(timeoutSeconds),
			memorySize,
			logGroup: this.logGroup,
			environment: {
				// Node.js and application environment
				NODE_ENV: 'production',
				APP_ENV: environmentName,

				// Parameter Store configuration
				PARAMETER_STORE_PREFIX: parameterStoreConstruct.parameterPrefix,

				// AWS Powertools configuration
				POWERTOOLS_SERVICE_NAME: 'macro-ai-api',
				POWERTOOLS_LOG_LEVEL: 'INFO',
				POWERTOOLS_LOGGER_SAMPLE_RATE: '0.1',
				POWERTOOLS_LOGGER_LOG_EVENT: enableDetailedMonitoring
					? 'true'
					: 'false',
				POWERTOOLS_METRICS_NAMESPACE: 'MacroAI/Hobby',

				// Service configuration
				SERVICE_NAME: 'macro-ai-express-api',
				SERVICE_VERSION: '1.0.0',
				LOG_LEVEL: 'INFO',

				// Lambda-specific configuration
				// AWS_LAMBDA_FUNCTION_NAME is automatically set by AWS Lambda runtime

				// Application configuration (will be overridden by Parameter Store)
				// These are placeholder values - actual values come from Parameter Store
				API_KEY: '',
				COOKIE_DOMAIN: 'api.macro-ai.com',
				COOKIE_ENCRYPTION_KEY: '',

				// Database configuration (will be overridden by Parameter Store)
				RELATIONAL_DATABASE_URL: '',
				NON_RELATIONAL_DATABASE_URL: '',

				// External service configuration (will be overridden by Parameter Store)
				OPENAI_API_KEY: '',

				// AWS Cognito configuration (will be overridden by Parameter Store)
				AWS_COGNITO_REGION: cdk.Stack.of(this).region,
				AWS_COGNITO_USER_POOL_ID: '',
				AWS_COGNITO_USER_POOL_CLIENT_ID: '',
				AWS_COGNITO_USER_POOL_SECRET_KEY: '',
				AWS_COGNITO_ACCESS_KEY: '',
				AWS_COGNITO_SECRET_KEY: '',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',

				// Rate limiting defaults
				RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
				RATE_LIMIT_MAX_REQUESTS: '100',
				AUTH_RATE_LIMIT_WINDOW_MS: '3600000', // 1 hour
				AUTH_RATE_LIMIT_MAX_REQUESTS: '10',
				API_RATE_LIMIT_WINDOW_MS: '60000', // 1 minute
				API_RATE_LIMIT_MAX_REQUESTS: '60',

				// CORS configuration propagated to the application layer
				CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ?? '',
			},
			// Cost optimization: disable provisioned concurrency
			reservedConcurrentExecutions: undefined,
			// Enable tracing only if detailed monitoring is enabled
			tracing: enableDetailedMonitoring
				? lambda.Tracing.ACTIVE
				: lambda.Tracing.DISABLED,
			// Architecture optimization for cost
			architecture: lambda.Architecture.ARM_64, // Graviton2 is 20% cheaper
		})
	}

	/**
	 * Grant the Lambda function permission to invoke other AWS services
	 */
	public grantInvoke(principal: iam.IPrincipal): iam.Grant {
		return this.function.grantInvoke(principal)
	}

	/**
	 * Add environment variables to the Lambda function
	 */
	public addEnvironment(key: string, value: string): void {
		this.function.addEnvironment(key, value)
	}
}

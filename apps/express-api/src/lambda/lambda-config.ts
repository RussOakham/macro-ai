/**
 * Lambda Configuration (Simplified)
 * Basic configuration for Lambda environment without complex observability setup
 */

/**
 * Log level type for consistent logging configuration
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

/**
 * Environment type for configuration
 */
export type Environment = 'development' | 'production' | 'test'

/**
 * Basic Lambda configuration interface
 */
export interface LambdaConfig {
	/** Service identification */
	service: {
		name: string
		version: string
		environment: Environment
		functionName: string
		region: string
	}

	/** Logger configuration */
	logger: {
		logLevel: LogLevel
		enableStructuredLogging: boolean
	}

	/** Feature flags */
	features: {
		enableCors: boolean
		enableRequestLogging: boolean
		enableErrorDetails: boolean
	}
}

/**
 * Get Lambda configuration from environment variables
 */
export const getLambdaConfig = (): LambdaConfig => {
	const nodeEnv =
		(process.env.NODE_ENV as Environment | undefined) ?? 'production'
	const logLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'INFO'

	return {
		service: {
			name: process.env.SERVICE_NAME ?? 'macro-ai-express-api',
			version: process.env.SERVICE_VERSION ?? '1.0.0',
			environment: nodeEnv,
			functionName: process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'unknown',
			region: process.env.AWS_REGION ?? 'us-east-1',
		},
		logger: {
			logLevel,
			enableStructuredLogging: true,
		},
		features: {
			enableCors: true,
			enableRequestLogging: nodeEnv !== 'production',
			enableErrorDetails: nodeEnv !== 'production',
		},
	}
}

/**
 * Validate essential Lambda environment variables
 */
export const validateLambdaEnvironment = (): void => {
	const requiredVars = ['AWS_LAMBDA_FUNCTION_NAME', 'AWS_REGION']

	const missing = requiredVars.filter((varName) => !process.env[varName])

	if (missing.length > 0) {
		throw new Error(
			`Missing required Lambda environment variables: ${missing.join(', ')}`,
		)
	}
}

/**
 * Get Lambda runtime information
 */
export const getLambdaRuntimeInfo = () => {
	return {
		functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
		functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
		logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
		logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
		memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
		timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT,
		runtime: process.env.AWS_EXECUTION_ENV,
		region: process.env.AWS_REGION,
		architecture: process.env.AWS_LAMBDA_INITIALIZATION_TYPE,
	}
}

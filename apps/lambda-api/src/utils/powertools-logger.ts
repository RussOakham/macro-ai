/**
 * AWS Lambda Powertools Logger Configuration
 * Provides structured logging with correlation IDs and Lambda context integration
 */

import { Logger } from '@aws-lambda-powertools/logger'

import type { TEnv } from './env.schema.js'

/**
 * Logger configuration interface
 */
interface LoggerConfig {
	serviceName: string
	logLevel: string
	environment: string
	persistentLogAttributes: Record<string, string | number | boolean>
}

/**
 * Create logger configuration from environment variables
 */
const createLoggerConfig = (env?: Partial<TEnv>): LoggerConfig => {
	const nodeEnv = env?.NODE_ENV ?? process.env.NODE_ENV ?? 'production'
	const logLevel = env?.LOG_LEVEL ?? process.env.LOG_LEVEL ?? 'info'
	const functionName =
		env?.AWS_LAMBDA_FUNCTION_NAME ??
		process.env.AWS_LAMBDA_FUNCTION_NAME ??
		'macro-ai-lambda'
	const awsRegion = env?.AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1'

	return {
		serviceName: 'macro-ai-lambda-api',
		logLevel: logLevel.toUpperCase(),
		environment: nodeEnv,
		persistentLogAttributes: {
			environment: nodeEnv,
			service: 'lambda-api',
			functionName,
			region: awsRegion,
			version: 'lambda-api-v1.0.0',
		},
	}
}

/**
 * Create and configure Powertools Logger instance
 */
const createPowertoolsLogger = (config?: Partial<LoggerConfig>): Logger => {
	const loggerConfig = createLoggerConfig()

	// Merge with provided config overrides
	const finalConfig = {
		...loggerConfig,
		...config,
		persistentLogAttributes: {
			...loggerConfig.persistentLogAttributes,
			...(config?.persistentLogAttributes ?? {}),
		},
	}

	return new Logger({
		serviceName: finalConfig.serviceName,
		logLevel: finalConfig.logLevel as
			| 'DEBUG'
			| 'INFO'
			| 'WARN'
			| 'ERROR'
			| 'CRITICAL',
		persistentLogAttributes: finalConfig.persistentLogAttributes,
		// Enable sampling for production to reduce costs
		sampleRateValue: finalConfig.environment === 'production' ? 0.1 : 1.0,
	})
}

/**
 * Default logger instance for the Lambda API
 * Configured with service metadata and environment-based settings
 */
export const logger = createPowertoolsLogger()

/**
 * Create a child logger with additional context
 * Useful for adding request-specific or operation-specific context
 */
export const createChildLogger = (
	additionalAttributes: Record<string, string | number | boolean>,
): Logger => {
	return logger.createChild({
		persistentLogAttributes: additionalAttributes,
	})
}

/**
 * Log levels enum for type safety
 */
export enum LogLevel {
	DEBUG = 'DEBUG',
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
	CRITICAL = 'CRITICAL',
}

/**
 * Utility function to log with correlation ID
 * Integrates with Lambda context for request tracing
 */
export const logWithCorrelationId = (
	level: LogLevel,
	message: string,
	correlationId: string,
	additionalData?: Record<string, unknown>,
): void => {
	const childLogger = createChildLogger({ correlationId })

	switch (level) {
		case LogLevel.DEBUG:
			if (additionalData) {
				childLogger.debug(message, additionalData)
			} else {
				childLogger.debug(message)
			}
			break
		case LogLevel.INFO:
			if (additionalData) {
				childLogger.info(message, additionalData)
			} else {
				childLogger.info(message)
			}
			break
		case LogLevel.WARN:
			if (additionalData) {
				childLogger.warn(message, additionalData)
			} else {
				childLogger.warn(message)
			}
			break
		case LogLevel.ERROR:
			if (additionalData) {
				childLogger.error(message, additionalData)
			} else {
				childLogger.error(message)
			}
			break
		case LogLevel.CRITICAL:
			if (additionalData) {
				childLogger.critical(message, additionalData)
			} else {
				childLogger.critical(message)
			}
			break
	}
}

/**
 * Export configuration functions for testing and customization
 */
export { createLoggerConfig, createPowertoolsLogger }

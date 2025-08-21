/**
 * Environment Detection Module
 * Simple, clear logic for determining the configuration environment
 */

import { pino } from '../../utils/logger.ts'

import { ConfigEnvironment } from './config-types.ts'

const { logger } = pino

/**
 * Detect if we're in a CI/build environment
 */
const isBuildTimeEnvironment = (): boolean => {
	const isTruthy = (v?: string) => /^(?:1|true|yes)$/i.test(v ?? '')

	const isCiEnvironment =
		isTruthy(process.env.CI) ||
		isTruthy(process.env.GITHUB_ACTIONS) ||
		isTruthy(process.env.GITLAB_CI) ||
		isTruthy(process.env.CIRCLECI) ||
		Boolean(process.env.JENKINS_URL) ||
		isTruthy(process.env.BUILDKITE)

	// Build-time if we're in CI and runtime config is not explicitly required
	return isCiEnvironment && !isTruthy(process.env.RUNTIME_CONFIG_REQUIRED)
}

/**
 * Detect if we're in an EC2/Lambda runtime environment
 */
const isEc2Environment = (): boolean => {
	return Boolean(
		process.env.PARAMETER_STORE_PREFIX ??
			process.env.AWS_LAMBDA_FUNCTION_NAME ??
			process.env.APP_ENV?.startsWith('pr-'),
	)
}

/**
 * Detect if we're in a localhost development environment
 */
const isLocalhostEnvironment = (): boolean => {
	return !isBuildTimeEnvironment() && !isEc2Environment()
}

/**
 * Main environment detection function
 * Returns the appropriate configuration environment type
 */
export const detectEnvironment = (): ConfigEnvironment => {
	const detectionStart = Date.now()

	const isBuildTime = isBuildTimeEnvironment()
	const isEc2 = isEc2Environment()
	const isLocalhost = isLocalhostEnvironment()

	let environment: ConfigEnvironment

	if (isBuildTime) {
		environment = ConfigEnvironment.BUILD_TIME
	} else if (isEc2) {
		environment = ConfigEnvironment.EC2_RUNTIME
	} else {
		environment = ConfigEnvironment.LOCALHOST
	}

	const detectionTime = Date.now() - detectionStart

	logger.info(
		{
			operation: 'environmentDetection',
			detectedEnvironment: environment,
			detectionTimeMs: detectionTime,
			indicators: {
				isBuildTime,
				isEc2,
				isLocalhost,
			},
			environmentVariables: {
				CI: process.env.CI,
				GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
				PARAMETER_STORE_PREFIX: process.env.PARAMETER_STORE_PREFIX,
				AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
				APP_ENV: process.env.APP_ENV,
				NODE_ENV: process.env.NODE_ENV,
				RUNTIME_CONFIG_REQUIRED: process.env.RUNTIME_CONFIG_REQUIRED,
			},
		},
		`Environment detected as: ${environment}`,
	)

	return environment
}

/**
 * Get environment-specific metadata for debugging
 */
export const getEnvironmentMetadata = () => {
	const environment = detectEnvironment()

	return {
		environment,
		detectedAt: new Date(),
		indicators: {
			isBuildTime: isBuildTimeEnvironment(),
			isEc2: isEc2Environment(),
			isLocalhost: isLocalhostEnvironment(),
		},
		environmentVariables: {
			CI: process.env.CI,
			GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
			PARAMETER_STORE_PREFIX: process.env.PARAMETER_STORE_PREFIX,
			AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
			APP_ENV: process.env.APP_ENV,
			NODE_ENV: process.env.NODE_ENV,
			RUNTIME_CONFIG_REQUIRED: process.env.RUNTIME_CONFIG_REQUIRED,
		},
	}
}

/**
 * Validate that the detected environment makes sense
 * Useful for debugging configuration issues
 */
export const validateEnvironmentDetection = (): {
	isValid: boolean
	warnings: string[]
	environment: ConfigEnvironment
} => {
	const environment = detectEnvironment()
	const warnings: string[] = []

	// Check for conflicting environment indicators
	if (isBuildTimeEnvironment() && isEc2Environment()) {
		warnings.push('Both build-time and EC2 environment indicators detected')
	}

	// Check for missing required environment variables
	if (environment === ConfigEnvironment.EC2_RUNTIME) {
		if (
			!process.env.PARAMETER_STORE_PREFIX &&
			!process.env.AWS_LAMBDA_FUNCTION_NAME
		) {
			warnings.push(
				'EC2 environment detected but no Parameter Store prefix or Lambda function name found',
			)
		}
	}

	// Check for unexpected environment combinations
	if (
		environment === ConfigEnvironment.BUILD_TIME &&
		process.env.NODE_ENV === 'production'
	) {
		warnings.push('Build-time environment detected with NODE_ENV=production')
	}

	return {
		isValid: warnings.length === 0,
		warnings,
		environment,
	}
}

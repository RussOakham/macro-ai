/**
 * Environment Utilities
 *
 * Provides utilities for determining environment-specific configuration
 * including automatic parameter store prefix resolution.
 */

/**
 * Determines the AWS Parameter Store prefix based on the current environment
 *
 * @param appEnv - The APP_ENV environment variable value
 * @returns The parameter store prefix path
 *
 * @example
 * getParameterStorePrefix('development') // returns '/macro-ai/development/'
 * getParameterStorePrefix('staging') // returns '/macro-ai/staging/'
 * getParameterStorePrefix('production') // returns '/macro-ai/production/'
 * getParameterStorePrefix('pr-123') // returns '/macro-ai/development/'
 */
const getParameterStorePrefix = (appEnv: string): string => {
	// Preview branches (pr-*) should use development parameters
	if (appEnv.startsWith('pr-')) {
		return '/macro-ai/development/'
	}

	// Standard environments
	switch (appEnv) {
		case 'development':
			return '/macro-ai/development/'
		case 'staging':
			return '/macro-ai/staging/'
		case 'production':
			return '/macro-ai/production/'
		case 'test':
			// For tests, use development parameters as default
			return '/macro-ai/development/'
		default:
			// Fallback to development for unknown environments
			console.warn(
				`Unknown environment '${appEnv}', falling back to development parameters`,
			)
			return '/macro-ai/development/'
	}
}

/**
 * Gets the current environment from environment variables
 *
 * @returns The current environment string
 * @throws Error if APP_ENV is not set
 */
const getCurrentEnvironment = (): string => {
	const appEnv = process.env.APP_ENV

	if (!appEnv) {
		throw new Error('APP_ENV environment variable is required')
	}

	return appEnv
}

/**
 * Gets the current parameter store prefix automatically
 *
 * @returns The parameter store prefix for the current environment
 * @throws Error if APP_ENV is not set
 */
const getCurrentParameterStorePrefix = (): string => {
	const appEnv = getCurrentEnvironment()
	return getParameterStorePrefix(appEnv)
}

/**
 * Environment type for type safety
 */
type Environment =
	| 'development'
	| 'staging'
	| 'production'
	| 'test'
	| `pr-${number}`

/**
 * Checks if the current environment is a preview environment
 *
 * @param appEnv - The APP_ENV environment variable value
 * @returns True if it's a preview environment (pr-*)
 */
const isPreviewEnvironment = (appEnv: string): appEnv is `pr-${number}` => {
	return appEnv.startsWith('pr-')
}

/**
 * Gets a human-readable environment name for logging/display
 *
 * @param appEnv - The APP_ENV environment variable value
 * @returns A human-readable environment name
 */
const getEnvironmentDisplayName = (appEnv: string): string => {
	if (isPreviewEnvironment(appEnv)) {
		return `Preview (${appEnv})`
	}

	return appEnv.charAt(0).toUpperCase() + appEnv.slice(1)
}

export {
	getCurrentEnvironment,
	getCurrentParameterStorePrefix,
	getEnvironmentDisplayName,
	getParameterStorePrefix,
	isPreviewEnvironment,
}

export type { Environment }

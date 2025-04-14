import { standardizeError } from '../errors/standardize-error'
import { logger } from '../logger/logger'
import { envSchema } from '../schemas/environment.schema'

export const validateEnvironment = () => {
	try {
		const env = {
			VITE_API_URL: import.meta.env.VITE_API_URL,
			VITE_API_KEY: import.meta.env.VITE_API_KEY,
		}

		const result = envSchema.safeParse(env)

		if (!result.success) {
			const error = standardizeError(result.error)
			logger.error('Environment validation failed:', error.message)
			throw new Error(`Invalid environment configuration: ${error.message}`)
		}

		return result.data
	} catch (error) {
		const err = standardizeError(error)
		logger.error('Failed to validate environment:', err.message)
		throw new Error(`Environment validation failed: ${err.message}`)
	}
}

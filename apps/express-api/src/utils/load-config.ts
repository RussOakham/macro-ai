import { config } from 'dotenv'
import { resolve } from 'path'
import { z } from 'zod'

import { envSchema, TEnv } from './env.schema.ts'
import { pino } from './logger.ts'
import { standardizeError } from './standardize-error.ts'

const { logger } = pino

const loadConfig = (): TEnv => {
	const envPath = resolve(process.cwd(), '.env')

	try {
		// Load environment variables from .env file
		const result = config({
			path: envPath,
			encoding: 'UTF-8',
			debug: process.env.NODE_ENV !== 'production',
		})

		if (result.error) {
			throw new Error(
				`Cannot parse .env file '${envPath}': ${result.error.message}`,
			)
		}

		// Validate environment variables
		const env = envSchema.parse(process.env)
		return env
	} catch (error) {
		const err = standardizeError(error)

		if (error instanceof z.ZodError) {
			const errors = error.errors
				.map((e) => {
					return `${e.path.join('.')}: ${e.message}`
				})
				.join('\n')

			logger.error(`Environment validation failed:\n${errors}`)
			throw new Error(
				`Invalid environment configuration in '${envPath}'. Check logs for details.`,
			)
		}

		logger.error(`Failed to load configuration: ${err.message}`)
		throw new Error(
			`Cannot load configuration from '${envPath}': ${err.message}`,
		)
	}
}

// Export the function instead of the loaded config
export { loadConfig }

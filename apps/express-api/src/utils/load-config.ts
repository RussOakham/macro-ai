import { config } from 'dotenv'
import { resolve } from 'path'
import { z } from 'zod'

import { envSchema, TEnv } from './env.schema.ts'
import { AppError, standardizeError } from './errors.ts'
import { pino } from './logger.ts'

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
			throw AppError.validation(
				`Cannot parse .env file '${envPath}': ${result.error.message}`,
				{ envPath, error: result.error },
				'configLoader',
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
			throw AppError.validation(
				`Invalid environment configuration in '${envPath}'. Check logs for details.`,
				{ envPath, errors },
				'configLoader',
			)
		}

		logger.error(`Failed to load configuration: ${err.message}`)
		throw AppError.validation(
			`Cannot load configuration from '${envPath}': ${err.message}`,
			{ envPath, error: err },
			'configLoader',
		)
	}
}

// Export the function instead of the loaded config
export { loadConfig }

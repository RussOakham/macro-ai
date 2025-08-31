/**
 * Simple Configuration Loader
 *
 * This replaces the complex configuration system with a simple, predictable approach:
 * - Load environment variables directly
 * - Validate against the schema
 * - No complex loading logic or Parameter Store integration
 * - Easy to test and reason about
 */

import { config as dotenvConfig } from 'dotenv'

import { envSchema, type TEnv } from './env.schema.ts'

/**
 * Get configuration for immediate use
 */
export const config = (() => {
	// Load .env file if it exists (for local development)
	dotenvConfig()

	// Parse and validate environment variables
	const result = envSchema.safeParse(process.env)

	if (!result.success) {
		const errors = result.error.errors
			.map((err) => `${err.path.join('.')}: ${err.message}`)
			.join(', ')

		throw new Error(`Environment configuration error: ${errors}`)
	}

	return result.data
})()

/**
 * Type-safe configuration access
 */
export type Config = TEnv

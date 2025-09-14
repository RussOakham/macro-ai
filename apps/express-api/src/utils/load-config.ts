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
import { fromError } from 'zod-validation-error'

import { envSchema, type TEnv } from './env.schema.ts'

/**
 * Get configuration for immediate use
 */
export const config = (() => {
	// Load .env file if it exists (for local development)
	dotenvConfig()

	// DEBUG: Log API_KEY before validation
	console.log(`[DEBUG] Application Startup: Environment variables loaded`)
	console.log(
		`[DEBUG]   Total process.env variables: ${Object.keys(process.env).length}`,
	)

	if (process.env.API_KEY) {
		console.log(
			`[DEBUG]   API_KEY: ${process.env.API_KEY} (${process.env.API_KEY.length} chars)`,
		)
	} else {
		console.log(`[ERROR]   API_KEY: NOT FOUND in process.env!`)
		console.log(`[ERROR]   Available environment variables starting with 'A':`)
		Object.keys(process.env)
			.filter((key) => key.startsWith('A'))
			.forEach((key) => console.log(`[ERROR]     ${key}: ${process.env[key]}`))
	}

	// Parse and validate environment variables
	const result = envSchema.safeParse(process.env)

	if (!result.success) {
		const errors = fromError(result.error)
		console.error(`[ERROR] Environment configuration validation failed:`)
		console.error(`[ERROR] ${errors.message}`)
		console.error(`[ERROR] Available environment variables:`)
		Object.keys(process.env).forEach((key) => {
			if (key.includes('API') || key.includes('KEY')) {
				console.error(`[ERROR]   ${key}: ${process.env[key]}`)
			}
		})

		throw new Error(`Environment configuration error: ${errors.message}`)
	}

	console.log(
		`[DEBUG] Application Startup: Configuration validation successful`,
	)
	console.log(
		`[DEBUG]   API_KEY validated: ${result.data.API_KEY} (${result.data.API_KEY.length} chars)`,
	)

	return result.data
})()

/**
 * Type-safe configuration access
 */
export type Config = TEnv

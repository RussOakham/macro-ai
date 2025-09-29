// API client exports - auto-generated from OpenAPI spec by Hey API
// All schemas, types, and clients are generated directly from the OpenAPI specification

// Export all generated artifacts (types, schemas, etc.)
export * from './client/index.ts'

// Create a configured client instance using our runtime configuration
import { createClient, createConfig } from './client/client/index.ts'
import type { ClientOptions, Config } from './client/client/types.gen.ts'
import { z } from 'zod'
import { fromError } from 'zod-validation-error'

// Create client configuration using our runtime settings
const createClientConfig = (override: ClientOptions) => {
	const baseConfig = {
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		responseType: 'json' as const,
		timeout: 30000,
		validateStatus: (status: number) => status >= 200 && status < 300,
		...override,
	}

	return baseConfig
}

// Export the client creator function for app-specific configuration
export const createApiClient = (baseURL: string, config?: Partial<Config>) => {
	// Validate baseURL using Zod URL schema
	const urlSchema = z.url('baseURL must be a valid URL')
	const validationResult = urlSchema.safeParse(baseURL)

	if (!validationResult.success) {
		const validationError = fromError(validationResult.error)
		throw new Error(
			`baseURL validation failed: ${validationError.message}. The API client is environment-agnostic and does not provide defaults.`,
		)
	}

	return createClient(
		createConfig({
			...createClientConfig({ baseURL }),
			...config,
		}),
	)
}

// Export the base client type for app usage
export type { ClientOptions, Config }

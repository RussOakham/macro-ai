// API client exports - auto-generated from OpenAPI spec by Hey API
// All schemas, types, and clients are generated directly from the OpenAPI specification

// Export all generated artifacts (types, schemas, etc.)
export * from './client/index.js'

// Create a configured client instance using our runtime configuration
import { createClient, createConfig } from './client/client/index.js'
import type { ClientOptions, Config } from './client/client/types.gen.js'

// Create client configuration using our runtime settings
const createClientConfig = (override?: ClientOptions) => {
	const baseConfig = {
		baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		timeout: 30000,
		responseType: 'json' as const,
		validateStatus: (status: number) => status >= 200 && status < 300,
		...override,
	}

	return baseConfig
}

// Export the client creator function for app-specific configuration
export const createApiClient = (baseURL: string, config?: Partial<Config>) => {
	return createClient(
		createConfig({
			...createClientConfig(),
			baseURL,
			...config,
		}),
	)
}

// Export the base client type for app usage
export type { ClientOptions, Config }

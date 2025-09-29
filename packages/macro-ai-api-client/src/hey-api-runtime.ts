import type { CreateClientConfig } from './client/client.gen'

/**
 * Runtime configuration for the Hey API Axios client
 * This file is referenced by the generated client.gen.ts
 */
export const createClientConfig: CreateClientConfig = (config) => {
	// baseURL is required - throw error if not provided
	if (!config?.baseURL) {
		throw new Error(
			'baseURL is required and must be provided explicitly. The API client is environment-agnostic and does not provide defaults.',
		)
	}

	return {
		...config,
		// Base configuration that will be applied to all requests
		baseURL: config.baseURL,

		// Default headers
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...config?.headers,
		},

		// Response type
		responseType: 'json',

		// Timeout configuration
		timeout: 30000, // 30 seconds

		// Validate status (only consider 2xx as successful)
		validateStatus: (status) => status >= 200 && status < 300,
	}
}

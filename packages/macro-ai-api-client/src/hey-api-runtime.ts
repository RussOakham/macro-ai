import type { CreateClientConfig } from './client/client.gen'

/**
 * Runtime configuration for the Hey API Axios client
 * This file is referenced by the generated client.gen.ts
 */
export const createClientConfig: CreateClientConfig = (config) => ({
	...config,
	// Base configuration that will be applied to all requests
	baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',

	// Default headers
	headers: {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		...(config?.headers ?? {}),
	},

	// Timeout configuration
	timeout: 30000, // 30 seconds

	// Response type
	responseType: 'json',

	// Validate status (only consider 2xx as successful)
	validateStatus: (status) => status >= 200 && status < 300,
})

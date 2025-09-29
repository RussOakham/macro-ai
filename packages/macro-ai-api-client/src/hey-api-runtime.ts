import type { CreateClientConfig } from './client/client.gen'

/**
 * Get the base URL for the API client
 * Supports both Node.js and browser environments
 */
function getBaseURL(): string {
	// Check if we're in a browser environment
	if (typeof globalThis.window !== 'undefined') {
		// Browser environment - use import.meta.env or fallback
		const meta = import.meta as {
			env?: { VITE_API_BASE_URL?: string; VITE_API_URL?: string }
		}
		return (
			meta.env?.VITE_API_URL ??
			meta.env?.VITE_API_BASE_URL ??
			'http://localhost:3000'
		)
	}

	// Node.js environment - use process.env
	return process.env.API_BASE_URL ?? 'http://localhost:3000'
}

/**
 * Runtime configuration for the Hey API Axios client
 * This file is referenced by the generated client.gen.ts
 */
export const createClientConfig: CreateClientConfig = (config) => ({
	...config,
	// Base configuration that will be applied to all requests
	// Honor caller's baseURL if provided, otherwise use environment-based default
	baseURL: config?.baseURL ?? getBaseURL(),

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
})

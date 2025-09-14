import { type Config, createApiClient } from '@repo/macro-ai-api-client'

import { validateEnvironment } from '@/lib/validation/environment'

const env = validateEnvironment()

// Shared configuration for all API clients
const sharedConfig: Partial<Config> = {
	headers: {
		'X-API-KEY': env.VITE_API_KEY,
	},
	withCredentials: true,
}

// Create unified client with shared configuration
const apiClient = createApiClient(env.VITE_API_URL, sharedConfig)

// Create a version without credentials for non-auth endpoints
const sharedConfigWithoutCredentials: Partial<Config> = {
	headers: {
		'X-API-KEY': env.VITE_API_KEY,
	},
	withCredentials: false,
}

const apiClientWithoutCredentials = createApiClient(
	env.VITE_API_URL,
	sharedConfigWithoutCredentials,
)

// Export types for convenience
type ApiClient = typeof apiClient
type ApiClientWithoutCredentials = typeof apiClientWithoutCredentials

// Initialize API clients and interceptors using dynamic imports to avoid circular dependencies
// oxlint-disable-next-line no-unassigned-import first
import './initialize-api'

export { apiClient, apiClientWithoutCredentials }
export type { ApiClient, ApiClientWithoutCredentials }

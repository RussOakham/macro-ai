import type { Config } from '@repo/macro-ai-api-client'

import { createApiClient } from '@repo/macro-ai-api-client'

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
export const apiClient = createApiClient(env.VITE_API_URL, sharedConfig)

// Create a version without credentials for non-auth endpoints
const sharedConfigWithoutCredentials: Partial<Config> = {
	headers: {
		'X-API-KEY': env.VITE_API_KEY,
	},
	withCredentials: false,
}

export const apiClientWithoutCredentials = createApiClient(
	env.VITE_API_URL,
	sharedConfigWithoutCredentials,
)

// Export types for convenience
export type ApiClient = typeof apiClient
export type ApiClientWithoutCredentials = typeof apiClientWithoutCredentials

// Initialize interceptors through a separate module to avoid circular dependencies
import './interceptor-init'

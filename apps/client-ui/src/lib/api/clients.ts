import type { Config } from '@repo/macro-ai-api-client'

import { createApiClient } from '@repo/macro-ai-api-client'

import { validateEnvironment } from '@/lib/validation/environment'

import { applyTokenRefreshInterceptors } from './interceptors'

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

// Apply token refresh interceptors to all clients
applyTokenRefreshInterceptors({ axios: apiClient.instance })
applyTokenRefreshInterceptors({ axios: apiClientWithoutCredentials.instance })

// Export types for convenience
export type ApiClient = typeof apiClient
export type ApiClientWithoutCredentials = typeof apiClientWithoutCredentials

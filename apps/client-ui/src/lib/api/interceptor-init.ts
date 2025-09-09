/**
 * Interceptor initialization
 *
 * This module handles the initialization of token refresh interceptors
 * after all other modules are loaded to prevent circular dependencies.
 */

import { apiClient, apiClientWithoutCredentials } from './clients'
import { applyTokenRefreshInterceptors } from './interceptors'

/**
 * Initialize token refresh interceptors for all clients
 * This is called after all modules are loaded to prevent circular dependencies
 */
export const initializeTokenRefreshInterceptors = () => {
	try {
		applyTokenRefreshInterceptors({ axios: apiClient.instance })
		applyTokenRefreshInterceptors({
			axios: apiClientWithoutCredentials.instance,
		})
	} catch (error) {
		console.warn('Failed to initialize token refresh interceptors:', error)
	}
}

// Auto-initialization is now handled by initialize-api.ts to avoid circular dependencies

/**
 * API Initialization
 *
 * This module handles the initialization of API clients and interceptors
 * using dynamic imports to avoid circular dependencies.
 */

// Flag to prevent multiple initializations
let isInitialized = false

const initializeApiClients = async () => {
	if (isInitialized) {
		return
	}

	try {
		// Dynamically import clients and interceptors to avoid circular dependencies
		const [
			{ apiClient, apiClientWithoutCredentials },
			{ applyTokenRefreshInterceptors },
		] = await Promise.all([import('./clients'), import('./interceptors')])

		// Apply interceptors to both clients
		applyTokenRefreshInterceptors({ axios: apiClient.instance })
		applyTokenRefreshInterceptors({
			axios: apiClientWithoutCredentials.instance,
		})

		isInitialized = true
	} catch (error) {
		console.warn('Failed to initialize API clients:', error)
	}
}

// Auto-initialize in the appropriate environment
if (typeof globalThis.window !== 'undefined') {
	// Browser environment - initialize after a short delay
	setTimeout(() => {
		void initializeApiClients()
	}, 0)
} else {
	// Node environment (tests) - initialize immediately
	void initializeApiClients()
}

export { initializeApiClients }

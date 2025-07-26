/**
 * Shared refresh promise utility for coordinating token refresh across
 * axios interceptors and auth utilities to prevent race conditions
 */

// Shared promise that tracks ongoing refresh operations
let sharedRefreshPromise: Promise<void> | null = null

/**
 * Sets the shared refresh promise when a refresh operation begins
 * This should be called by the axios interceptor when it starts refreshing
 *
 * @param refreshPromise - The promise representing the ongoing refresh operation
 */
export const setSharedRefreshPromise = (
	refreshPromise: Promise<void>,
): void => {
	sharedRefreshPromise = refreshPromise
}

/**
 * Gets the current shared refresh promise if one exists
 * This allows other parts of the app to wait for ongoing refresh operations
 *
 * @returns The current refresh promise or null if no refresh is in progress
 */
export const getSharedRefreshPromise = (): Promise<void> | null => {
	return sharedRefreshPromise
}

/**
 * Clears the shared refresh promise when the refresh operation completes
 * This should be called in the finally block of refresh operations
 */
export const clearSharedRefreshPromise = (): void => {
	sharedRefreshPromise = null
}

/**
 * Waits for any ongoing refresh operation to complete
 * If no refresh is in progress, resolves immediately
 *
 * @returns Promise that resolves when any ongoing refresh completes
 */
export const waitForRefreshCompletion = async (): Promise<void> => {
	if (sharedRefreshPromise) {
		try {
			await sharedRefreshPromise
		} catch {
			// Ignore refresh errors here - the caller should handle them
			// We just want to wait for the refresh attempt to complete
		}
	}
}

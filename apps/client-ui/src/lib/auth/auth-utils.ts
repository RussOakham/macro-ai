import { QueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { getAuthUser } from '@/services/network/auth/get-auth-user'
import { postRefreshToken } from '@/services/network/auth/post-refresh-token'

import { waitForRefreshCompletion } from './shared-refresh-promise'

// Module-level variable to store ongoing refresh promise (singleton pattern)
let ongoingRefreshPromise: ReturnType<typeof postRefreshToken> | null = null

/**
 * Cross-platform base64 decoding utility
 * Works in both browser and Node.js environments (SSR-compatible)
 *
 * @param base64String - The base64 encoded string to decode
 * @returns The decoded string
 */
const decodeBase64 = (base64String: string): string => {
	// Normalize base64url -> base64, strip whitespace, and add padding
	let b64 = base64String.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
	const padLen = (4 - (b64.length % 4)) % 4
	if (padLen) b64 += '='.repeat(padLen)

	// Node.js (SSR)
	if (typeof window === 'undefined' && typeof Buffer !== 'undefined') {
		return Buffer.from(b64, 'base64').toString('utf8')
	}
	// Browser
	return atob(b64)
}

/**
 * JWT payload interface for type safety
 * Contains the standard JWT claims we need for token validation
 */
interface JwtPayload {
	exp: number // Expiration time (Unix timestamp)
	iat?: number // Issued at time (Unix timestamp)
	sub?: string // Subject (user ID)
	[key: string]: unknown // Allow additional claims
}

/**
 * Result type for authentication attempts
 */
type AuthenticationResult =
	| { success: true; user: Awaited<ReturnType<typeof getAuthUser>> }
	| {
			success: false
			reason:
				| 'no-access-token'
				| 'invalid-user'
				| 'refresh-failed'
				| 'auth-error'
	  }

/**
 * Attempts authentication with automatic token refresh capability
 *
 * This utility handles the complete authentication flow:
 * 1. Checks for access token cookie existence
 * 2. If no access token, attempts refresh using httpOnly refresh token
 * 3. If access token exists, validates it with the server
 * 4. If validation fails with 401, allows axios interceptor to handle refresh
 * 5. Returns success/failure with appropriate reason codes
 *
 * @param queryClient TanStack Query client for cache management
 * @returns Promise<AuthenticationResult> indicating success or failure with reason
 */
export const attemptAuthenticationWithRefresh = async (
	queryClient: QueryClient,
): Promise<AuthenticationResult> => {
	const accessToken = Cookies.get('macro-ai-accessToken')

	// If no access token cookie exists, attempt refresh first
	if (!accessToken) {
		logger.debug('No access token found, attempting refresh')

		try {
			// Implement singleton pattern to prevent concurrent refresh requests
			ongoingRefreshPromise ??= postRefreshToken()

			try {
				// Await the ongoing refresh promise (either new or existing)
				await ongoingRefreshPromise
				logger.debug('Token refresh successful, retrying auth user fetch')
			} finally {
				// Reset the promise to allow future refresh attempts
				ongoingRefreshPromise = null
			}

			// After successful refresh, try to get auth user
			const authUser = await getAuthUser()
			queryClient.setQueryData([QUERY_KEY.authUser], authUser)

			if (!authUser.id) {
				logger.warn('Auth user has no ID after successful refresh')
				return { success: false, reason: 'invalid-user' }
			}

			return { success: true, user: authUser }
		} catch (refreshError) {
			const err = standardizeError(refreshError)
			logger.error(`Token refresh failed: ${err.message}`)

			// If refresh fails, it means no valid refresh token exists
			return { success: false, reason: 'refresh-failed' }
		}
	}

	// Access token exists, try to validate it
	try {
		logger.debug('Access token found, validating with server')

		// Check if we already have cached auth user data
		const cachedAuthUser = queryClient.getQueryData([QUERY_KEY.authUser])

		if (cachedAuthUser) {
			logger.debug('Using cached auth user data')
			return {
				success: true,
				user: cachedAuthUser as Awaited<ReturnType<typeof getAuthUser>>,
			}
		}

		// No cached data, fetch auth user to validate token
		const authUser = await getAuthUser()
		queryClient.setQueryData([QUERY_KEY.authUser], authUser)

		if (!authUser.id) {
			logger.warn('Auth user has no ID')
			return { success: false, reason: 'invalid-user' }
		}

		return { success: true, user: authUser }
	} catch (error) {
		const err = standardizeError(error)
		logger.debug(`Auth validation failed: ${err.message}`)

		// If we get a 401, the axios interceptor should handle token refresh automatically
		// We should wait for any ongoing refresh operation to complete
		if (err.status === 401) {
			logger.debug('Got 401, waiting for axios interceptor to handle refresh')

			// Wait for any ongoing refresh operation to complete
			await waitForRefreshCompletion()

			try {
				const authUser = await getAuthUser()
				queryClient.setQueryData([QUERY_KEY.authUser], authUser)

				if (!authUser.id) {
					return { success: false, reason: 'invalid-user' }
				}

				logger.debug('Auth successful after axios interceptor refresh')
				return { success: true, user: authUser }
			} catch (retryError) {
				const retryErr = standardizeError(retryError)
				logger.error(`Auth retry failed after interceptor: ${retryErr.message}`)
				return { success: false, reason: 'refresh-failed' }
			}
		}

		// For non-401 errors, this is a genuine auth failure
		return { success: false, reason: 'auth-error' }
	}
}

/**
 * Checks if a JWT token is expired based on its exp claim
 * Note: This is a client-side check and should not be relied upon for security
 *
 * @param token JWT token string
 * @returns boolean indicating if token appears expired
 */
export const isTokenExpired = (token: string): boolean => {
	try {
		const parts = token.split('.')
		if (parts.length !== 3 || !parts[1]) {
			return true
		}
		const payload = JSON.parse(decodeBase64(parts[1])) as JwtPayload
		const currentTime = Math.floor(Date.now() / 1000)
		return payload.exp < currentTime
	} catch {
		// If we can't parse the token, assume it's expired/invalid
		return true
	}
}

/**
 * Checks if a JWT token should be refreshed proactively
 * Returns true if token expires within 5 minutes
 *
 * @param token JWT token string
 * @returns boolean indicating if token should be refreshed soon
 */
export const shouldRefreshToken = (token: string): boolean => {
	try {
		const parts = token.split('.')
		if (parts.length !== 3 || !parts[1]) {
			return true
		}
		const payload = JSON.parse(decodeBase64(parts[1])) as JwtPayload
		const currentTime = Math.floor(Date.now() / 1000)
		const timeUntilExpiry = payload.exp - currentTime
		return timeUntilExpiry < 300 // Refresh if less than 5 minutes remaining
	} catch {
		// If we can't parse the token, assume it should be refreshed
		return true
	}
}

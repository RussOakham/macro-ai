import {
	AxiosError,
	AxiosInstance,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from 'axios'

import { router } from '@/main'
import { postRefreshToken } from '@/services/network/auth/postRefreshToken'

import {
	clearSharedRefreshPromise,
	setSharedRefreshPromise,
} from '../auth/shared-refresh-promise'
import { standardizeError } from '../errors/standardize-error'
import { logger } from '../logger/logger'
import { IStandardizedError } from '../types'

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false
let failedQueue: {
	resolve: (value?: unknown) => void
	reject: (reason?: unknown) => void
}[] = []

const processQueue = (error: Error | null, token: string | null = null) => {
	failedQueue.forEach((prom) => {
		if (error) {
			prom.reject(error)
		} else {
			prom.resolve(token)
		}
	})
	failedQueue = []
}

interface IExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
	_retry?: boolean
}

/**
 * Applies token refresh interceptors to a client with an axios instance
 * This ensures consistent authentication behavior across all domain clients
 */
export const applyTokenRefreshInterceptors = (client: {
	axios: AxiosInstance
}) => {
	client.axios.interceptors.response.use(
		(response: AxiosResponse) => response,
		async (error: AxiosError) => {
			const originalRequest: IExtendedAxiosRequestConfig | undefined =
				error.config

			if (!originalRequest) {
				return Promise.reject(error)
			}

			// Handle API Key errors
			if (
				error.response?.status === 500 &&
				(error.response.data as { message?: string }).message ===
					'Server configuration error'
			) {
				logger.error('API key not configured on server')
				return Promise.reject(new Error('API configuration error'))
			}

			// Handle 403 Forbidden
			if (error.response?.status === 403) {
				logger.error(`Access forbidden:`, error)
				await router.navigate({
					to: '/auth/login',
					search: {
						code: '403',
						message: 'You do not have permission to access this resource.',
					},
				})
				return Promise.reject(error)
			}

			// Handle 401 Unauthorized
			if (error.response?.status === 401 && !originalRequest._retry) {
				// If the 401 came from the refresh endpoint itself, do NOT try to refresh again.
				// This prevents an infinite interceptor loop and ensures the auth flow resolves.
				const requestUrl =
					typeof originalRequest.url === 'string' ? originalRequest.url : ''
				const isRefreshRequest = requestUrl.includes('/auth/refresh')
				if (isRefreshRequest) {
					const err = standardizeError(error)
					// Mark this error as already handled by the refresh endpoint to prevent duplicate work
					;(
						err as IStandardizedError & { __refreshHandled?: boolean }
					).__refreshHandled = true
					logger.warn(`Refresh endpoint returned 401: ${err.message}`)
					// Reject any queued requests and clear refreshing state
					processQueue(err, null)
					isRefreshing = false
					clearSharedRefreshPromise()
					// Redirect to login page so users are not stuck on a loading screen
					await router.navigate({
						to: '/auth/login',
						search: { redirect: router.state.location.pathname },
					})
					return Promise.reject(err)
				}
				if (isRefreshing) {
					return new Promise((resolve, reject) => {
						failedQueue.push({ resolve, reject })
					})
						.then(() => {
							return client.axios(originalRequest)
						})
						.catch((err: unknown) => Promise.reject(standardizeError(err)))
				}

				originalRequest._retry = true
				isRefreshing = true

				// Create and set the shared refresh promise
				const refreshPromise = (async (): Promise<void> => {
					try {
						await postRefreshToken()
						processQueue(null)
					} catch (refreshError: unknown) {
						const err = standardizeError(refreshError)
						logger.error(`Refresh token failed: ${err.message}`)
						processQueue(err, null)

						// Redirect to login page
						await router.navigate({
							to: '/auth/login',
							search: {
								redirect: router.state.location.pathname,
							},
						})
						throw err
					} finally {
						isRefreshing = false
						clearSharedRefreshPromise()
					}
				})()

				setSharedRefreshPromise(refreshPromise)

				try {
					await refreshPromise
					return await client.axios(originalRequest)
				} catch (err: unknown) {
					// Check if this error was already handled by the refresh endpoint 401 handler
					// to avoid duplicate processQueue calls and navigation
					const standardizedErr = err as IStandardizedError & {
						__refreshHandled?: boolean
					}
					if (standardizedErr.__refreshHandled) {
						// Error was already processed by the refresh endpoint handler, just reject
						return Promise.reject(standardizedErr)
					}
					return Promise.reject(err as IStandardizedError)
				}
			}

			return Promise.reject(error)
		},
	)
}

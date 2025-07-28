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
					return Promise.reject(err as IStandardizedError)
				}
			}

			return Promise.reject(error)
		},
	)
}

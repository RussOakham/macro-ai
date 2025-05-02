import { createApiClient } from '@repo/types-macro-ai-api'
import { AxiosError, InternalAxiosRequestConfig } from 'axios'

import { router } from '@/main'
import { postRefreshToken } from '@/services/auth/network/postRefreshToken'

import { standardizeError } from '../errors/standardize-error'
import { logger } from '../logger/logger'
import { validateEnvironment } from '../validation/environment'

const env = validateEnvironment()

// Create the API client with the base URL from environment
const apiClient = createApiClient(env.VITE_API_URL, {
	// Add any global options here
	axiosConfig: {
		headers: {
			'X-API-KEY': env.VITE_API_KEY,
		},
		withCredentials: true, // For auth cookies
	},
})

// Create a version without credentials for non-auth endpoints
const apiClientWithoutCredentials = createApiClient(env.VITE_API_URL, {
	axiosConfig: {
		headers: {
			'X-API-KEY': env.VITE_API_KEY,
		},
	},
})

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

apiClient.axios.interceptors.response.use(
	(response) => response,
	async (error: AxiosError) => {
		const originalRequest: IExtendedAxiosRequestConfig | undefined =
			error.config

		if (!originalRequest) {
			return Promise.reject(error)
		}

		// Handle API Key errors}
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
						return apiClient.axios(originalRequest)
					})
					.catch((err: unknown) => Promise.reject(standardizeError(err)))
			}

			originalRequest._retry = true
			isRefreshing = true

			try {
				await postRefreshToken()

				processQueue(null)
				isRefreshing = false

				return await apiClient.axios(originalRequest)
			} catch (refreshError: unknown) {
				const err = standardizeError(refreshError)
				logger.error(`Refresh token failed: ${err.message}`)

				processQueue(err, null)
				isRefreshing = false

				// Redirect to login page
				await router.navigate({
					to: '/auth/login',
					search: {
						redirect: router.state.location.pathname,
					},
				})
				return Promise.reject(err)
			}
		}

		return Promise.reject(error)
	},
)

export { apiClient, apiClientWithoutCredentials }

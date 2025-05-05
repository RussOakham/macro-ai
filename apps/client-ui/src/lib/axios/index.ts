import Axios, {
	AxiosError,
	AxiosRequestConfig,
	InternalAxiosRequestConfig,
} from 'axios'

import { router } from '@/main'
import { postRefreshToken } from '@/services/network/auth/postRefreshToken'

import { standardizeError } from '../errors/standardize-error'
import { logger } from '../logger/logger'
import { validateEnvironment } from '../validation/environment'

interface IExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
	_retry?: boolean
}

const env = validateEnvironment()

const axiosConfig: AxiosRequestConfig = {
	baseURL: env.VITE_API_URL,
	headers: {
		'Content-Type': 'application/json',
		'X-API-KEY': env.VITE_API_KEY,
	},
}

const axios = Axios.create(axiosConfig)

const axiosWithCredentials = Axios.create({
	...axiosConfig,
	withCredentials: true,
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

axiosWithCredentials.interceptors.response.use(
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
						return axiosWithCredentials(originalRequest)
					})
					.catch((err: unknown) => Promise.reject(standardizeError(err)))
			}

			originalRequest._retry = true
			isRefreshing = true

			try {
				await postRefreshToken()

				processQueue(null)
				isRefreshing = false

				return await axiosWithCredentials(originalRequest)
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

export { axios, axiosWithCredentials }

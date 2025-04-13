import Axios, {
	AxiosError,
	AxiosRequestConfig,
	InternalAxiosRequestConfig,
} from 'axios'
import Cookies from 'js-cookie'

import { router } from '@/main'
import { postRefreshToken } from '@/services/auth/network/postRefreshToken'

import { standardizeError } from '../errors/standardize-error'
import { logger } from '../logger/logger'

// Extend the InternalAxiosRequestConfig type to include _retry
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
	_retry?: boolean
}

const axiosConfig: AxiosRequestConfig = {
	baseURL: import.meta.env.VITE_API_URL as string,
	headers: {
		'Content-Type': 'application/json',
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
		const originalRequest: ExtendedAxiosRequestConfig | undefined = error.config

		if (!originalRequest) {
			return Promise.reject(error)
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
					.then(() => axiosWithCredentials(originalRequest))
					.catch(() => Promise.reject(error))
			}

			originalRequest._retry = true
			isRefreshing = true

			try {
				const response = await postRefreshToken()

				const { accessToken } = response

				// Update access token cookie
				Cookies.set('macro-ai-accessToken', accessToken, {
					expires: 1 / 24, // 1 hour
					secure: true,
					sameSite: 'strict',
				})

				axiosWithCredentials.defaults.headers.common.Authorization = `Bearer ${accessToken}`

				processQueue(null, accessToken)

				return await axiosWithCredentials(originalRequest)
			} catch (refreshError: unknown) {
				const err = standardizeError(refreshError)
				logger.error(`Refresh token failed: ${err.message}`)

				// Clear auth cookies
				Cookies.remove('macro-ai-accessToken')
				Cookies.remove('marco-ai-refreshToken')

				// Redirect to login page
				await router.navigate({
					to: '/auth/login',
					search: {
						redirect: router.state.location.pathname,
					},
				})

				return await Promise.reject(error)
			} finally {
				isRefreshing = false
			}
		}
	},
)

export { axios, axiosWithCredentials }

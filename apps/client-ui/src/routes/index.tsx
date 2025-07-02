import { createFileRoute, redirect } from '@tanstack/react-router'
import Cookies from 'js-cookie'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import {
	getAuthUser,
	TGetAuthUserResponse,
} from '@/services/network/auth/getAuthUser'

const Index = () => {
	// This component should never render as we redirect in beforeLoad
	return null
}

export const Route = createFileRoute('/')({
	component: Index,
	beforeLoad: async ({ context, location }) => {
		const { queryClient } = context
		const accessToken = Cookies.get('macro-ai-accessToken')

		// If no access token, redirect to login
		if (!accessToken) {
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw redirect({
				to: '/auth/login',
				search: {
					redirect: location.pathname,
				},
			})
		}

		// Try to get authenticated user data to verify token validity
		try {
			// Check if we already have cached auth user data
			const cachedAuthUser = queryClient.getQueryData<TGetAuthUserResponse>([
				QUERY_KEY.authUser,
			])

			if (!cachedAuthUser) {
				// If no cached data, fetch auth user to validate token
				const authUser = await getAuthUser()

				// Cache the auth user data
				queryClient.setQueryData([QUERY_KEY.authUser], authUser)

				// If auth user doesn't have an ID, redirect to login
				if (!authUser.id) {
					// eslint-disable-next-line @typescript-eslint/only-throw-error
					throw redirect({
						to: '/auth/login',
						search: {
							redirect: location.pathname,
						},
					})
				}
			}

			// If authenticated, redirect to chat
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw redirect({
				to: '/chat',
			})
		} catch (error: unknown) {
			// Check if this is our redirect
			if (error && typeof error === 'object' && 'to' in error) {
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw error
			}

			// If auth check fails, redirect to login
			const err = standardizeError(error)

			logger.error(`Auth check failed: ${err.message}`)
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw redirect({
				to: '/auth/login',
				search: {
					redirect: location.pathname,
				},
			})
		}
	},
})

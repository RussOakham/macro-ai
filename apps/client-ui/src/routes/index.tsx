import { createFileRoute, redirect } from '@tanstack/react-router'
import Cookies from 'js-cookie'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { useGetUser } from '@/services/hooks/user/getUser'
import {
	getAuthUser,
	TGetAuthUserResponse,
} from '@/services/network/auth/getAuthUser'

const Index = () => {
	const { data: user, isFetching, isError, error, isSuccess } = useGetUser()

	if (isFetching && !user) {
		return <div>Loading...</div>
	}

	if (isError || !isSuccess) {
		const err = standardizeError(error)

		return <div>Error: {err.message}</div>
	}

	// TODO: Implement refresh token logic
	// TODO: Implement logout logic

	return (
		<div className="p-2">
			<h3>Welcome Home!</h3>
			<p>{JSON.stringify(user)}</p>
		</div>
	)
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
				return
			}
		} catch (error: unknown) {
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

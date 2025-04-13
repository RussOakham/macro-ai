import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import Cookies from 'js-cookie'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'

import { getUser } from '../network/getUser'
import { postRefreshToken } from '../network/postRefreshToken'

const usePostRefreshToken = () => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	return useMutation({
		mutationFn: postRefreshToken,
		onError: async (error) => {
			const err = standardizeError(error)

			logger.error(
				`Refresh token failed: ${err.status.toString()} ${err.message}`,
			)
			Cookies.remove('macro-ai-accessToken')
			Cookies.remove('marco-ai-refreshToken')
			await navigate({ to: '/auth/login' })
			return err
		},
		onSuccess: async (data) => {
			// After successful login, fetch user data
			const userData = await getUser({ accessToken: data.accessToken })

			// Update query cache with BOTH query keys
			queryClient.setQueryData([QUERY_KEY.user], userData)
			queryClient.setQueryData([QUERY_KEY.user, data.accessToken], userData)
		},
	})
}

export { usePostRefreshToken }

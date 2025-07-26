import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import Cookies from 'js-cookie'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'

import { getAuthUser } from '../../network/auth/getAuthUser'
import { postRefreshToken } from '../../network/auth/postRefreshToken'

const usePostRefreshToken = () => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	return useMutation({
		mutationFn: async () => {
			const response = await postRefreshToken()
			return response
		},
		onError: async (error) => {
			const err = standardizeError(error)

			logger.error(
				`Refresh token failed: ${err.status.toString()} ${err.message}`,
			)
			Cookies.remove('macro-ai-accessToken')
			Cookies.remove('macro-ai-refreshToken')
			await navigate({ to: '/auth/login' })
			return err
		},
		onSuccess: async () => {
			// After successful login, fetch user data
			const userData = await getAuthUser()

			// Update query cache with BOTH query keys
			queryClient.setQueryData([QUERY_KEY.authUser], userData)
		},
	})
}

export { usePostRefreshToken }

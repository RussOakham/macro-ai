import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'

import { ILogoutResponse, postLogout } from '../network/postLogout'

const usePostLogoutMutation = (): UseMutationResult<
	ILogoutResponse,
	unknown,
	void
> => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	return useMutation<ILogoutResponse, unknown>({
		mutationFn: async () => {
			const response = await postLogout()
			return response.data
		},
		onError: (error) => {
			const err = standardizeError(error)
			logger.error(`Logout failed: ${err.message}`)
			toast.error('Logout failed')
		},
		onSuccess: async () => {
			// First set the user data to null (this will trigger observers)
			queryClient.setQueryData([QUERY_KEY.user], null)

			// Then remove all queries that start with the user key
			queryClient.removeQueries({ queryKey: [QUERY_KEY.user] })

			// Remove any other auth-related queries if needed
			// queryClient.removeQueries({ queryKey: ['other-auth-related-key'] })

			// Redirect to login page
			await navigate({ to: '/auth/login' })
		},
	})
}

export { usePostLogoutMutation }

import { schemas } from '@repo/types-macro-ai-api'
import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'

import { postLogout } from '../network/postLogout'

type TAuthResponse = z.infer<typeof schemas.AuthResponse>

const usePostLogoutMutation = (): UseMutationResult<
	TAuthResponse,
	unknown,
	void
> => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	return useMutation<TAuthResponse, unknown>({
		mutationFn: async () => {
			const response = await postLogout()
			return response
		},
		onError: (error) => {
			const err = standardizeError(error)
			logger.error(`Logout failed: ${err.message}`)
			toast.error('Logout failed')
		},
		onSuccess: async () => {
			queryClient.setQueryData([QUERY_KEY.user], null)
			queryClient.removeQueries({ queryKey: [QUERY_KEY.user] })
			await navigate({ to: '/auth/login' })
		},
	})
}

export { usePostLogoutMutation }

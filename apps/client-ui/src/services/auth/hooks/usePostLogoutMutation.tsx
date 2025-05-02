import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'

import { postLogout } from '../network/postLogout'

const usePostLogoutMutation = () => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	return useMutation({
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

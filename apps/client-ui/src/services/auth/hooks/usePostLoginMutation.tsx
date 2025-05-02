import { schemas } from '@repo/types-macro-ai-api'
import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { getUser } from '../network/getUser'
import { postLogin, TLogin } from '../network/postLogin'

import { z } from 'zod'

type TAuthResponse = z.infer<typeof schemas.AuthResponse>

const usePostLoginMutation = (): UseMutationResult<
	TAuthResponse,
	unknown,
	TLogin
> => {
	const queryClient = useQueryClient()

	return useMutation<TAuthResponse, unknown, TLogin>({
		mutationFn: async ({ email, password }: TLogin) => {
			const response = await postLogin({ email, password })
			return response
		},
		onSuccess: async () => {
			// After successful login, fetch user data
			const userData = await getUser()

			// Update query cache with BOTH query keys
			queryClient.setQueryData([QUERY_KEY.user], userData)
		},
	})
}

export { usePostLoginMutation }

import { TLogin, TLoginResponse } from '@repo/types-macro-ai-api'
import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { getUser } from '../network/getUser'
import { postLogin } from '../network/postLogin'

const usePostLoginMutation = (): UseMutationResult<
	TLoginResponse,
	unknown,
	TLogin
> => {
	const queryClient = useQueryClient()

	return useMutation<TLoginResponse, unknown, TLogin>({
		mutationFn: async ({ email, password }: TLogin) => {
			const response = await postLogin({ email, password })
			return response.data
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

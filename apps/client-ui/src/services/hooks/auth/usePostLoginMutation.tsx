import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { getAuthUser } from '../../network/auth/getAuthUser'
import { postLogin, TLoginRequest } from '../../network/auth/postLogin'

const usePostLoginMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ email, password }: TLoginRequest) => {
			const response = await postLogin({ email, password })
			return response
		},
		onSuccess: async () => {
			// After successful login, fetch user data
			const userData = await getAuthUser()

			// Update query cache with BOTH query keys
			queryClient.setQueryData([QUERY_KEY.authUser], userData)
		},
	})
}

export { usePostLoginMutation }

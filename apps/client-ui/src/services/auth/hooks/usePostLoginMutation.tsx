import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { getUser } from '../network/getUser'
import { postLogin, TLogin } from '../network/postLogin'

const usePostLoginMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
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

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { postRegister } from '../../network/auth/post-register'
import type { RegisterRequest } from '../../network/auth/post-register'

const usePostRegisterMutation = () => {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			email,
			password,
			confirmPassword,
		}: RegisterRequest) => {
			const response = await postRegister({
				email,
				password,
				confirmPassword,
			})
			return response
		},
		onSuccess: (_data, variables) => {
			queryClient.setQueryData([QUERY_KEY.authUser], {
				email: variables.email,
			})
		},
	})
}

export { usePostRegisterMutation }

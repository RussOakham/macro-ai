import { IAuthResponse, TRegister } from '@repo/types-macro-ai-api'
import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { postRegister } from '../network/postRegister'

const usePostRegisterMutation = (): UseMutationResult<
	IAuthResponse,
	unknown,
	TRegister
> => {
	const queryClient = useQueryClient()

	return useMutation<IAuthResponse, unknown, TRegister>({
		mutationFn: async ({ email, password, confirmPassword }: TRegister) => {
			const response = await postRegister({ email, password, confirmPassword })
			return response.data
		},
		onSuccess: (_data, variables) => {
			queryClient.setQueryData([QUERY_KEY.user], {
				email: variables.email,
			})
		},
	})
}

export { usePostRegisterMutation }

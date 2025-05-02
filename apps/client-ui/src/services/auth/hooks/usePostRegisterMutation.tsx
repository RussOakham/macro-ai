import { schemas } from '@repo/types-macro-ai-api'
import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { postRegister, TRegister } from '../network/postRegister'

import { z } from 'zod'

type TAuthResponse = z.infer<typeof schemas.AuthResponse>

const usePostRegisterMutation = (): UseMutationResult<
	TAuthResponse,
	unknown,
	TRegister
> => {
	const queryClient = useQueryClient()

	return useMutation<TAuthResponse, unknown, TRegister>({
		mutationFn: async ({ email, password, confirmPassword }: TRegister) => {
			const response = await postRegister({
				email,
				password,
				confirmPassword,
			})
			return response
		},
		onSuccess: (_data, variables) => {
			queryClient.setQueryData([QUERY_KEY.user], {
				email: variables.email,
			})
		},
	})
}

export { usePostRegisterMutation }

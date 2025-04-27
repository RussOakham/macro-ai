import { IAuthResponse, TForgotPassword } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { postForgotPassword } from '../network/postForgotPassword'

const usePostForgotPassword = (): UseMutationResult<
	IAuthResponse,
	unknown,
	TForgotPassword
> => {
	return useMutation<IAuthResponse, unknown, TForgotPassword>({
		mutationFn: async ({ email }: TForgotPassword) => {
			const response = await postForgotPassword({ email })
			return response.data
		},
	})
}

export { usePostForgotPassword }

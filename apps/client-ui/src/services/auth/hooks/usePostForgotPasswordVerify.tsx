import { IAuthResponse, TConfirmForgotPassword } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { postForgotPasswordVerify } from '../network/postForgotPasswordVerify'

const usePostForgotPasswordVerify = (): UseMutationResult<
	IAuthResponse,
	unknown,
	TConfirmForgotPassword
> => {
	return useMutation<IAuthResponse, unknown, TConfirmForgotPassword>({
		mutationFn: async ({
			code,
			email,
			newPassword,
			confirmPassword,
		}: TConfirmForgotPassword) => {
			const response = await postForgotPasswordVerify({
				code,
				email,
				newPassword,
				confirmPassword,
			})
			return response.data
		},
	})
}

export { usePostForgotPasswordVerify }

import { schemas } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'
import { z } from 'zod'

import {
	postForgotPasswordVerify,
	TConfirmForgotPassword,
} from '../network/postForgotPasswordVerify'

type TAuthResponse = z.infer<typeof schemas.AuthResponse>

const usePostForgotPasswordVerify = (): UseMutationResult<
	TAuthResponse,
	unknown,
	TConfirmForgotPassword
> => {
	return useMutation<TAuthResponse, unknown, TConfirmForgotPassword>({
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
			return response
		},
	})
}

export { usePostForgotPasswordVerify }

import { useMutation } from '@tanstack/react-query'

import { postForgotPasswordVerify } from '../../network/auth/post-forgot-password-verify'
import type { ConfirmForgotPasswordRequest } from '../../network/auth/post-forgot-password-verify'

const usePostForgotPasswordVerify = () => {
	return useMutation({
		mutationFn: async ({
			code,
			confirmPassword,
			email,
			newPassword,
		}: ConfirmForgotPasswordRequest) => {
			const response = await postForgotPasswordVerify({
				code,
				confirmPassword,
				email,
				newPassword,
			})
			return response
		},
	})
}

export { usePostForgotPasswordVerify }

import { useMutation } from '@tanstack/react-query'

import {
	ConfirmForgotPasswordRequest,
	postForgotPasswordVerify,
} from '../../network/auth/post-forgot-password-verify'

const usePostForgotPasswordVerify = () => {
	return useMutation({
		mutationFn: async ({
			code,
			email,
			newPassword,
			confirmPassword,
		}: ConfirmForgotPasswordRequest) => {
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

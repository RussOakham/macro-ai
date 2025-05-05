import { useMutation } from '@tanstack/react-query'

import {
	postForgotPasswordVerify,
	TConfirmForgotPassword,
} from '../../network/auth/postForgotPasswordVerify'

const usePostForgotPasswordVerify = () => {
	return useMutation({
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

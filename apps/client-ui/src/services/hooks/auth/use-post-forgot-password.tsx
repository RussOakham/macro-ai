import { useMutation } from '@tanstack/react-query'

import {
	ForgotPasswordRequest,
	postForgotPassword,
} from '../../network/auth/post-forgot-password'

const usePostForgotPassword = () => {
	return useMutation({
		mutationFn: async ({ email }: ForgotPasswordRequest) => {
			const response = await postForgotPassword({ email })
			return response
		},
	})
}

export { usePostForgotPassword }

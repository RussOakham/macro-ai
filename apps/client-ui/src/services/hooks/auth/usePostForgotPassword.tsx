import { useMutation } from '@tanstack/react-query'

import {
	ForgotPasswordRequest,
	postForgotPassword,
} from '../../network/auth/postForgotPassword'

const usePostForgotPassword = () => {
	return useMutation({
		mutationFn: async ({ email }: ForgotPasswordRequest) => {
			const response = await postForgotPassword({ email })
			return response
		},
	})
}

export { usePostForgotPassword }

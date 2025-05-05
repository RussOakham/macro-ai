import { useMutation } from '@tanstack/react-query'

import {
	postForgotPassword,
	TForgotPasswordClient,
} from '../../network/auth/postForgotPassword'

const usePostForgotPassword = () => {
	return useMutation({
		mutationFn: async ({ email }: TForgotPasswordClient) => {
			const response = await postForgotPassword({ email })
			return response
		},
	})
}

export { usePostForgotPassword }

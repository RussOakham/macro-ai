import { useMutation } from '@tanstack/react-query'

import {
	postResendConfirmRegistrationCode,
	TResendConfirmationCodeClient,
} from '@/services/network/auth/postResendConfirmRegistrationCode'

const usePostResendConfirmRegistrationCodeMutation = () => {
	return useMutation({
		mutationFn: async ({ email }: TResendConfirmationCodeClient) => {
			const response = await postResendConfirmRegistrationCode({
				email,
			})
			return response
		},
	})
}

export { usePostResendConfirmRegistrationCodeMutation }

import { useMutation } from '@tanstack/react-query'

import {
	postResendConfirmRegistrationCode,
	ResendConfirmationCode,
} from '@/services/network/auth/postResendConfirmRegistrationCode'

const usePostResendConfirmRegistrationCodeMutation = () => {
	return useMutation({
		mutationFn: async ({ email }: ResendConfirmationCode) => {
			const response = await postResendConfirmRegistrationCode({
				email,
			})
			return response
		},
	})
}

export { usePostResendConfirmRegistrationCodeMutation }

import { useMutation } from '@tanstack/react-query'

import { postResendConfirmRegistrationCode } from '@/services/network/auth/post-resend-confirm-registration-code'
import type { ResendConfirmationCode } from '@/services/network/auth/post-resend-confirm-registration-code'

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

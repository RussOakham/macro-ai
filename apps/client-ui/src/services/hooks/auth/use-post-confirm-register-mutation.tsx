import { useMutation } from '@tanstack/react-query'

import { postConfirmRegistration } from '../../network/auth/post-confirm-registration'
import type { ConfirmRegistration } from '../../network/auth/post-confirm-registration'

const usePostConfirmRegisterMutation = () => {
	return useMutation({
		mutationFn: async ({ code, email }: ConfirmRegistration) => {
			const response = await postConfirmRegistration({
				code,
				email,
			})
			return response
		},
	})
}

export { usePostConfirmRegisterMutation }

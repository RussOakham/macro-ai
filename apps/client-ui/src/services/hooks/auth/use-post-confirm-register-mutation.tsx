import { useMutation } from '@tanstack/react-query'

import { postConfirmRegistration } from '../../network/auth/post-confirm-registration'
import type { ConfirmRegistration } from '../../network/auth/post-confirm-registration'

const usePostConfirmRegisterMutation = () => {
	return useMutation({
		mutationFn: async ({ email, code }: ConfirmRegistration) => {
			const response = await postConfirmRegistration({
				email,
				code,
			})
			return response
		},
	})
}

export { usePostConfirmRegisterMutation }

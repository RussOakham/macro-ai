import { useMutation } from '@tanstack/react-query'

import {
	ConfirmRegistration,
	postConfirmRegistration,
} from '../../network/auth/post-confirm-registration'

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

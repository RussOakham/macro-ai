import { useMutation } from '@tanstack/react-query'

import {
	postConfirmRegistration,
	TConfirmRegistrationClient,
} from '../../network/auth/postConfirmRegistration'

const usePostConfirmRegisterMutation = () => {
	return useMutation({
		mutationFn: async ({ email, code }: TConfirmRegistrationClient) => {
			const response = await postConfirmRegistration({
				email,
				code,
			})
			return response
		},
	})
}

export { usePostConfirmRegisterMutation }

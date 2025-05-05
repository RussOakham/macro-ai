import { useMutation } from '@tanstack/react-query'

import {
	postConfirmRegistration,
	TConfirmRegistrationClient,
} from '../../network/auth/postConfirmRegistration'

const usePostConfirmRegisterMutation = () => {
	return useMutation({
		mutationFn: async ({ username, code }: TConfirmRegistrationClient) => {
			const response = await postConfirmRegistration({
				username,
				code,
			})
			return response
		},
	})
}

export { usePostConfirmRegisterMutation }

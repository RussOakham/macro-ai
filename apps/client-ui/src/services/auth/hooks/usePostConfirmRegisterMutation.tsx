import { IAuthResponse } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'

import {
	postConfirmRegistration,
	TConfirmRegistrationClient,
} from '../network/postConfirmRegistration'

const usePostConfirmRegisterMutation = (): UseMutationResult<
	IAuthResponse,
	unknown,
	TConfirmRegistrationClient
> => {
	return useMutation<IAuthResponse, unknown, TConfirmRegistrationClient>({
		mutationFn: async ({ username, code }: TConfirmRegistrationClient) => {
			const response = await postConfirmRegistration({
				username,
				code,
			})
			return response.data
		},
	})
}

export { usePostConfirmRegisterMutation }

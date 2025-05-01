import { schemas } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'

import {
	postConfirmRegistration,
	TConfirmRegistrationClient,
} from '../network/postConfirmRegistration'
import { z } from 'zod'

type IAuthResponse = z.infer<typeof schemas.AuthResponse>

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
			return response
		},
	})
}

export { usePostConfirmRegisterMutation }

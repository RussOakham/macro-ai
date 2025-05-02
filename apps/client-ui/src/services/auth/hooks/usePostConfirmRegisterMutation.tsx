import { schemas } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'

import {
	postConfirmRegistration,
	TConfirmRegistrationClient,
} from '../network/postConfirmRegistration'
import { z } from 'zod'

type TAuthResponse = z.infer<typeof schemas.AuthResponse>

const usePostConfirmRegisterMutation = (): UseMutationResult<
	TAuthResponse,
	unknown,
	TConfirmRegistrationClient
> => {
	return useMutation<TAuthResponse, unknown, TConfirmRegistrationClient>({
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

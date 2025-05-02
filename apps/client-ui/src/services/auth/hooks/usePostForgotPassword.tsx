import { schemas } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'
import { z } from 'zod'

import {
	postForgotPassword,
	TForgotPasswordClient,
} from '../network/postForgotPassword'

type TAuthResponse = z.infer<typeof schemas.AuthResponse>

const usePostForgotPassword = (): UseMutationResult<
	TAuthResponse,
	unknown,
	TForgotPasswordClient
> => {
	return useMutation<TAuthResponse, unknown, TForgotPasswordClient>({
		mutationFn: async ({ email }: TForgotPasswordClient) => {
			const response = await postForgotPassword({ email })
			return response
		},
	})
}

export { usePostForgotPassword }

import { useMutation, UseMutationResult } from '@tanstack/react-query'

import {
	postForgotPassword,
	TForgotPasswordClient,
} from '../network/postForgotPassword'

import { schemas } from '@repo/types-macro-ai-api'

import { z } from 'zod'

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

import { IAuthResponse, TConfirmRegistration } from '@repo/types-macro-ai-api'
import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { postConfirmRegistration } from '../network/postConfirmRegistration'

const usePostConfirmRegisterMutation = (): UseMutationResult<
	IAuthResponse,
	unknown,
	TConfirmRegistration
> => {
	return useMutation<IAuthResponse, unknown, TConfirmRegistration>({
		mutationFn: async ({ username, code }: TConfirmRegistration) => {
			const response = await postConfirmRegistration({
				username,
				code,
			})
			return response.data
		},
	})
}

export { usePostConfirmRegisterMutation }

import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { TConfirmationForm } from '@/lib/types'

import {
	IConfirmRegisterResponse,
	postConfirmRegistration,
} from '../network/postConfirmRegistration'

const usePostConfirmRegisterMutation = (): UseMutationResult<
	IConfirmRegisterResponse,
	unknown,
	TConfirmationForm
> => {
	return useMutation<IConfirmRegisterResponse, unknown, TConfirmationForm>({
		mutationFn: async ({ username, code }: TConfirmationForm) => {
			const response = await postConfirmRegistration({
				username,
				code,
			})
			return response.data
		},
	})
}

export { usePostConfirmRegisterMutation }

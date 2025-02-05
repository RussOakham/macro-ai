import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { TRegisterForm } from '@/lib/types'

import { IRegisterResponse, postRegister } from '../network/postRegister'

const usePostRegisterMutation = (): UseMutationResult<
	IRegisterResponse,
	unknown,
	TRegisterForm
> => {
	return useMutation<IRegisterResponse, unknown, TRegisterForm>({
		mutationFn: async ({ email, password, confirmPassword }: TRegisterForm) => {
			const response = await postRegister({ email, password, confirmPassword })
			return response.data
		},
	})
}

export { usePostRegisterMutation }

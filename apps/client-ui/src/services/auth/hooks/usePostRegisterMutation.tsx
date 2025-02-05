import { useMutation, UseMutationResult } from '@tanstack/react-query'
import { IRegisterResponse, postRegister } from '../network/postRegister'
import { TRegisterForm } from '@/lib/types'

function usePostRegisterMutation(): UseMutationResult<
	IRegisterResponse,
	unknown,
	TRegisterForm
> {
	return useMutation<IRegisterResponse, unknown, TRegisterForm>({
		mutationFn: async ({ email, password, confirmPassword }: TRegisterForm) => {
			const response = await postRegister({ email, password, confirmPassword })
			return response.data
		},
	})
}

export { usePostRegisterMutation }

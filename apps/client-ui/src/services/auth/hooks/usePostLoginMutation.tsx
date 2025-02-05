import { useMutation, UseMutationResult } from '@tanstack/react-query'

import { TLoginForm } from '@/lib/types'

import { ILoginResponse, postLogin } from '../network/postLogin'

const usePostLoginMutation = (): UseMutationResult<
	ILoginResponse,
	unknown,
	TLoginForm
> => {
	return useMutation<ILoginResponse, unknown, TLoginForm>({
		mutationFn: async ({ email, password }: TLoginForm) => {
			const response = await postLogin({ email, password })
			return response.data
		},
	})
}

export { usePostLoginMutation }

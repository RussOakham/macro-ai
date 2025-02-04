import { useMutation, UseMutationResult } from '@tanstack/react-query'
import { ILoginResponse, postLogin } from '../network/postLogin'
import { TLoginForm } from '@/lib/types'

function usePostLoginMutation(): UseMutationResult<
	ILoginResponse,
	unknown,
	TLoginForm
> {
	return useMutation<ILoginResponse, unknown, TLoginForm>({
		mutationFn: async ({ email, password }: TLoginForm) => {
			const response = await postLogin({ email, password })
			return response.data
		},
	})
}

export { usePostLoginMutation }

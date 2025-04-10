import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'
import { TLoginForm } from '@/lib/types'

import { ILoginResponse, postLogin } from '../network/postLogin'

const usePostLoginMutation = (): UseMutationResult<
	ILoginResponse,
	unknown,
	TLoginForm
> => {
	const queryClient = useQueryClient()

	return useMutation<ILoginResponse, unknown, TLoginForm>({
		mutationFn: async ({ email, password }: TLoginForm) => {
			const response = await postLogin({ email, password })
			return response.data
		},
		onSuccess: (data) => {
			queryClient.setQueryData([QUERY_KEY.auth], data)
		},
	})
}

export { usePostLoginMutation }

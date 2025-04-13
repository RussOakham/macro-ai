import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'
import { TLoginForm } from '@/lib/types'

import { getUser } from '../network/getUser'
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
		onSuccess: async (data) => {
			// After successful login, fetch user data
			const userData = await getUser({ accessToken: data.accessToken })

			// Update query cache with BOTH query keys
			queryClient.setQueryData([QUERY_KEY.user], userData)
		},
	})
}

export { usePostLoginMutation }

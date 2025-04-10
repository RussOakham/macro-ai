import {
	useMutation,
	UseMutationResult,
	useQueryClient,
} from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'
import { TRegisterForm } from '@/lib/types'

import { IRegisterResponse, postRegister } from '../network/postRegister'

const usePostRegisterMutation = (): UseMutationResult<
	IRegisterResponse,
	unknown,
	TRegisterForm
> => {
	const queryClient = useQueryClient()

	return useMutation<IRegisterResponse, unknown, TRegisterForm>({
		mutationFn: async ({ email, password, confirmPassword }: TRegisterForm) => {
			const response = await postRegister({ email, password, confirmPassword })
			return response.data
		},
		onSuccess: (_data, variables) => {
			queryClient.setQueryData([QUERY_KEY.user], {
				email: variables.email,
			})
		},
	})
}

export { usePostRegisterMutation }

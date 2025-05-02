import { schemas } from '@repo/types-macro-ai-api'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { QUERY_KEY } from '@/constants/query-keys'

type TGetUserResponse = z.infer<typeof schemas.GetUserResponse>

const useIsAuthenticated = () => {
	const {
		data: user,
		isFetching,
		isSuccess,
		isError,
	} = useQuery<TGetUserResponse>({
		queryKey: [QUERY_KEY.user],
		enabled: false,
		staleTime: Infinity,
		gcTime: Infinity,
	})

	if (isFetching || isError) {
		return false
	}
	if (!isSuccess) {
		return false
	}

	if (!user.id) {
		return false
	}

	return true
}

export { useIsAuthenticated }

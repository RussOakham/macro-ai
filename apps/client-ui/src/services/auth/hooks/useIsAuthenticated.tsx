import { TGetUserResponse } from '@repo/types-macro-ai-api'
import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

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

	return Boolean(user.id)
}

export { useIsAuthenticated }

import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'
import { TUser } from '@/lib/types/user'

const useIsAuthenticated = () => {
	const {
		data: user,
		isFetching,
		isSuccess,
		isError,
	} = useQuery<TUser>({
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

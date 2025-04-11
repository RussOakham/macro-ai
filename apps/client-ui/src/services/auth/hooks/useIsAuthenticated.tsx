import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'
import { TUser } from '@/lib/types/user'

const useIsAuthenticated = () => {
	const { data: user } = useQuery<TUser>({
		queryKey: [QUERY_KEY.user],
		enabled: false,
		staleTime: Infinity,
		gcTime: Infinity,
	})

	return Boolean(user?.id)
}

export { useIsAuthenticated }

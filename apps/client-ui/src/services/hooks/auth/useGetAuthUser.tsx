import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { getAuthUser } from '../../network/auth/getAuthUser'

const useGetAuthUser = () => {
	return useQuery({
		queryKey: [QUERY_KEY.user],
		queryFn: async () => getAuthUser(),
		staleTime: Infinity,
		gcTime: Infinity,
		refetchOnMount: false,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
	})
}

export { useGetAuthUser }

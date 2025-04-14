import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { getUser } from '../network/getUser'

const useGetUser = () => {
	return useQuery({
		queryKey: [QUERY_KEY.user],
		queryFn: async () => getUser(),
		staleTime: Infinity,
		gcTime: Infinity,
		refetchOnMount: false,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
	})
}

export { useGetUser }

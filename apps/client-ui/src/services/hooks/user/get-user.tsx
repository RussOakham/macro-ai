import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'

import { getUser } from '../../network/user/get-user'

const useGetUser = () => {
	return useQuery({
		gcTime: Infinity,
		queryFn: async () => getUser(),
		queryKey: [QUERY_KEY.user],
		refetchOnMount: false,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
		staleTime: Infinity,
	})
}

export { useGetUser }

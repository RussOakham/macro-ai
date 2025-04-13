import { useQuery } from '@tanstack/react-query'

import { QUERY_KEY } from '@/constants/query-keys'
import { TGetUser } from '@/lib/types'

import { getUser } from '../network/getUser'

const useGetUser = ({ accessToken, enabled = true }: TGetUser) => {
	return useQuery({
		// eslint-disable-next-line @tanstack/query/exhaustive-deps
		queryKey: [QUERY_KEY.user],
		queryFn: async () => getUser({ accessToken }),
		staleTime: Infinity,
		gcTime: Infinity,
		refetchOnMount: false,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
		enabled: enabled && !!accessToken,
	})
}

export { useGetUser }

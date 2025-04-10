import { useQuery } from '@tanstack/react-query'

import { TGetUser } from '@/lib/types'

import { getUser } from '../network/getUser'

const useGetUser = ({ accessToken }: TGetUser) => {
	return useQuery({
		queryKey: ['user', accessToken],
		queryFn: async () => getUser({ accessToken }),
		staleTime: Infinity,
		gcTime: Infinity,
		refetchOnMount: false,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
	})
}

export { useGetUser }

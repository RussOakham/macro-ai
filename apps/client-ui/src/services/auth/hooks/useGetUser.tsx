import { useQuery } from '@tanstack/react-query'

import { standardizeError } from '@/lib/errors/standardize-error'
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
		retry(failureCount, error) {
			const err = standardizeError(error)
			return failureCount < 3 && err.status !== 401
		},
	})
}

export { useGetUser }

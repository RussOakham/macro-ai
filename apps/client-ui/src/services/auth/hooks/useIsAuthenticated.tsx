import { schemas } from '@repo/macro-ai-api-client'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { QUERY_KEY } from '@/constants/query-keys'

import { getUser } from '../network/getUser'

type TGetUserResponse = z.infer<typeof schemas.GetUserResponse>

const useIsAuthenticated = () => {
	const {
		data: user,
		isFetching,
		isSuccess,
		isError,
	} = useQuery<TGetUserResponse>({
		queryKey: [QUERY_KEY.user],
		queryFn: async () => getUser(),
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

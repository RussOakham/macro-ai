import { schemas } from '@repo/macro-ai-api-client'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { QUERY_KEY } from '@/constants/query-keys'

import { getAuthUser } from '../../network/auth/getAuthUser'

type TGetAuthUserResponse = z.infer<typeof schemas.GetAuthUserResponse>

const useIsAuthenticated = () => {
	const {
		data: user,
		isFetching,
		isSuccess,
		isError,
	} = useQuery<TGetAuthUserResponse>({
		queryKey: [QUERY_KEY.user],
		queryFn: async () => getAuthUser(),
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

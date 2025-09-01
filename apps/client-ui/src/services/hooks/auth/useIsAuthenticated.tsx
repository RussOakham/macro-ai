import { useQuery } from '@tanstack/react-query'
import Cookies from 'js-cookie'

import { QUERY_KEY } from '@/constants/query-keys'

import { getAuthUser } from '../../network/auth/getAuthUser'

const useIsAuthenticated = () => {
	const accessToken = Cookies.get('macro-ai-accessToken')

	const {
		data: user,
		isFetching,
		isSuccess,
		isError,
	} = useQuery({
		queryKey: [QUERY_KEY.authUser],
		queryFn: async () => getAuthUser(),
		enabled: !!accessToken,
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

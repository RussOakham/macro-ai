import { apiClient } from '@/lib/api'

const getAuthUser = async () => {
	const response = await apiClient.get('/auth/user')

	return response
}

export { getAuthUser }

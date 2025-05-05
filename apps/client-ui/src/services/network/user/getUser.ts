import { apiClient } from '@/lib/api'

const getUser = async () => {
	const response = await apiClient.get('/users/me')

	return response
}

export { getUser }

import { apiClient } from '@/lib/api'

const getUser = async () => {
	const response = await apiClient.get('/auth/user')

	return response
}

export { getUser }

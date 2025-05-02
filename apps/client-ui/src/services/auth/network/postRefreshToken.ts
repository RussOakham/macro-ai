import { apiClient } from '@/lib/api'

const postRefreshToken = async () => {
	const response = await apiClient.post('/auth/refresh', undefined)

	return response.data
}

export { postRefreshToken }

import { apiClient } from '@/lib/api'

const postLogout = async () => {
	const response = await apiClient.post('/auth/logout', undefined)

	return response
}

export { postLogout }

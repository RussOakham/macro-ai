import { authClient } from '@/lib/api/clients'

const postRefreshToken = async () => {
	const response = await authClient.post('/auth/refresh', undefined)

	return response
}

export { postRefreshToken }

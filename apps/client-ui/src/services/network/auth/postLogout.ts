import { authClient } from '@/lib/api/clients'

const postLogout = async () => {
	const response = await authClient.post('/auth/logout', undefined)

	return response
}

export { postLogout }

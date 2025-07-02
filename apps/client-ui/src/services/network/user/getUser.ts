import { apiClient } from '@/lib/api'

// infer ReturnType of getUser
type TGetUserResponse = Awaited<ReturnType<typeof getUser>>

const getUser = async () => {
	const response = await apiClient.get('/users/me')

	return response
}

export { getUser }
export type { TGetUserResponse }

import { apiClient } from '@/lib/api'

// infer ReturnType of getAuthUser
type TGetAuthUserResponse = Awaited<ReturnType<typeof getAuthUser>>

const getAuthUser = async () => {
	const response = await apiClient.get('/auth/user')

	return response
}

export { getAuthUser }
export type { TGetAuthUserResponse }

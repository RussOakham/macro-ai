import { authClient } from '@/lib/api/clients'

// infer ReturnType of getAuthUser
type TGetAuthUserResponse = Awaited<ReturnType<typeof getAuthUser>>

const getAuthUser = async () => {
	const response = await authClient.get('/auth/user')

	return response
}

export { getAuthUser }
export type { TGetAuthUserResponse }

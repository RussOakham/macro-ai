import { userClient } from '@/lib/api/clients'

// infer ReturnType of getUser with proper typing
type TGetUserResponse = Awaited<ReturnType<typeof getUser>>

const getUser = async () => {
	// This should now have full type safety and intellisense
	const response = await userClient.get('/users/me', {})

	return response
}

export { getUser }
export type { TGetUserResponse }

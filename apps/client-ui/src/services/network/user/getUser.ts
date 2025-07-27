import { createUserClient } from '@repo/macro-ai-api-client'

import { validateEnvironment } from '@/lib/validation/environment'

const env = validateEnvironment()

// Create the user client with proper typing
const userClient = createUserClient(env.VITE_API_URL, {
	axiosConfig: {
		headers: {
			'X-API-KEY': env.VITE_API_KEY,
		},
		withCredentials: true,
	},
})

// infer ReturnType of getUser with proper typing
type TGetUserResponse = Awaited<ReturnType<typeof getUser>>

const getUser = async () => {
	// This should now have full type safety and intellisense
	const response = await userClient.get('/users/me', {})

	return response
}

export { getUser }
export type { TGetUserResponse }

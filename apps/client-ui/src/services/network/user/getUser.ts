import type { UserGetUsersMeResponse } from '@repo/macro-ai-api-client'

import { userClient } from '@/lib/api/clients'

// Use API client response type for better type safety
type TGetUserResponse = UserGetUsersMeResponse

const getUser = async () => {
	// This should now have full type safety and intellisense
	const response = await userClient.get('/users/me', {})

	return response
}

export { getUser }
export type { TGetUserResponse }

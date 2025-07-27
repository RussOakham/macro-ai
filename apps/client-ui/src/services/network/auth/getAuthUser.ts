import type { AuthGetUserResponse } from '@repo/macro-ai-api-client'

import { authClient } from '@/lib/api/clients'

// Use API client response type for better type safety
type TGetAuthUserResponse = AuthGetUserResponse

const getAuthUser = async () => {
	const response = await authClient.get('/auth/user')

	return response
}

export { getAuthUser }
export type { TGetAuthUserResponse }

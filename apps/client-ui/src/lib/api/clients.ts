import {
	createAuthClient,
	createChatClient,
	createUserClient,
} from '@repo/macro-ai-api-client'

import { validateEnvironment } from '@/lib/validation/environment'

const env = validateEnvironment()

// Shared configuration for all API clients
const sharedConfig = {
	axiosConfig: {
		headers: {
			'X-API-KEY': env.VITE_API_KEY,
		},
		withCredentials: true,
	},
}

// Create domain-specific clients with shared configuration
export const authClient = createAuthClient(env.VITE_API_URL, sharedConfig)
export const chatClient = createChatClient(env.VITE_API_URL, sharedConfig)
export const userClient = createUserClient(env.VITE_API_URL, sharedConfig)

// Export types for convenience
export type AuthClient = typeof authClient
export type ChatClient = typeof chatClient
export type UserClient = typeof userClient

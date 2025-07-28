import { describe, expect, it } from 'vitest'

// Import types to test they are properly exported
import type {
	AuthGetUserResponse,
	AuthPostLoginRequest,
	AuthPostLoginResponse,
	AuthPostRegisterRequest,
	ChatGetChatsResponse,
	ChatPostChatsByIdStreamRequest,
	ChatPostChatsRequest,
	UserGetUsersByIdResponse,
	UserGetUsersMeResponse,
} from '../index'

describe('TypeScript Type Exports', () => {
	describe('Auth Types', () => {
		it('should export AuthPostLoginRequest type', () => {
			const loginRequest: AuthPostLoginRequest = {
				email: 'test@example.com',
				password: 'password123',
			}
			expect(loginRequest).toBeDefined()
			expect(typeof loginRequest.email).toBe('string')
			expect(typeof loginRequest.password).toBe('string')
		})

		it('should export AuthPostLoginResponse type', () => {
			const loginResponse: AuthPostLoginResponse = {
				message: 'Login successful',
				tokens: {
					accessToken: 'access-token',
					refreshToken: 'refresh-token',
					expiresIn: 3600,
				},
			}
			expect(loginResponse).toBeDefined()
			expect(typeof loginResponse.message).toBe('string')
			expect(typeof loginResponse.tokens.accessToken).toBe('string')
		})

		it('should export AuthPostRegisterRequest type', () => {
			const registerRequest: AuthPostRegisterRequest = {
				email: 'test@example.com',
				password: 'password123',
				confirmPassword: 'password123',
			}
			expect(registerRequest).toBeDefined()
			expect(typeof registerRequest.email).toBe('string')
		})

		it('should export AuthGetUserResponse type', () => {
			const userResponse: AuthGetUserResponse = {
				id: 'user-id',
				email: 'test@example.com',
				emailVerified: true,
			}
			expect(userResponse).toBeDefined()
			expect(typeof userResponse.id).toBe('string')
		})
	})

	describe('Chat Types', () => {
		it('should export ChatGetChatsResponse type', () => {
			const chatsResponse: ChatGetChatsResponse = {
				success: true,
				data: [
					{
						id: 'chat-id',
						userId: 'user-id',
						title: 'Test Chat',
						createdAt: '2023-01-01T00:00:00Z',
						updatedAt: '2023-01-01T00:00:00Z',
					},
				],
				meta: {
					page: 1,
					limit: 10,
					total: 1,
				},
			}
			expect(chatsResponse).toBeDefined()
			expect(typeof chatsResponse.success).toBe('boolean')
		})

		it('should export ChatPostChatsRequest type', () => {
			const createChatRequest: ChatPostChatsRequest = {
				title: 'New Chat',
			}
			expect(createChatRequest).toBeDefined()
			expect(typeof createChatRequest.title).toBe('string')
		})

		it('should export ChatPostChatsByIdStreamRequest type', () => {
			const streamRequest: ChatPostChatsByIdStreamRequest = {
				messages: [
					{
						role: 'user',
						content: 'Hello, world!',
					},
				],
			}
			expect(streamRequest).toBeDefined()
			expect(Array.isArray(streamRequest.messages)).toBe(true)
			expect(streamRequest.messages).toHaveLength(1)
			expect(streamRequest.messages[0]?.role).toBe('user')
		})
	})

	describe('User Types', () => {
		it('should export UserGetUsersByIdResponse type', () => {
			const userResponse: UserGetUsersByIdResponse = {
				user: {
					id: 'user-id',
					email: 'test@example.com',
					emailVerified: true,
					firstName: 'John',
					lastName: 'Doe',
					createdAt: '2023-01-01T00:00:00Z',
					updatedAt: '2023-01-01T00:00:00Z',
					lastLogin: '2023-01-01T00:00:00Z',
				},
			}
			expect(userResponse).toBeDefined()
			expect(typeof userResponse.user.id).toBe('string')
		})

		it('should export UserGetUsersMeResponse type', () => {
			const meResponse: UserGetUsersMeResponse = {
				user: {
					id: 'user-id',
					email: 'test@example.com',
					emailVerified: true,
					firstName: 'John',
					lastName: 'Doe',
					createdAt: '2023-01-01T00:00:00Z',
					updatedAt: '2023-01-01T00:00:00Z',
					lastLogin: '2023-01-01T00:00:00Z',
				},
			}
			expect(meResponse).toBeDefined()
			expect(typeof meResponse.user.email).toBe('string')
		})
	})

	describe('Type Compatibility', () => {
		it('should allow using types for API client responses', () => {
			// This test verifies that the types can be used for typing API responses
			const mockApiResponse = (
				data: AuthPostLoginResponse,
			): AuthPostLoginResponse => {
				return data
			}

			const response = mockApiResponse({
				message: 'Success',
				tokens: {
					accessToken: 'token',
					refreshToken: 'refresh',
					expiresIn: 3600,
				},
			})

			expect(response.message).toBe('Success')
		})

		it('should allow using types for API client requests', () => {
			// This test verifies that the types can be used for typing API requests
			const mockApiRequest = (data: ChatPostChatsRequest): boolean => {
				return data.title.length > 0
			}

			const isValid = mockApiRequest({
				title: 'Test Chat',
			})

			expect(isValid).toBe(true)
		})
	})
})

import { describe, expect, it } from 'vitest'

import {
	createAuthClient,
	createChatClient,
	createUserClient,
	postAuthconfirmForgotPassword_Body,
	postAuthconfirmRegistration_Body,
	postAuthlogin_Body,
	postAuthregister_Body,
	postChatsIdstream_Body,
} from '../index'

describe('Modular API Client', () => {
	describe('Client Exports', () => {
		it('should export createAuthClient function', () => {
			expect(typeof createAuthClient).toBe('function')
		})

		it('should export createChatClient function', () => {
			expect(typeof createChatClient).toBe('function')
		})

		it('should export createUserClient function', () => {
			expect(typeof createUserClient).toBe('function')
		})
	})

	describe('Schema Validation', () => {
		it('should validate auth login schema', () => {
			const validLoginData = {
				email: 'test@example.com',
				password: 'password123',
			}

			const result = postAuthlogin_Body.safeParse(validLoginData)
			expect(result.success).toBe(true)
		})

		it('should reject invalid auth login schema', () => {
			const invalidLoginData = {
				email: 'invalid-email',
				password: '123', // too short
			}

			const result = postAuthlogin_Body.safeParse(invalidLoginData)
			expect(result.success).toBe(false)
		})

		it('should validate auth registration schema', () => {
			const validRegisterData = {
				email: 'test@example.com',
				password: 'password123',
				confirmPassword: 'password123',
			}

			const result = postAuthregister_Body.safeParse(validRegisterData)
			expect(result.success).toBe(true)
		})

		it('should validate chat stream schema', () => {
			const validChatData = {
				messages: [
					{
						role: 'user' as const,
						content: 'Hello, how are you?',
					},
				],
			}

			const result = postChatsIdstream_Body.safeParse(validChatData)
			expect(result.success).toBe(true)
		})
	})

	describe('Client Creation', () => {
		it('should create auth client with base URL', () => {
			const client = createAuthClient('http://localhost:3030/api')
			expect(client).toBeDefined()
			expect(typeof client.get).toBe('function')
			expect(typeof client.post).toBe('function')
		})

		it('should create chat client with base URL', () => {
			const client = createChatClient('http://localhost:3030/api')
			expect(client).toBeDefined()
			expect(typeof client.get).toBe('function')
			expect(typeof client.post).toBe('function')
		})

		it('should create user client with base URL', () => {
			const client = createUserClient('http://localhost:3030/api')
			expect(client).toBeDefined()
			expect(typeof client.get).toBe('function')
			expect(typeof client.post).toBe('function')
		})

		it('should create auth client with options', () => {
			const client = createAuthClient('http://localhost:3030/api', {
				axiosConfig: {
					timeout: 5000,
				},
			})
			expect(client).toBeDefined()
		})
	})

	describe('Schema Exports', () => {
		it('should export all expected auth schemas', () => {
			// Verify that all expected auth schemas are exported
			expect(postAuthregister_Body).toBeDefined()
			expect(typeof postAuthregister_Body.parse).toBe('function')

			expect(postAuthconfirmRegistration_Body).toBeDefined()
			expect(typeof postAuthconfirmRegistration_Body.parse).toBe('function')

			expect(postAuthlogin_Body).toBeDefined()
			expect(typeof postAuthlogin_Body.parse).toBe('function')

			expect(postAuthconfirmForgotPassword_Body).toBeDefined()
			expect(typeof postAuthconfirmForgotPassword_Body.parse).toBe('function')
		})

		it('should export all expected chat schemas', () => {
			// Verify that all expected chat schemas are exported
			expect(postChatsIdstream_Body).toBeDefined()
			expect(typeof postChatsIdstream_Body.parse).toBe('function')
		})

		it('should maintain modular client interfaces', () => {
			// Verify that each domain client has expected methods
			const expectedMethods = ['get', 'post', 'put', 'delete', 'patch']

			const authClient = createAuthClient('http://localhost:3030/api')
			const chatClient = createChatClient('http://localhost:3030/api')
			const userClient = createUserClient('http://localhost:3030/api')

			for (const method of expectedMethods) {
				expect(
					typeof (authClient as unknown as Record<string, unknown>)[method],
				).toBe('function')
				expect(
					typeof (chatClient as unknown as Record<string, unknown>)[method],
				).toBe('function')
				expect(
					typeof (userClient as unknown as Record<string, unknown>)[method],
				).toBe('function')
			}
		})
	})
})

import { describe, expect, it } from 'vitest'

import { api, createApiClient, schemas } from '../index'

describe('API Client', () => {
	describe('Exports', () => {
		it('should export createApiClient function', () => {
			expect(typeof createApiClient).toBe('function')
		})

		it('should export schemas object', () => {
			expect(schemas).toBeDefined()
			expect(typeof schemas).toBe('object')
		})

		it('should export api instance', () => {
			expect(api).toBeDefined()
			expect(typeof api).toBe('object')
		})
	})

	describe('Schema Validation', () => {
		it('should validate auth login schema', () => {
			const validLoginData = {
				email: 'test@example.com',
				password: 'password123',
			}

			const result = schemas.postAuthlogin_Body.safeParse(validLoginData)
			expect(result.success).toBe(true)
		})

		it('should reject invalid auth login schema', () => {
			const invalidLoginData = {
				email: 'invalid-email',
				password: '123', // too short
			}

			const result = schemas.postAuthlogin_Body.safeParse(invalidLoginData)
			expect(result.success).toBe(false)
		})

		it('should validate auth registration schema', () => {
			const validRegisterData = {
				email: 'test@example.com',
				password: 'password123',
				confirmPassword: 'password123',
			}

			const result = schemas.postAuthregister_Body.safeParse(validRegisterData)
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

			const result = schemas.postChatsIdstream_Body.safeParse(validChatData)
			expect(result.success).toBe(true)
		})
	})

	describe('Client Creation', () => {
		it('should create API client with base URL', () => {
			const client = createApiClient('http://localhost:3030/api')
			expect(client).toBeDefined()
			expect(typeof client.get).toBe('function')
			expect(typeof client.post).toBe('function')
		})

		it('should create API client with options', () => {
			const client = createApiClient('http://localhost:3030/api', {
				axiosConfig: {
					timeout: 5000,
				},
			})
			expect(client).toBeDefined()
		})
	})

	describe('Backward Compatibility', () => {
		it('should maintain all expected schema exports', () => {
			// Verify that all expected schemas are exported
			const expectedSchemas = [
				'postAuthregister_Body',
				'postAuthconfirmRegistration_Body',
				'postAuthlogin_Body',
				'postAuthconfirmForgotPassword_Body',
				'postChatsIdstream_Body',
			]

			for (const schemaName of expectedSchemas) {
				expect((schemas as Record<string, unknown>)[schemaName]).toBeDefined()
				expect(
					typeof (
						(schemas as Record<string, unknown>)[schemaName] as {
							parse: unknown
						}
					).parse,
				).toBe('function')
			}
		})

		it('should maintain API client interface', () => {
			// Verify that the API client has expected methods
			const expectedMethods = ['get', 'post', 'put', 'delete', 'patch']

			for (const method of expectedMethods) {
				expect(typeof (api as unknown as Record<string, unknown>)[method]).toBe(
					'function',
				)
			}
		})
	})
})

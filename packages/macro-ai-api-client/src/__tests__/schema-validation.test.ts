// Test runtime validation capabilities of Zod schemas
import { describe, expect, it } from 'vitest'

import {
	getAuthuser_Response,
	postAuthlogin_Body,
	postAuthlogin_Response,
	postAuthregister_Body,
} from '../schemas/auth.schemas.js'
import {
	getChats_Response,
	postChats_Body,
	postChatsIdstream_Body,
} from '../schemas/chat.schemas.js'
import {
	getUsersId_Response,
	getUsersMe_Response,
} from '../schemas/user.schemas.js'

describe('Schema Runtime Validation', () => {
	describe('Request Schema Validation', () => {
		it('should validate valid postChats_Body request', () => {
			const validRequest = {
				title: 'My New Chat',
			}

			const result = postChats_Body.safeParse(validRequest)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.title).toBe('My New Chat')
			}
		})

		it('should reject invalid postChats_Body request', () => {
			const invalidRequest = {
				title: '', // Empty title should fail validation
			}

			const result = postChats_Body.safeParse(invalidRequest)
			expect(result.success).toBe(false)
		})

		it('should validate valid postChatsIdstream_Body request', () => {
			const validRequest = {
				messages: [
					{
						role: 'user' as const,
						content: 'Hello, world!',
					},
				],
			}

			const result = postChatsIdstream_Body.safeParse(validRequest)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.messages).toHaveLength(1)
				expect(result.data.messages[0]?.role).toBe('user')
			}
		})

		it('should reject invalid postChatsIdstream_Body request', () => {
			const invalidRequest = {
				messages: [], // Empty messages array should fail validation
			}

			const result = postChatsIdstream_Body.safeParse(invalidRequest)
			expect(result.success).toBe(false)
		})
	})

	describe('Response Schema Validation', () => {
		it('should validate valid getChats_Response', () => {
			const validResponse = {
				success: true,
				data: [
					{
						id: '123e4567-e89b-12d3-a456-426614174000',
						userId: '123e4567-e89b-12d3-a456-426614174001',
						title: 'Test Chat',
						createdAt: '2023-01-01T00:00:00Z',
						updatedAt: '2023-01-01T00:00:00Z',
					},
				],
				meta: {
					page: 1,
					limit: 20,
					total: 1,
				},
			}

			const result = getChats_Response.safeParse(validResponse)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.success).toBe(true)
				expect(result.data.data).toHaveLength(1)
				expect(result.data.meta.total).toBe(1)
			}
		})

		it('should reject invalid getChats_Response', () => {
			const invalidResponse = {
				success: true,
				data: [
					{
						id: 'invalid-uuid', // Invalid UUID should fail validation
						userId: '123e4567-e89b-12d3-a456-426614174001',
						title: 'Test Chat',
						createdAt: '2023-01-01T00:00:00Z',
						updatedAt: '2023-01-01T00:00:00Z',
					},
				],
				meta: {
					page: 1,
					limit: 20,
					total: 1,
				},
			}

			const result = getChats_Response.safeParse(invalidResponse)
			expect(result.success).toBe(false)
		})
	})

	describe('Type Inference Compatibility', () => {
		it('should infer correct types from schemas', () => {
			// This test verifies that TypeScript types are correctly inferred
			const validRequest = {
				title: 'Test Chat',
			}

			const parseResult = postChats_Body.parse(validRequest)

			// TypeScript should infer the correct type here
			expect(typeof parseResult.title).toBe('string')
			expect(parseResult.title).toBe('Test Chat')
		})
	})

	describe('Auth Schema Validation', () => {
		describe('Request Schema Validation', () => {
			it('should validate valid postAuthlogin_Body request', () => {
				const validRequest = {
					email: 'test@example.com',
					password: 'Password123!',
				}

				const result = postAuthlogin_Body.safeParse(validRequest)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.email).toBe('test@example.com')
					expect(result.data.password).toBe('Password123!')
				}
			})

			it('should reject invalid postAuthlogin_Body request', () => {
				const invalidRequest = {
					email: 'invalid-email', // Invalid email format
					password: 'short', // Too short password
				}

				const result = postAuthlogin_Body.safeParse(invalidRequest)
				expect(result.success).toBe(false)
			})

			it('should validate valid postAuthregister_Body request', () => {
				const validRequest = {
					email: 'test@example.com',
					password: 'Password123!',
					confirmPassword: 'Password123!',
				}

				const result = postAuthregister_Body.safeParse(validRequest)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.email).toBe('test@example.com')
					expect(result.data.password).toBe('Password123!')
					expect(result.data.confirmPassword).toBe('Password123!')
				}
			})
		})

		describe('Response Schema Validation', () => {
			it('should validate valid postAuthlogin_Response', () => {
				const validResponse = {
					message: 'Login successful',
					tokens: {
						accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
						refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
						expiresIn: 3600,
					},
				}

				const result = postAuthlogin_Response.safeParse(validResponse)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.message).toBe('Login successful')
					expect(result.data.tokens.accessToken).toContain('eyJ')
					expect(result.data.tokens.expiresIn).toBe(3600)
				}
			})

			it('should validate valid getAuthuser_Response', () => {
				const validResponse = {
					id: 'user-123',
					email: 'test@example.com',
					emailVerified: true,
				}

				const result = getAuthuser_Response.safeParse(validResponse)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.id).toBe('user-123')
					expect(result.data.email).toBe('test@example.com')
					expect(result.data.emailVerified).toBe(true)
				}
			})
		})
	})

	describe('User Schema Validation', () => {
		describe('Response Schema Validation', () => {
			it('should validate valid getUsersId_Response', () => {
				const validResponse = {
					user: {
						id: '123e4567-e89b-12d3-a456-426614174000',
						email: 'test@example.com',
						emailVerified: true,
						firstName: 'John',
						lastName: 'Doe',
						createdAt: '2023-01-01T00:00:00Z',
						updatedAt: '2023-01-01T00:00:00Z',
						lastLogin: '2023-01-01T00:00:00Z',
					},
				}

				const result = getUsersId_Response.safeParse(validResponse)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.user.id).toBe(
						'123e4567-e89b-12d3-a456-426614174000',
					)
					expect(result.data.user.email).toBe('test@example.com')
					expect(result.data.user.firstName).toBe('John')
				}
			})

			it('should validate valid getUsersMe_Response', () => {
				const validResponse = {
					user: {
						id: '123e4567-e89b-12d3-a456-426614174000',
						email: 'me@example.com',
						emailVerified: false,
						firstName: 'Jane',
						lastName: 'Smith',
						createdAt: '2023-01-01T00:00:00Z',
						updatedAt: '2023-01-01T00:00:00Z',
						lastLogin: null,
					},
				}

				const result = getUsersMe_Response.safeParse(validResponse)
				expect(result.success).toBe(true)
				if (result.success) {
					expect(result.data.user.id).toBe(
						'123e4567-e89b-12d3-a456-426614174000',
					)
					expect(result.data.user.email).toBe('me@example.com')
					expect(result.data.user.firstName).toBe('Jane')
					expect(result.data.user.lastLogin).toBeNull()
				}
			})

			it('should reject invalid getUsersId_Response', () => {
				const invalidResponse = {
					user: {
						id: 'invalid-uuid', // Invalid UUID format
						email: 'test@example.com',
						emailVerified: true,
						firstName: 'John',
						lastName: 'Doe',
						createdAt: '2023-01-01T00:00:00Z',
						updatedAt: '2023-01-01T00:00:00Z',
						lastLogin: '2023-01-01T00:00:00Z',
					},
				}

				const result = getUsersId_Response.safeParse(invalidResponse)
				expect(result.success).toBe(false)
			})
		})
	})
})

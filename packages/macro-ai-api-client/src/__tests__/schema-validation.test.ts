// Test runtime validation capabilities of Zod schemas
import { describe, expect, it } from 'vitest'

import {
	getChats_Response,
	postChats_Body,
	postChatsIdstream_Body,
} from '../schemas/chat.schemas.js'

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
})

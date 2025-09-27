/**
 * API Integration Testing Examples
 *
 * This file demonstrates how to write integration tests for the Express API
 * using SuperTest, database integration, and proper authentication.
 *
 * Key patterns demonstrated:
 * - Setting up test environment with API keys
 * - Using SuperTest for HTTP requests
 * - Testing different authentication methods
 * - Handling error responses
 * - Database integration testing
 */

import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createServer } from '../../server.ts'
import {
	cleanupGlobalResources,
	type DatabaseTestContext,
	setupDatabaseIntegration,
} from '../database-integration.ts'

// Test API key for integration tests
const TEST_API_KEY = 'test-api-key-for-integration-tests-32-chars'

// Type definitions for API responses
interface ErrorResponse {
	message: string
	type: string
	details?: unknown[]
}

describe('API Integration Testing Examples', () => {
	let app: ReturnType<typeof createServer>
	let dbContext: DatabaseTestContext

	// Setup real database and Express app
	beforeAll(async () => {
		try {
			// Set up test environment
			process.env.API_KEY = TEST_API_KEY

			// Create Express app
			app = createServer()

			// Initialize test database
			dbContext = await setupDatabaseIntegration({
				enableLogging: false,
				runMigrations: true,
				seedTestData: true,
			})
		} catch (error) {
			console.warn(
				'Skipping API integration tests: Docker/testcontainers not available',
			)
			console.warn(error)
		}
	}, 30000)

	// Clean up after all tests
	afterAll(async () => {
		if (dbContext) {
			await dbContext.cleanup()
			await cleanupGlobalResources()
		}
	}, 10000)

	// Reset database state before each test
	beforeEach(async () => {
		if (dbContext) {
			await dbContext.resetDatabase()
		}
	})

	describe('Health Check Endpoints', () => {
		it('should return health status', async () => {
			if (!dbContext) {
				console.warn('Skipping test: Docker/testcontainers not available')
				return
			}
			const response = await request(app)
				.get('/api/health')
				.set('X-API-KEY', TEST_API_KEY)
				.expect(200)

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const healthResponse = response.body
			expect(healthResponse).toMatchObject({
				message: 'Api Health Status: OK',
			})
		})

		it('should return detailed health check', async () => {
			// Skip this test in act environment since we don't have real AWS credentials
			if (process.env.ACT_LOCAL === 'true') {
				return
			}

			const response = await request(app)
				.get('/api/health/detailed')
				.set('X-API-KEY', TEST_API_KEY)
				.expect(200)

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const detailedHealthResponse = response.body
			expect(detailedHealthResponse).toMatchObject({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				status: expect.stringMatching(/^(healthy|unhealthy|degraded)$/),
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				message: expect.stringContaining('API Health Status:'),
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				timestamp: expect.any(String),
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				uptime: expect.any(Number),
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				checks: expect.objectContaining({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					database: expect.any(Object),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					memory: expect.any(Object),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					dependencies: expect.any(Object),
				}),
			})
		})
	})

	describe('User Management API', () => {
		it('should get current user profile (requires authentication)', async () => {
			// Note: This test demonstrates the correct endpoint and expected 401 response
			// In a real test, you would authenticate first to get a valid access token
			const response = await request(app).get('/api/users/me').expect(401)

			const errorResponse = response.body as ErrorResponse
			expect(errorResponse).toMatchObject({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				message: expect.stringContaining('API key'),
			})
		})

		it('should get user by ID (requires authentication)', async () => {
			// Note: This test demonstrates the correct endpoint and expected 401 response
			// In a real test, you would authenticate first to get a valid access token
			const testUserId = '123e4567-e89b-12d3-a456-426614174000'

			const response = await request(app)
				.get(`/api/users/${testUserId}`)
				.expect(401)

			const errorResponse = response.body as ErrorResponse
			expect(errorResponse).toMatchObject({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				message: expect.stringContaining('API key'),
			})
		})
	})

	describe('Chat Management API', () => {
		it('should get user chats (requires bearer token authentication)', async () => {
			// Note: This test demonstrates the correct endpoint and expected 401 response
			// In a real test, you would authenticate first to get a valid bearer token
			const response = await request(app).get('/api/chats').expect(401)

			const errorResponse = response.body as ErrorResponse
			expect(errorResponse).toMatchObject({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				message: expect.stringContaining('API key'),
			})
		})

		it('should create a new chat (requires both CSRF token and API key)', async () => {
			// Note: This test demonstrates the correct endpoint and expected 401 response
			// when API key validation fails (CSRF is skipped for /api/ routes)
			const newChat = {
				title: 'Test Chat',
			}

			// First get a CSRF token (required for all POST requests)
			const csrfResponse = await request(app).get('/api/csrf-token').expect(200)

			const { csrfToken } = csrfResponse.body as { csrfToken: string }

			// Test with CSRF token but no API key - should get 401 (API key validation fails first)
			const response = await request(app)
				.post('/api/chats')
				.set('X-CSRF-Token', csrfToken)
				.send(newChat)
				.expect(401)

			const errorResponse = response.body as ErrorResponse
			expect(errorResponse).toMatchObject({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				message: expect.stringContaining('API key'),
			})
		})
	})

	describe('Error Handling', () => {
		it('should handle malformed JSON', async () => {
			// First get a CSRF token (required for all POST requests)
			const csrfResponse = await request(app).get('/api/csrf-token').expect(200)

			const { csrfToken } = csrfResponse.body as { csrfToken: string }

			const response = await request(app)
				.post('/api/chats')
				.set('Content-Type', 'application/json')
				.set('X-API-KEY', TEST_API_KEY)
				.set('X-CSRF-Token', csrfToken)
				.send('{"invalid": json}')
				.expect(500)

			const errorResponse = response.body as ErrorResponse
			expect(errorResponse).toMatchObject({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				message: expect.stringContaining('JSON'),
			})
		})

		it('should handle missing API key', async () => {
			const response = await request(app).get('/api/system-info').expect(401)

			const errorResponse = response.body as ErrorResponse
			expect(errorResponse).toMatchObject({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				message: expect.stringContaining('API key'),
			})
		})
	})

	describe('Performance Testing', () => {
		it('should respond to health check within acceptable time', async () => {
			const startTime = Date.now()

			await request(app)
				.get('/api/health')
				.set('X-API-KEY', TEST_API_KEY)
				.expect(200)

			const responseTime = Date.now() - startTime
			expect(responseTime).toBeLessThan(1000) // Should respond within 1 second
		})
	})
})

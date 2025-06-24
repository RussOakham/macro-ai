import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	ChainedResult,
	createAuthenticatedRequest,
	createExpressMocks,
	createMockNext,
	createMockRequest,
	createMockResponse,
	createRequestWithBody,
	createRequestWithCookies,
	createRequestWithHeaders,
	createRequestWithParams,
	createStatusChain,
	mockExpress,
	type MockRequest,
	type MockResponse,
	setupExpressMocks,
} from '../express-mocks.ts'

describe('Express Mocks Helper', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('createMockRequest', () => {
		it('should create a mock request with default properties', () => {
			// Act
			const mockRequest = createMockRequest()

			// Assert
			expect(mockRequest).toEqual({
				body: {},
				params: {},
				query: {},
				headers: {},
				cookies: {},
			})
		})

		it('should create a mock request with overrides', () => {
			// Arrange
			const overrides = {
				body: { email: 'test@example.com' },
				params: { id: '123' },
				userId: 'user-123',
			}

			// Act
			const mockRequest = createMockRequest(overrides)

			// Assert
			expect(mockRequest).toEqual({
				body: { email: 'test@example.com' },
				params: { id: '123' },
				query: {},
				headers: {},
				cookies: {},
				userId: 'user-123',
			})
		})

		it('should allow partial overrides', () => {
			// Arrange
			const overrides = {
				body: { name: 'test' },
			}

			// Act
			const mockRequest = createMockRequest(overrides)

			// Assert
			expect(mockRequest.body).toEqual({ name: 'test' })
			expect(mockRequest.params).toEqual({})
			expect(mockRequest.query).toEqual({})
		})
	})

	describe('createMockResponse', () => {
		it('should create a mock response with all required methods', () => {
			// Act
			const mockResponse = createMockResponse()

			// Assert
			expect(mockResponse.status).toBeDefined()
			expect(mockResponse.json).toBeDefined()
			expect(mockResponse.send).toBeDefined()
			expect(mockResponse.cookie).toBeDefined()
			expect(mockResponse.clearCookie).toBeDefined()
			expect(mockResponse.redirect).toBeDefined()
			expect(mockResponse.end).toBeDefined()
		})

		it('should support status().json() chaining', () => {
			// Arrange
			const mockResponse = createMockResponse()

			// Act
			const result = mockResponse.status(200) as ChainedResult

			// Assert
			expect(result).toHaveProperty('json')
			expect(result).toHaveProperty('send')
			expect(result).toHaveProperty('end')
		})

		it('should support cookie chaining', () => {
			// Arrange
			const mockResponse = createMockResponse()

			// Act
			const result = mockResponse.cookie('test', 'value') as MockResponse

			// Assert
			expect(result).toBe(mockResponse)
		})

		it('should support clearCookie chaining', () => {
			// Arrange
			const mockResponse = createMockResponse()

			// Act
			const result = mockResponse.clearCookie('test') as MockResponse

			// Assert
			expect(result).toBe(mockResponse)
		})

		it('should track method calls correctly', () => {
			// Arrange
			const mockResponse = createMockResponse()

			// Act
			mockResponse.status(201)
			const chainedResult = mockResponse.status(201) as ChainedResult
			chainedResult.json({ message: 'success' })

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(201)
			expect(mockResponse.status).toHaveBeenCalledTimes(2)
			expect(chainedResult.json).toHaveBeenCalledWith({ message: 'success' })
		})

		it('should support properly typed status chaining with helper', () => {
			// Arrange
			const mockResponse = createMockResponse()

			// Act - Using the helper to avoid 'any' type issues
			const result = createStatusChain(mockResponse, 200)

			// Assert - Now result is properly typed
			expect(result).toHaveProperty('json')
			expect(result).toHaveProperty('send')
			expect(result).toHaveProperty('end')
			expect(mockResponse.status).toHaveBeenCalledWith(200)

			// This should work without any type errors
			result.json({ data: 'test' })
			expect(result.json).toHaveBeenCalledWith({ data: 'test' })
		})
	})

	describe('createMockNext', () => {
		it('should create a mock next function', () => {
			// Act
			const mockNext = createMockNext()

			// Assert
			expect(mockNext).toBeTypeOf('function')
			expect(vi.isMockFunction(mockNext)).toBe(true)
		})

		it('should track calls to next function', () => {
			// Arrange
			const mockNext = createMockNext()

			// Act
			mockNext()
			mockNext(new Error('test error'))

			// Assert
			expect(mockNext).toHaveBeenCalledTimes(2)
			expect(mockNext).toHaveBeenNthCalledWith(1)
			expect(mockNext).toHaveBeenNthCalledWith(2, new Error('test error'))
		})
	})

	describe('createExpressMocks', () => {
		it('should create a complete set of Express mocks', () => {
			// Act
			const mocks = createExpressMocks()

			// Assert
			expect(mocks).toHaveProperty('req')
			expect(mocks).toHaveProperty('res')
			expect(mocks).toHaveProperty('next')
			expect(mocks.req).toEqual({
				body: {},
				params: {},
				query: {},
				headers: {},
				cookies: {},
			})
			expect(mocks.res.status).toBeDefined()
			expect(vi.isMockFunction(mocks.next)).toBe(true)
		})

		it('should accept request overrides', () => {
			// Arrange
			const requestOverrides = {
				body: { test: 'data' },
				userId: 'user-456',
			}

			// Act
			const mocks = createExpressMocks(requestOverrides)

			// Assert
			expect(mocks.req.body).toEqual({ test: 'data' })
			expect(mocks.req.userId).toBe('user-456')
		})
	})

	describe('setupExpressMocks', () => {
		it('should clear all mocks and return fresh Express mocks', () => {
			// Arrange
			const firstMocks = createExpressMocks()
			firstMocks.next()
			firstMocks.res.status(200)

			// Act
			const freshMocks = setupExpressMocks()

			// Assert
			expect(freshMocks.next).not.toHaveBeenCalled()
			expect(freshMocks.res.status).not.toHaveBeenCalled()
		})

		it('should accept request overrides', () => {
			// Arrange
			const requestOverrides = {
				params: { id: '789' },
			}

			// Act
			const mocks = setupExpressMocks(requestOverrides)

			// Assert
			expect(mocks.req.params).toEqual({ id: '789' })
		})
	})

	describe('Helper Functions', () => {
		describe('createAuthenticatedRequest', () => {
			it('should create a request with userId set', () => {
				// Act
				const request = createAuthenticatedRequest('user-123')

				// Assert
				expect(request.userId).toBe('user-123')
				expect(request.body).toEqual({})
				expect(request.params).toEqual({})
			})

			it('should accept additional overrides', () => {
				// Act
				const request = createAuthenticatedRequest('user-123', {
					body: { data: 'test' },
				})

				// Assert
				expect(request.userId).toBe('user-123')
				expect(request.body).toEqual({ data: 'test' })
			})
		})

		describe('createRequestWithBody', () => {
			it('should create a request with body set', () => {
				// Arrange
				const body = { email: 'test@example.com', password: 'password' }

				// Act
				const request = createRequestWithBody(body)

				// Assert
				expect(request.body).toEqual(body)
			})
		})

		describe('createRequestWithParams', () => {
			it('should create a request with params set', () => {
				// Arrange
				const params = { id: '123', type: 'user' }

				// Act
				const request = createRequestWithParams(params)

				// Assert
				expect(request.params).toEqual(params)
			})
		})

		describe('createRequestWithHeaders', () => {
			it('should create a request with headers set', () => {
				// Arrange
				const headers = {
					'x-api-key': 'test-key',
					'content-type': 'application/json',
				}

				// Act
				const request = createRequestWithHeaders(headers)

				// Assert
				expect(request.headers).toEqual(headers)
			})
		})

		describe('createRequestWithCookies', () => {
			it('should create a request with cookies set', () => {
				// Arrange
				const cookies = { 'session-id': 'abc123', 'user-pref': 'dark-mode' }

				// Act
				const request = createRequestWithCookies(cookies)

				// Assert
				expect(request.cookies).toEqual(cookies)
			})
		})
	})

	describe('mockExpress unified export', () => {
		it('should export all factory functions', () => {
			// Assert
			expect(mockExpress.createRequest).toBe(createMockRequest)
			expect(mockExpress.createResponse).toBe(createMockResponse)
			expect(mockExpress.createNext).toBe(createMockNext)
			expect(mockExpress.createMocks).toBe(createExpressMocks)
			expect(mockExpress.setup).toBe(setupExpressMocks)
		})

		it('should export all helper functions', () => {
			// Assert
			expect(mockExpress.createAuthenticatedRequest).toBe(
				createAuthenticatedRequest,
			)
			expect(mockExpress.createRequestWithBody).toBe(createRequestWithBody)
			expect(mockExpress.createRequestWithParams).toBe(createRequestWithParams)
			expect(mockExpress.createRequestWithHeaders).toBe(
				createRequestWithHeaders,
			)
			expect(mockExpress.createRequestWithCookies).toBe(
				createRequestWithCookies,
			)
		})
	})

	describe('TypeScript Type Safety', () => {
		it('should work with Express types', () => {
			// Arrange
			const mockRequest = createMockRequest() as Request
			const mockResponse = createMockResponse() as Response
			const mockNext = createMockNext()

			// Act & Assert - This test passes if TypeScript compilation succeeds
			expect(mockRequest).toBeDefined()
			expect(mockResponse).toBeDefined()
			expect(mockNext).toBeDefined()
		})

		it('should support MockRequest and MockResponse types', () => {
			// Arrange
			const mockRequest: MockRequest = createMockRequest()
			const mockResponse: MockResponse = createMockResponse()

			// Act & Assert - This test passes if TypeScript compilation succeeds
			expect(mockRequest).toBeDefined()
			expect(mockResponse).toBeDefined()
		})
	})
})

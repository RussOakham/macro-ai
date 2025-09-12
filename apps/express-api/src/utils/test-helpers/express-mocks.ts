import type { NextFunction, Request, Response } from 'express'

import { vi } from 'vitest'

/**
 * Type for the complete set of Express mocks
 */
interface ExpressMocks {
	req: Partial<Request>
	res: Partial<Response>
	next: NextFunction
}

/**
 * Factory function to create a mock Express Request object
 * @param overrides - Properties to override in the mock request
 * @returns Mock Request object with proper Express typing
 */
export const createMockRequest = (
	overrides: Partial<Request> = {},
): Partial<Request> => {
	return {
		body: {},
		params: {},
		query: {},
		headers: {},
		cookies: {},
		method: 'GET',
		ip: '127.0.0.1',
		path: '/',
		url: '/',
		get: vi.fn(),
		...overrides,
	}
}

/**
 * Factory function to create a mock Express Response object
 * @returns Mock Response object with proper Express typing
 */
export const createMockResponse = (): Partial<Response> => {
	const json = vi.fn()
	const send = vi.fn()
	const end = vi.fn()
	const headers: Record<string, string> = {}

	return {
		status: vi.fn().mockReturnValue({ json, send, end }),
		json,
		send,
		cookie: vi.fn().mockReturnThis(),
		clearCookie: vi.fn().mockReturnThis(),
		redirect: vi.fn(),
		end,
		setHeader: vi.fn((name: string, value: string) => {
			headers[name.toLowerCase()] = value
		}),
		removeHeader: vi.fn((name: string) => {
			delete headers[name.toLowerCase()]
		}),
		getHeader: vi.fn((name: string) => headers[name.toLowerCase()]),
		getHeaders: vi.fn(() => headers),
		hasHeader: vi.fn((name: string) => name.toLowerCase() in headers),
	}
}

/**
 * Factory function to create a mock Express NextFunction
 * @returns Mock NextFunction as a Vitest mock function
 */
export const createMockNext = (): NextFunction => vi.fn()

/**
 * Factory function to create a complete set of Express mocks
 * @param requestOverrides - Properties to override in the mock request
 * @returns Object containing req, res, and next mocks
 */
export const createExpressMocks = (
	requestOverrides: Partial<Request> = {},
): ExpressMocks => ({
	req: createMockRequest(requestOverrides),
	res: createMockResponse(),
	next: createMockNext(),
})

/**
 * Setup function for beforeEach hooks - clears all mocks and returns fresh Express mocks
 * @param requestOverrides - Properties to override in the mock request
 * @returns Fresh Express mocks with cleared state
 */
export const setupExpressMocks = (requestOverrides: Partial<Request> = {}) => {
	vi.clearAllMocks()
	return createExpressMocks(requestOverrides)
}

/**
 * Helper function to create a mock request with authentication
 * @param userId - User ID to set in the request
 * @param overrides - Additional properties to override
 * @returns Mock request with userId set
 */
export const createAuthenticatedRequest = (
	userId: string,
	overrides: Partial<Request> = {},
): Partial<Request> => {
	return createMockRequest({ ...overrides, userId })
}

/**
 * Helper function to create a mock request with specific body data
 * @param body - Request body data
 * @param overrides - Additional properties to override
 * @returns Mock request with body set
 */
export const createRequestWithBody = (
	body: unknown,
	overrides: Partial<Request> = {},
): Partial<Request> => {
	return createMockRequest({ body, ...overrides })
}

/**
 * Helper function to create a mock request with specific params
 * @param params - Request params
 * @param overrides - Additional properties to override
 * @returns Mock request with params set
 */
export const createRequestWithParams = (
	params: Record<string, string>,
	overrides: Partial<Request> = {},
): Partial<Request> => {
	return createMockRequest({ params, ...overrides })
}

/**
 * Helper function to create a mock request with specific headers
 * @param headers - Request headers
 * @param overrides - Additional properties to override
 * @returns Mock request with headers set
 */
export const createRequestWithHeaders = (
	headers: Record<string, string>,
	overrides: Partial<Request> = {},
): Partial<Request> => {
	return createMockRequest({ headers, ...overrides })
}

/**
 * Helper function to create a mock request with cookies
 * @param cookies - Request cookies
 * @param overrides - Additional properties to override
 * @returns Mock request with cookies set
 */
export const createRequestWithCookies = (
	cookies: Record<string, string>,
	overrides: Partial<Request> = {},
): Partial<Request> => {
	return createMockRequest({ cookies, ...overrides })
}

/**
 * Simple mock request factory
 * @param data - Optional request data to override
 * @returns Mock Request object
 */
export const mockRequest = (data?: Partial<Request>): Partial<Request> => {
	return createMockRequest(data)
}

/**
 * Simple mock response factory
 * @returns Mock Response object with proper typing
 */
export const mockResponse = (): Partial<Response> => {
	return createMockResponse()
}

/**
 * Simple mock next function factory
 * @returns Mock NextFunction
 */
export const mockNext = (): NextFunction => {
	return vi.fn()
}

/**
 * Unified export object with all Express mock utilities
 */
export const mockExpress = {
	// Core factory functions
	createRequest: createMockRequest,
	createResponse: createMockResponse,
	createNext: createMockNext,
	createMocks: createExpressMocks,
	setup: setupExpressMocks,

	// Helper functions for common scenarios
	createAuthenticatedRequest,
	createRequestWithBody,
	createRequestWithParams,
	createRequestWithHeaders,
	createRequestWithCookies,

	// Simple mock factories
	mockRequest,
	mockResponse,
	mockNext,
}

// Export types for use in test files
export type { ExpressMocks }

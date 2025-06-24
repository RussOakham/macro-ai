import type { NextFunction, Request, Response } from 'express'
import { vi } from 'vitest'

/**
 * Mock interfaces for Express objects with proper typing
 */

// Mock Response interface with chainable methods
interface MockResponse extends Partial<Response> {
	status: ReturnType<typeof vi.fn>
	json: ReturnType<typeof vi.fn>
	send: ReturnType<typeof vi.fn>
	cookie: ReturnType<typeof vi.fn>
	clearCookie: ReturnType<typeof vi.fn>
	redirect: ReturnType<typeof vi.fn>
	end: ReturnType<typeof vi.fn>
}

// Mock Request interface with common properties
interface MockRequest extends Partial<Request> {
	body?: unknown
	params?: Record<string, string>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	query?: Record<string, any>
	headers?: Record<string, string | string[] | undefined>
	cookies?: Record<string, string>
	userId?: string
	ip?: string
	path?: string
}

// Generic Mock Request interface for typed body requests
interface MockRequestWithBody<T>
	extends Partial<Request<Record<string, string>, unknown, T>> {
	body?: T
	params?: Record<string, string>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	query?: Record<string, any>
	headers?: Record<string, string | string[] | undefined>
	cookies?: Record<string, string>
	userId?: string
	ip?: string
	path?: string
}

// Interface for the chained result object returned by status()
interface ChainedResult {
	json: ReturnType<typeof vi.fn>
	send: ReturnType<typeof vi.fn>
	end: ReturnType<typeof vi.fn>
}

/**
 * Factory function to create a mock Express Request object
 * @param overrides - Properties to override in the mock request
 * @returns Mock Request object with default properties
 */
export const createMockRequest = (
	overrides: Partial<MockRequest> = {},
): MockRequest => ({
	body: {},
	params: {},
	query: {},
	headers: {},
	cookies: {},
	...overrides,
})

/**
 * Simple mock request factory (similar to your suggested pattern)
 * @param data - Optional request data to override
 * @returns Mock Request object
 */
export const mockRequest = <T = unknown>(
	data?: Partial<Request<Record<string, string>, unknown, T>>,
): Request<Record<string, string>, unknown, T> => {
	return {
		body: {} as T,
		params: {},
		query: {},
		headers: {},
		cookies: {},
		...data,
	} as Request<Record<string, string>, unknown, T>
}

/**
 * Simple mock response factory (similar to your suggested pattern)
 * @returns Mock Response object with proper typing for chaining
 */
export const mockResponse = (): Response => {
	const json = vi.fn()
	const send = vi.fn()
	const end = vi.fn()

	const statusChain = {
		json,
		send,
		end,
	}

	const res = {
		status: vi.fn().mockReturnValue(statusChain),
		json,
		send,
		end,
	}
	return res as unknown as Response
}

/**
 * Simple mock next function factory (similar to your suggested pattern)
 * @returns Mock NextFunction
 */
export const mockNext = (): NextFunction => {
	return vi.fn()
}

/**
 * Helper function to create a properly typed status chain result
 * This solves the 'any' type issue when calling mockResponse.status(200)
 *
 * @example
 * ```typescript
 * const mockResponse = createMockResponse()
 *
 * // Instead of this (which gives 'any' type):
 * // const result = mockResponse.status(200)
 *
 * // Use this for proper typing:
 * const result = createStatusChain(mockResponse, 200)
 * result.json({ data: 'test' }) // Now properly typed!
 * ```
 *
 * @param mockResponse - The mock response object
 * @param statusCode - The status code to set
 * @returns Properly typed object with json, send, and end methods
 */
export const createStatusChain = (
	mockResponse: MockResponse,
	statusCode: number,
) => {
	const result = mockResponse.status(statusCode) as {
		json: ReturnType<typeof vi.fn>
		send: ReturnType<typeof vi.fn>
		end: ReturnType<typeof vi.fn>
	}
	return result
}

/**
 * Factory function to create a mock Express Response object with chainable methods
 * @returns Mock Response object with properly chained status().json() pattern
 */
export const createMockResponse = (): MockResponse => {
	const json = vi.fn()
	const send = vi.fn()
	const cookie = vi.fn().mockReturnThis()
	const clearCookie = vi.fn().mockReturnThis()
	const redirect = vi.fn()
	const end = vi.fn()

	// Create status function that returns an object with json and send methods
	const status = vi.fn().mockReturnValue({
		json,
		send,
		end,
	})

	return {
		status,
		json,
		send,
		cookie,
		clearCookie,
		redirect,
		end,
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
	requestOverrides: Partial<MockRequest> = {},
) => ({
	req: createMockRequest(requestOverrides),
	res: createMockResponse(),
	next: createMockNext(),
})

/**
 * Setup function for beforeEach hooks - clears all mocks and returns fresh Express mocks
 * @param requestOverrides - Properties to override in the mock request
 * @returns Fresh Express mocks with cleared state
 */
export const setupExpressMocks = (
	requestOverrides: Partial<MockRequest> = {},
) => {
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
	overrides: Partial<MockRequest> = {},
): MockRequest =>
	createMockRequest({
		userId,
		...overrides,
	})

/**
 * Helper function to create a mock request with specific body data
 * @param body - Request body data
 * @param overrides - Additional properties to override
 * @returns Mock request with body set
 */
export const createRequestWithBody = <T>(
	body: T,
	overrides: Partial<MockRequestWithBody<T>> = {},
): MockRequestWithBody<T> => ({
	body,
	params: {},
	query: {},
	headers: {},
	cookies: {},
	...overrides,
})

/**
 * Helper function to create a mock request with specific params
 * @param params - Request params
 * @param overrides - Additional properties to override
 * @returns Mock request with params set
 */
export const createRequestWithParams = (
	params: Record<string, string>,
	overrides: Partial<MockRequest> = {},
): MockRequest =>
	createMockRequest({
		params,
		...overrides,
	})

/**
 * Helper function to create a mock request with specific headers
 * @param headers - Request headers
 * @param overrides - Additional properties to override
 * @returns Mock request with headers set
 */
export const createRequestWithHeaders = (
	headers: Record<string, string>,
	overrides: Partial<MockRequest> = {},
): MockRequest =>
	createMockRequest({
		headers,
		...overrides,
	})

/**
 * Helper function to create a mock request with cookies
 * @param cookies - Request cookies
 * @param overrides - Additional properties to override
 * @returns Mock request with cookies set
 */
export const createRequestWithCookies = (
	cookies: Record<string, string>,
	overrides: Partial<MockRequest> = {},
): MockRequest =>
	createMockRequest({
		cookies,
		...overrides,
	})

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

	// Utility functions for better typing
	createStatusChain,

	// Simple mock factories (alternative pattern)
	mockRequest,
	mockResponse,
	mockNext,
}

// Export types for use in test files
export type { ChainedResult, MockRequest, MockRequestWithBody, MockResponse }

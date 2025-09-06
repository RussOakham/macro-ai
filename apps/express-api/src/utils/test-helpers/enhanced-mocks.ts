import type { NextFunction, Request, Response } from 'express'

import {
	createMocks,
	createRequest,
	createResponse,
	MockRequest,
	MockResponse,
} from 'node-mocks-http'
import { vi } from 'vitest'
import { DeepMockProxy, mockDeep } from 'vitest-mock-extended'

import type { cognitoService } from '../../features/auth/auth.services.ts'
import type { chatService } from '../../features/chat/chat.service.ts'
import type { userService } from '../../features/user/user.services.ts'

/**
 * Enhanced mock utilities using vitest-mock-extended
 * These provide better TypeScript support and automatic mock generation
 */

// Re-export types from node-mocks-http for convenience
export type { MockRequest, MockResponse } from 'node-mocks-http'

// Enhanced User Service Mock
export type MockUserService = DeepMockProxy<typeof userService>

const createMockUserService = (): MockUserService => {
	return mockDeep<typeof userService>()
}

// Enhanced Chat Service Mock
export type MockChatService = DeepMockProxy<typeof chatService>

const createMockChatService = (): MockChatService => {
	return mockDeep<typeof chatService>()
}

// Enhanced Auth Service Mock
type MockAuthService = DeepMockProxy<typeof cognitoService>

const createMockAuthService = (): MockAuthService => {
	return mockDeep<typeof cognitoService>()
}

/**
 * Mock factory for creating multiple service mocks at once
 */
const createServiceMocks = () => {
	const userService = createMockUserService()
	const chatService = createMockChatService()
	const authService = createMockAuthService()

	return {
		userService,
		chatService,
		authService,
	}
}

/**
 * Reset all mocks - useful in beforeEach
 */
const resetAllMocks = () => {
	vi.clearAllMocks()
}

/**
 * Enhanced mock factory with automatic type inference
 * Usage: const mock = createEnhancedMock<typeof someService>()
 */
const createEnhancedMock = <T extends object>() => {
	return mockDeep<T>()
}

/**
 * Mock factory for Express Request/Response objects using node-mocks-http
 * This provides realistic Express object behavior with proper chaining
 */
const createMockExpressObjects = (
	reqOpts?: Parameters<typeof createRequest>[0],
	resOpts?: Parameters<typeof createResponse>[0],
): {
	req: MockRequest<Request>
	res: MockResponse<Response>
	next: NextFunction
} => {
	const { req, res } = createMocks(reqOpts, resOpts)
	const next = vi.fn() as NextFunction

	// Ensure response methods are spies that also set the data
	res.status = vi.fn().mockReturnValue(res)
	res.json = vi.fn().mockImplementation((data) => {
		// Set the JSON data so _getJSONData() can retrieve it
		// eslint-disable-next-line no-underscore-dangle
		res._getJSONData = vi.fn().mockReturnValue(data)
		return res
	})
	res.send = vi.fn().mockReturnValue(res)
	res.cookie = vi.fn().mockReturnValue(res)
	res.clearCookie = vi.fn().mockReturnValue(res)
	res.end = vi.fn().mockReturnValue(res)

	return { req, res, next }
}

/**
 * Create a mock Express Request object
 */
export const createMockRequest = (
	opts?: Parameters<typeof createRequest>[0],
): MockRequest<Request> => {
	return createRequest(opts)
}

/**
 * Create a mock Express Response object
 */
export const createMockResponse = (
	opts?: Parameters<typeof createResponse>[0],
): MockResponse<Response> => {
	return createResponse(opts)
}

/**
 * Enhanced mock utilities for common testing patterns
 */
const mockUtils = {
	/**
	 * Create a mock that resolves with the given value
	 */
	createResolvingMock: (value: unknown) => {
		const mock = vi.fn()
		mock.mockResolvedValue(value)
		return mock
	},

	/**
	 * Create a mock that rejects with the given error
	 */
	createRejectingMock: (error: Error) => {
		const mock = vi.fn()
		mock.mockRejectedValue(error)
		return mock
	},

	/**
	 * Create a mock that returns the given value
	 */
	createReturningMock: (value: unknown) => {
		const mock = vi.fn()
		mock.mockReturnValue(value)
		return mock
	},

	/**
	 * Create a mock that throws the given error
	 */
	createThrowingMock: (error: Error) => {
		const mock = vi.fn()
		mock.mockImplementation(() => {
			throw error
		})
		return mock
	},
}

/**
 * Named exports for better tree shaking and explicit imports
 */
export {
	createMockUserService,
	createMockChatService,
	createMockAuthService,
	createServiceMocks,
	createEnhancedMock,
	createMockExpressObjects,
	mockUtils,
	resetAllMocks,
}

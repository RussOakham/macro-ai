import type { NextFunction } from 'express'
import { createMocks, createRequest, createResponse } from 'node-mocks-http'
import { vi } from 'vitest'
import { DeepMockProxy, mock, mockDeep } from 'vitest-mock-extended'

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

export const createMockUserService = (): MockUserService => {
	return mockDeep<typeof userService>()
}

// Enhanced Chat Service Mock
export type MockChatService = DeepMockProxy<typeof chatService>

export const createMockChatService = (): MockChatService => {
	return mockDeep<typeof chatService>()
}

// Enhanced Auth Service Mock
export type MockAuthService = DeepMockProxy<typeof cognitoService>

export const createMockAuthService = (): MockAuthService => {
	return mockDeep<typeof cognitoService>()
}

/**
 * Mock factory for creating multiple service mocks at once
 */
export const createServiceMocks = () => {
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
export const resetAllMocks = () => {
	vi.clearAllMocks()
}

/**
 * Enhanced mock factory with automatic type inference
 * Usage: const mock = createEnhancedMock<typeof someService>()
 */
export const createEnhancedMock = <T extends object>() => {
	return mockDeep<T>()
}

/**
 * Mock factory for Express Request/Response objects using node-mocks-http
 * This provides realistic Express object behavior with proper chaining
 */
export const createMockExpressObjects = (
	reqOpts?: Parameters<typeof createRequest>[0],
	resOpts?: Parameters<typeof createResponse>[0],
) => {
	const { req, res } = createMocks(reqOpts, resOpts)
	const next = mock<NextFunction>()

	return { req, res, next }
}

/**
 * Create a mock Express Request object
 */
export const createMockRequest = (
	opts?: Parameters<typeof createRequest>[0],
) => {
	return createRequest(opts)
}

/**
 * Create a mock Express Response object
 */
export const createMockResponse = (
	opts?: Parameters<typeof createResponse>[0],
) => {
	return createResponse(opts)
}

/**
 * Enhanced mock utilities for common testing patterns
 */
export const mockUtils = {
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
 * Default export for easy importing
 */
export default {
	createMockUserService,
	createMockChatService,
	createMockAuthService,
	createServiceMocks,
	createEnhancedMock,
	createMockExpressObjects,
	mockUtils,
	resetAllMocks,
}

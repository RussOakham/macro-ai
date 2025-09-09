/**
 * Test Helpers Index
 *
 * Centralized export of all testing utilities and helpers for the Express API.
 * This module provides a single entry point for importing testing utilities,
 * making it easy to use advanced testing capabilities across the application.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Base interface for all mock data objects
 */
export interface MockDataBase {
	id: string
	createdAt: Date
	updatedAt: Date
}

/**
 * User mock data interface
 */
export interface UserMockData extends MockDataBase {
	email: string
	firstName: string
	lastName: string
	emailVerified: boolean
	lastLogin: Date | null
}

/**
 * Chat mock data interface
 */
export interface ChatMockData extends MockDataBase {
	title: string
	userId: string
}

/**
 * Message mock data interface
 */
export interface MessageMockData extends MockDataBase {
	content: string
	role: 'user' | 'assistant' | 'system'
	chatId: string
}

/**
 * Generic API response interface
 */
export interface ApiResponseMock<T = unknown> {
	success: boolean
	data: T
	message?: string
	timestamp: string
}

/**
 * Error response interface
 */
export interface ErrorResponseMock {
	success: false
	error: {
		message: string
		code: string
		status: number
		timestamp: string
	}
}

/**
 * Paginated response interface
 */
export interface PaginatedResponseMock<T = unknown> {
	success: boolean
	data: T[]
	pagination: {
		page: number
		limit: number
		total: number
		totalPages: number
		hasNext: boolean
		hasPrevious: boolean
	}
	timestamp: string
}

/**
 * Mock function type for test utilities
 */
export type MockFunction<T extends (...args: unknown[]) => unknown> = T

/**
 * Test condition function type
 */
export type TestCondition = () => boolean

/**
 * Retry function type
 */
export type RetryFunction<T> = () => Promise<T>

// ============================================================================
// Core Testing Utilities
// ============================================================================

export {
	ContractTester as AdvancedContractTester,
	type ContractDefinition,
	type ErrorSimulationOptions,
	ErrorSimulator,
	MockDataFactory,
	PerformanceTester,
	type PerformanceTestOptions,
	type PerformanceTestResult,
	TimeController,
	type TimeControlOptions,
	TransactionTester,
	type TransactionTestOptions,
} from './advanced-mocking.ts'
export {
	cleanupGlobalResources,
	createPerformanceTester,
	type DatabaseIntegrationTestConfig,
	type DatabaseTestContext,
	seedDatabaseWithTestData,
	setupDatabaseIntegration,
	type TestDataSeeds,
} from './database-integration.ts'
export {
	ContractBuilder,
	ContractDataGenerator,
	ContractExamples,
	type ContractInteraction,
	type ContractSpec,
	InteractionBuilder,
	MockPact,
	ContractTester as PactContractTester,
} from './pact-contract-testing.ts'

// ============================================================================
// Service Mocks
// ============================================================================

export { createChatServiceMock } from './chat-service.mock.ts'
export { createCognitoServiceMock } from './cognito-service.mock.ts'
export { createMockExpressObjects } from './enhanced-mocks.ts'
export {
	createErrorAssertion,
	mockErrorHandling,
	withAsyncErrorBoundary,
	withErrorBoundary,
} from './error-handling.mock.ts'
export { mockLogger } from './logger.mock.ts'
export { createUserServiceMock } from './user-service.mock.ts'

// ============================================================================
// Re-export Common Testing Dependencies
// ============================================================================

export { faker } from '@faker-js/faker'
export { and, eq, inArray, isNotNull, isNull, not, or } from 'drizzle-orm'
export { type MockedFunction, vi } from 'vitest'

// Import for internal use
import { vi } from 'vitest'

import type { DatabaseTestContext } from './database-integration.ts'

import {
	ContractTester as AdvancedContractTester,
	ErrorSimulator,
	MockDataFactory,
	PerformanceTester,
	TimeController,
} from './advanced-mocking.ts'
import {
	ChatContractData,
	ContractDataGenerator,
	MessageContractData,
	UserContractData,
} from './pact-contract-testing.ts'

// ============================================================================
// Testing Configuration
// ============================================================================

export const TEST_CONFIG = {
	/** Default database test configuration */
	database: {
		container: {
			image: 'postgres:15-alpine',
			port: 5432,
			timeout: 30000,
		},
		connection: {
			host: 'localhost',
			port: 5432,
			database: 'test_db',
			username: 'test_user',
			password: 'test_password',
		},
		migration: {
			timeout: 10000,
			retries: 3,
		},
	},

	/** Default time control configuration */
	timeControl: {
		useFakeTimers: true,
		autoAdvance: false,
		advanceInterval: 1000,
	},

	/** Default error simulation configuration */
	errorSimulation: {
		probability: 0.1,
		errorTypes: ['network', 'database', 'validation', 'timeout', 'permission'],
		logErrors: false,
	},

	/** Default performance testing configuration */
	performance: {
		iterations: 100,
		warmup: 10,
		measureMemory: false,
	},

	/** Default contract testing configuration */
	contract: {
		host: 'localhost',
		port: 1234,
		ssl: false,
		logLevel: 'info' as const,
	},
} as const

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a complete test setup with all utilities configured
 */
export const createTestSetup = (config: Partial<typeof TEST_CONFIG> = {}) => {
	const mergedConfig = { ...TEST_CONFIG, ...config }

	return {
		config: mergedConfig,
		timeController: new TimeController(mergedConfig.timeControl),
		errorSimulator: new ErrorSimulator({
			probability: mergedConfig.errorSimulation.probability,
			errorTypes: [...mergedConfig.errorSimulation.errorTypes],
			logErrors: mergedConfig.errorSimulation.logErrors,
		}),
		performanceTester: new PerformanceTester(),
		contractTester: new AdvancedContractTester(),
	}
}

/**
 * Create mock data for common entities
 */
export const createMockData = {
	user: (overrides: Partial<UserMockData> = {}) =>
		MockDataFactory.createUser(overrides),
	chat: (overrides: Partial<ChatMockData> = {}) =>
		MockDataFactory.createChat(overrides),
	message: (overrides: Partial<MessageMockData> = {}) =>
		MockDataFactory.createMessage(overrides),

	apiResponse: <T>(data: T, overrides: Partial<ApiResponseMock<T>> = {}) =>
		MockDataFactory.createApiResponse(data, overrides),
	errorResponse: (message: string, code = 'ERROR', status = 500) =>
		MockDataFactory.createErrorResponse(message, code, status),
	array: <T>(factory: () => T, count: number, overrides: Partial<T> = {}) =>
		MockDataFactory.createArray(factory, count, overrides),
}

/**
 * Create contract data for testing
 */
export const createContractData = {
	user: (overrides: Partial<UserContractData> = {}): UserMockData =>
		ContractDataGenerator.generateUser(overrides) as unknown as UserMockData,
	chat: (overrides: Partial<ChatContractData> = {}): ChatMockData =>
		ContractDataGenerator.generateChat(overrides) as unknown as ChatMockData,
	message: (overrides: Partial<MessageContractData> = {}): MessageMockData =>
		ContractDataGenerator.generateMessage(
			overrides,
		) as unknown as MessageMockData,
	errorResponse: (
		message = 'An error occurred',
		code = 'ERROR',
		status = 500,
	): ErrorResponseMock =>
		ContractDataGenerator.generateErrorResponse(
			message,
			code,
			status,
		) as unknown as ErrorResponseMock,
	paginatedResponse: <T>(
		data: T[],
		page = 1,
		limit = 10,
		total = data.length,
	): PaginatedResponseMock<T> =>
		ContractDataGenerator.generatePaginatedResponse(
			data,
			page,
			limit,
			total,
		) as PaginatedResponseMock<T>,
}

/**
 * Common test patterns and utilities
 */
export const testUtils = {
	/**
	 * Wait for a specified amount of time
	 */
	wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

	/**
	 * Create a promise that resolves after a condition is met
	 */
	waitFor: async (condition: TestCondition, timeout = 5000, interval = 100) => {
		const start = Date.now()
		while (Date.now() - start < timeout) {
			if (condition()) return
			await new Promise((resolve) => setTimeout(resolve, interval))
		}
		throw new Error(`Condition not met within ${String(timeout)}ms`)
	},

	/**
	 * Retry a function until it succeeds or max attempts are reached
	 */
	retry: async <T>(
		fn: RetryFunction<T>,
		maxAttempts = 3,
		delay = 1000,
	): Promise<T> => {
		let lastError: Error | undefined
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return await fn()
			} catch (error) {
				lastError = error as Error
				if (attempt < maxAttempts) {
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}
		throw lastError ?? new Error('Retry failed')
	},

	/**
	 * Create a mock function with predefined behavior
	 */
	createMock: <T extends (...args: unknown[]) => unknown>(
		implementation?: T,
	) => {
		return vi.fn(implementation)
	},

	/**
	 * Create a spy on an object method
	 */
	spyOn: <T extends object>(object: T, method: keyof T) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return vi.spyOn(object, method as any)
	},

	/**
	 * Mock a module
	 */
	mockModule: (
		modulePath: string,
		implementation: () => Record<string, unknown>,
	) => {
		vi.mock(modulePath, implementation)
	},
}

/**
 * Common test assertions
 */
export const testAssertions = {
	/**
	 * Assert that a value is a valid UUID
	 */
	isValidUuid: (value: string) => {
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		return uuidRegex.test(value)
	},

	/**
	 * Assert that a value is a valid email
	 */
	isValidEmail: (value: string) => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		return emailRegex.test(value)
	},

	/**
	 * Assert that a value is a valid ISO date string
	 */
	isValidIsoDate: (value: string) => {
		const date = new Date(value)
		return !isNaN(date.getTime()) && date.toISOString() === value
	},

	/**
	 * Assert that an object has all required properties
	 */
	hasRequiredProperties: (
		obj: Record<string, unknown>,
		requiredProps: string[],
	) => {
		return requiredProps.every((prop) =>
			Object.prototype.hasOwnProperty.call(obj, prop),
		)
	},

	/**
	 * Assert that an array contains only unique values
	 */
	hasUniqueValues: (arr: unknown[]) => {
		return arr.length === new Set(arr).size
	},
}

// ============================================================================
// Additional Type Definitions
// ============================================================================

export type TestSetup = ReturnType<typeof createTestSetup>

export interface TestContext {
	/** Database test context */
	db: DatabaseTestContext
	/** Time controller for time-based testing */
	time: TimeController
	/** Error simulator for error testing */
	errors: ErrorSimulator
	/** Performance tester for performance testing */
	performance: PerformanceTester
	/** Contract tester for contract testing */
	contracts: AdvancedContractTester
}

export interface TestConfig {
	/** Database configuration */
	database?: Partial<typeof TEST_CONFIG.database>
	/** Time control configuration */
	timeControl?: Partial<typeof TEST_CONFIG.timeControl>
	/** Error simulation configuration */
	errorSimulation?: Partial<typeof TEST_CONFIG.errorSimulation>
	/** Performance testing configuration */
	performance?: Partial<typeof TEST_CONFIG.performance>
	/** Contract testing configuration */
	contract?: Partial<typeof TEST_CONFIG.contract>
}

// ============================================================================
// Default Export
// ============================================================================

export default {
	TEST_CONFIG,
	createTestSetup,
	createMockData,
	createContractData,
	testUtils,
	testAssertions,
}

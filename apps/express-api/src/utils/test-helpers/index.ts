/**
 * Test Helpers Index
 * 
 * Centralized export of all testing utilities and helpers for the Express API.
 * This module provides a single entry point for importing testing utilities,
 * making it easy to use advanced testing capabilities across the application.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

// ============================================================================
// Core Testing Utilities
// ============================================================================

export {
	type ContractDefinition,
	ContractTester,
	type ErrorSimulationOptions,
	ErrorSimulator,
	MockDataFactory,
	PerformanceTester,
	type PerformanceTestOptions,
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
	type PerformanceTestResult,
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
// Re-export Common Testing Dependencies
// ============================================================================

export { faker } from '@faker-js/faker'
export { and, eq, inArray, isNotNull,isNull, not, or } from 'drizzle-orm'
export { type MockedFunction,vi } from 'vitest'

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
		errorSimulator: new ErrorSimulator(mergedConfig.errorSimulation),
		performanceTester: new PerformanceTester(),
		contractTester: new ContractTester(),
	}
}

/**
 * Create mock data for common entities
 */
export const createMockData = {
	user: (overrides: Partial<any> = {}) => MockDataFactory.createUser(overrides),
	chat: (overrides: Partial<any> = {}) => MockDataFactory.createChat(overrides),
	message: (overrides: Partial<any> = {}) =>
		MockDataFactory.createMessage(overrides),
	apiResponse: <T>(data: T, overrides: Partial<any> = {}) =>
		MockDataFactory.createApiResponse(data, overrides),
	errorResponse: (
		message: string,
		code = 'ERROR',
		status = 500,
	) => MockDataFactory.createErrorResponse(message, code, status),
	array: <T>(factory: () => T, count: number, overrides: Partial<T> = {}) =>
		MockDataFactory.createArray(factory, count, overrides),
}

/**
 * Create contract data for testing
 */
export const createContractData = {
	user: (overrides: Partial<any> = {}) =>
		ContractDataGenerator.generateUser(overrides),
	chat: (overrides: Partial<any> = {}) =>
		ContractDataGenerator.generateChat(overrides),
	message: (overrides: Partial<any> = {}) =>
		ContractDataGenerator.generateMessage(overrides),
	errorResponse: (
		message = 'An error occurred',
		code = 'ERROR',
		status = 500,
	) => ContractDataGenerator.generateErrorResponse(message, code, status),
	paginatedResponse: <T>(
		data: T[],
		page = 1,
		limit = 10,
		total: number = data.length,
	) =>
		ContractDataGenerator.generatePaginatedResponse(data, page, limit, total),
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
	waitFor: async (
		condition: () => boolean,
		timeout = 5000,
		interval = 100,
	) => {
		const start = Date.now()
		while (Date.now() - start < timeout) {
			if (condition()) return
			await new Promise((resolve) => setTimeout(resolve, interval))
		}
		throw new Error(`Condition not met within ${timeout}ms`)
	},

	/**
	 * Retry a function until it succeeds or max attempts are reached
	 */
	retry: async <T>(
		fn: () => Promise<T>,
		maxAttempts = 3,
		delay = 1000,
	): Promise<T> => {
		let lastError: Error
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
		throw lastError!
	},

	/**
	 * Create a mock function with predefined behavior
	 */
	createMock: <T extends (...args: any[]) => any>(implementation?: T) => {
		return vi.fn(implementation)
	},

	/**
	 * Create a spy on an object method
	 */
	spyOn: <T extends object, K extends keyof T>(object: T, method: K) => {
		return vi.spyOn(object, method)
	},

	/**
	 * Mock a module
	 */
	mockModule: (modulePath: string, implementation: any) => {
		return vi.mock(modulePath, () => implementation)
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
	hasRequiredProperties: (obj: any, requiredProps: string[]) => {
		return requiredProps.every((prop) => obj.hasOwnProperty(prop))
	},

	/**
	 * Assert that an array contains only unique values
	 */
	hasUniqueValues: (arr: any[]) => {
		return arr.length === new Set(arr).size
	},
}

// ============================================================================
// Type Definitions
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
	contracts: ContractTester
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

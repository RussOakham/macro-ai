import type { Logger } from 'pino'
import type { HttpLogger } from 'pino-http'
import { type Mock, vi } from 'vitest'

/**
 * Extract only the logging method names from the pino Logger type
 * This ensures we stay in sync with pino's interface for the methods we actually use
 */
type LoggerMethods = Pick<
	Logger,
	'error' | 'info' | 'warn' | 'debug' | 'fatal' | 'trace' | 'silent'
>

/**
 * Mock interface for the pino logger methods
 * Uses the actual pino Logger method signatures but replaces implementations with mocks
 * Includes the level property which is commonly accessed
 */
type MockLogger = {
	[K in keyof LoggerMethods]: Mock
} & {
	level: string
}

/**
 * Mock interface for the complete pino HTTP logger
 * Extends the actual HttpLogger but with a mocked logger property
 */
type MockPinoHttp = HttpLogger & {
	logger: MockLogger
}

/**
 * Factory function to create a mock logger with all required methods
 * @returns MockLogger with all methods as vi.fn()
 */
export const createLoggerMock = (): MockLogger => ({
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	fatal: vi.fn(),
	trace: vi.fn(),
	silent: vi.fn(),
	level: 'info',
})

/**
 * Factory function to create a complete pino HTTP logger mock
 * Includes both the logger methods and middleware functionality
 * @returns MockPinoHttp with logger methods and middleware function
 */
export const createPinoHttpMock = (): MockPinoHttp => {
	const logger = createLoggerMock()

	// Create a mock function that can be used as Express middleware
	const pinoMiddleware = vi.fn((_req, _res, next?: () => void) => {
		if (next) next()
	})

	// Add the logger property to the middleware function
	Object.assign(pinoMiddleware, { logger })

	return pinoMiddleware as unknown as MockPinoHttp
}

/**
 * Mock factory for vi.mock() calls
 * Creates the complete module mock structure expected by the logger module
 * @returns Object with pino and configureLogger mocks
 */
export const createLoggerModuleMock = () => ({
	logger: createLoggerMock(),
	pino: createPinoHttpMock(),
	configureLogger: vi.fn(),
})

/**
 * Setup function for beforeEach hooks
 * Clears all mocks and returns a fresh logger mock
 * @returns Fresh MockLogger instance
 */
export const setupLoggerMock = (): MockLogger => {
	vi.clearAllMocks()
	return createLoggerMock()
}

/**
 * Setup function for complete pino HTTP mock in beforeEach hooks
 * Clears all mocks and returns a fresh pino HTTP mock
 * @returns Fresh MockPinoHttp instance
 */
export const setupPinoHttpMock = (): MockPinoHttp => {
	vi.clearAllMocks()
	return createPinoHttpMock()
}

/**
 * Helper function to create mock logger with pre-configured behavior
 * Useful for testing specific logging scenarios
 * @param behavior Optional object to configure specific method behaviors
 * @returns MockLogger with configured behavior
 */
export const createLoggerMockWithBehavior = (behavior?: {
	error?: (...args: unknown[]) => void
	info?: (...args: unknown[]) => void
	warn?: (...args: unknown[]) => void
	debug?: (...args: unknown[]) => void
}): MockLogger => {
	const logger = createLoggerMock()

	if (behavior?.error) logger.error.mockImplementation(behavior.error)
	if (behavior?.info) logger.info.mockImplementation(behavior.info)
	if (behavior?.warn) logger.warn.mockImplementation(behavior.warn)
	if (behavior?.debug) logger.debug.mockImplementation(behavior.debug)

	return logger
}

/**
 * Unified export object providing all logger mock utilities
 * Follows the pattern established by cognito-service.mock.ts
 */
export const mockLogger = {
	/** Create a basic logger mock with all methods */
	create: createLoggerMock,
	/** Create a complete pino HTTP logger mock */
	createPinoHttp: createPinoHttpMock,
	/** Create module mock for vi.mock() calls */
	createModule: createLoggerModuleMock,
	/** Setup logger mock for beforeEach hooks */
	setup: setupLoggerMock,
	/** Setup pino HTTP mock for beforeEach hooks */
	setupPinoHttp: setupPinoHttpMock,
	/** Create logger mock with custom behavior */
	withBehavior: createLoggerMockWithBehavior,
}

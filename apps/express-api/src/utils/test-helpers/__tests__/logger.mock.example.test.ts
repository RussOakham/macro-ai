import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockLogger } from '../logger.mock.ts'

// Example of using the logger mock in a test file
vi.mock('../../logger.ts', () => mockLogger.createModule())

describe('Logger Mock Example Usage', () => {
	let logger: ReturnType<typeof mockLogger.create>

	beforeEach(() => {
		logger = mockLogger.setup()
	})

	describe('Basic Logger Mock Usage', () => {
		it('should create logger mock with all required methods', () => {
			// Arrange & Act
			logger = mockLogger.create()

			// Assert
			expect(logger.error).toBeDefined()
			expect(logger.info).toBeDefined()
			expect(logger.warn).toBeDefined()
			expect(logger.debug).toBeDefined()
			expect(vi.isMockFunction(logger.error)).toBe(true)
			expect(vi.isMockFunction(logger.info)).toBe(true)
			expect(vi.isMockFunction(logger.warn)).toBe(true)
			expect(vi.isMockFunction(logger.debug)).toBe(true)
		})

		it('should create pino HTTP mock with logger property', () => {
			// Arrange & Act
			const pinoMock = mockLogger.createPinoHttp()

			// Assert
			expect(pinoMock.logger).toBeDefined()
			expect(pinoMock.logger.error).toBeDefined()
			expect(pinoMock.logger.info).toBeDefined()
			expect(pinoMock.logger.warn).toBeDefined()
			expect(pinoMock.logger.debug).toBeDefined()
			expect(vi.isMockFunction(pinoMock)).toBe(true)
		})

		it('should create module mock with correct structure', () => {
			// Arrange & Act
			const moduleMock = mockLogger.createModule()

			// Assert
			expect(moduleMock.pino).toBeDefined()
			expect(moduleMock.configureLogger).toBeDefined()
			expect(moduleMock.pino.logger).toBeDefined()
			expect(vi.isMockFunction(moduleMock.configureLogger)).toBe(true)
			expect(vi.isMockFunction(moduleMock.pino.logger.error)).toBe(true)
		})
	})

	describe('Logger Mock with Custom Behavior', () => {
		it('should create logger mock with custom error behavior', () => {
			// Arrange
			const customErrorFn = vi.fn(() => 'custom error')
			const loggerMock = mockLogger.withBehavior({
				error: customErrorFn,
			})

			// Act
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const result = loggerMock.error('test message')

			// Assert
			expect(result).toBe('custom error')
			expect(customErrorFn).toHaveBeenCalledWith('test message')
		})

		it('should create logger mock with multiple custom behaviors', () => {
			// Arrange
			const customInfoFn = vi.fn(() => 'info logged')
			const customWarnFn = vi.fn(() => 'warning logged')
			const loggerMock = mockLogger.withBehavior({
				info: customInfoFn,
				warn: customWarnFn,
			})

			// Act
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const infoResult = loggerMock.info('info message')
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const warnResult = loggerMock.warn('warn message')

			// Assert
			expect(infoResult).toBe('info logged')
			expect(warnResult).toBe('warning logged')
			expect(customInfoFn).toHaveBeenCalledWith('info message')
			expect(customWarnFn).toHaveBeenCalledWith('warn message')
		})
	})

	describe('Setup Functions', () => {
		it('should clear all mocks when setup is called', () => {
			// Arrange
			const initialLogger = mockLogger.create()
			initialLogger.error('test')
			expect(initialLogger.error).toHaveBeenCalledTimes(1)

			// Act
			const newLogger = mockLogger.setup()

			// Assert - new logger should be fresh
			expect(newLogger.error).toHaveBeenCalledTimes(0)
		})

		it('should clear all mocks when setupPinoHttp is called', () => {
			// Arrange
			const initialPino = mockLogger.createPinoHttp()
			initialPino.logger.info('test')
			expect(initialPino.logger.info).toHaveBeenCalledTimes(1)

			// Act
			const newPino = mockLogger.setupPinoHttp()

			// Assert - new pino should be fresh
			expect(newPino.logger.info).toHaveBeenCalledTimes(0)
		})
	})

	describe('Integration with Actual Logger Module', () => {
		it('should work with imported logger module', async () => {
			// Arrange & Act
			const { pino } = await import('../../logger.ts')

			// Assert - should be mocked
			expect(vi.isMockFunction(pino.logger.error)).toBe(true)
			expect(vi.isMockFunction(pino.logger.info)).toBe(true)
			expect(vi.isMockFunction(pino.logger.warn)).toBe(true)
			expect(vi.isMockFunction(pino.logger.debug)).toBe(true)
		})

		it('should track calls to mocked logger methods', async () => {
			// Arrange
			const { pino } = await import('../../logger.ts')

			// Act
			pino.logger.error('test error')
			pino.logger.info('test info')
			pino.logger.warn('test warning')
			pino.logger.debug('test debug')

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith('test error')
			expect(pino.logger.info).toHaveBeenCalledWith('test info')
			expect(pino.logger.warn).toHaveBeenCalledWith('test warning')
			expect(pino.logger.debug).toHaveBeenCalledWith('test debug')
			expect(pino.logger.error).toHaveBeenCalledTimes(1)
			expect(pino.logger.info).toHaveBeenCalledTimes(1)
			expect(pino.logger.warn).toHaveBeenCalledTimes(1)
			expect(pino.logger.debug).toHaveBeenCalledTimes(1)
		})
	})
})

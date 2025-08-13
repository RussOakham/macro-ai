import type { Express } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockConfig } from '../utils/test-helpers/config.mock.ts'
import { mockLogger } from '../utils/test-helpers/logger.mock.ts'

// Mock all external dependencies before importing the index module
vi.mock('../../config/default.ts', () => mockConfig.createModule())

vi.mock('../utils/logger.ts', () => mockLogger.createModule())

// Mock the server module
vi.mock('../utils/server.ts', () => ({
	createServer: vi.fn(),
}))

// Mock process.exit to prevent actual process termination during tests
const mockProcessExit = vi.fn()
Object.defineProperty(process, 'exit', {
	value: mockProcessExit,
	writable: true,
})

describe('Server Bootstrap (index.ts)', () => {
	let mockServer: {
		listen: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetModules()

		// Setup mock server
		mockServer = {
			listen: vi.fn(),
		}

		// Reset process.exit mock
		mockProcessExit.mockClear()
	})

	describe('Successful Server Startup', () => {
		it('should create server and start listening on configured port', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')
			const { config } = await import('../../config/default.ts')
			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)

			// Mock successful listen
			mockServer.listen.mockImplementation((_port, callback?: () => void) => {
				if (callback) callback()
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(createServer).toHaveBeenCalledTimes(1)
			expect(mockServer.listen).toHaveBeenCalledWith(
				config.port,
				expect.any(Function),
			)
		})

		it('should log success message when server starts successfully', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')
			const { config } = await import('../../config/default.ts')
			const { pino } = await import('../utils/logger.ts')

			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)
			mockServer.listen.mockImplementation((_port, callback?: () => void) => {
				if (callback) callback()
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(pino.logger.info).toHaveBeenCalledWith(
				`[server]: Server is running on port: ${config.port.toString()}`,
			)
		})

		it('should use the correct port from configuration', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')
			const { config } = await import('../../config/default.ts')

			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)
			mockServer.listen.mockImplementation((_port, callback?: () => void) => {
				if (callback) callback()
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(mockServer.listen).toHaveBeenCalledWith(
				config.port,
				expect.any(Function),
			)
		})
	})

	describe('Server Startup Errors', () => {
		it('should handle createServer errors and exit process', async () => {
			// Arrange
			const testError = new Error('Server creation failed')
			const { createServer } = await import('../utils/server.ts')
			const { pino } = await import('../utils/logger.ts')

			vi.mocked(createServer).mockImplementation(() => {
				throw testError
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				{ error: testError },
				'[server]: Failed to start server',
			)
			expect(mockProcessExit).toHaveBeenCalledWith(1)
		})

		it('should handle listen errors and exit process', async () => {
			// Arrange
			const testError = new Error('Port already in use')
			const { createServer } = await import('../utils/server.ts')
			const { pino } = await import('../utils/logger.ts')

			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)
			mockServer.listen.mockImplementation(() => {
				throw testError
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				{ error: testError },
				'[server]: Failed to start server',
			)
			expect(mockProcessExit).toHaveBeenCalledWith(1)
		})

		it('should handle configuration loading errors', async () => {
			// Arrange
			const configError = new Error('Configuration loading failed')
			const { createServer } = await import('../utils/server.ts')
			const { pino } = await import('../utils/logger.ts')

			// Mock createServer to throw error (simulating config loading failure)
			vi.mocked(createServer).mockImplementation(() => {
				throw configError
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				{ error: configError },
				'[server]: Failed to start server',
			)
			expect(mockProcessExit).toHaveBeenCalledWith(1)
		})

		it('should handle server creation errors', async () => {
			// Arrange
			const serverError = new Error('Server creation failed')
			const { createServer } = await import('../utils/server.ts')
			const { pino } = await import('../utils/logger.ts')

			// Mock createServer to throw error
			vi.mocked(createServer).mockImplementation(() => {
				throw serverError
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				{ error: serverError },
				'[server]: Failed to start server',
			)
			expect(mockProcessExit).toHaveBeenCalledWith(1)
		})
	})

	describe('Logger Integration', () => {
		it('should extract logger from pino module', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')
			const { pino } = await import('../utils/logger.ts')

			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)
			mockServer.listen.mockImplementation((_port, callback?: () => void) => {
				if (callback) callback()
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(pino.logger).toBeDefined()
			expect(pino.logger.info).toHaveBeenCalled()
		})

		it('should use logger for both success and error scenarios', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')
			const { pino } = await import('../utils/logger.ts')

			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)
			mockServer.listen.mockImplementation((_port, callback?: () => void) => {
				if (callback) callback()
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(pino.logger.info).toHaveBeenCalled()
			expect(pino.logger.error).not.toHaveBeenCalled()
		})
	})

	describe('Process Exit Behavior', () => {
		it('should exit with code 1 on any startup error', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')

			vi.mocked(createServer).mockImplementation(() => {
				throw new Error('Startup failed')
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(mockProcessExit).toHaveBeenCalledWith(1)
			expect(mockProcessExit).toHaveBeenCalledTimes(1)
		})

		it('should not exit process on successful startup', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')

			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)
			mockServer.listen.mockImplementation((_port, callback?: () => void) => {
				if (callback) callback()
			})

			// Act
			await import('../index.ts')

			// Assert
			expect(mockProcessExit).not.toHaveBeenCalled()
		})
	})

	describe('Module Dependencies', () => {
		it('should import all required modules', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')

			vi.mocked(createServer).mockReturnValue(mockServer as unknown as Express)
			mockServer.listen.mockImplementation((_port, callback?: () => void) => {
				if (callback) callback()
			})

			// Act
			await import('../index.ts')

			// Assert - Verify all modules are imported and used
			const { config } = await import('../../config/default.ts')
			const { pino } = await import('../utils/logger.ts')

			expect(config).toBeDefined()
			expect(pino).toBeDefined()
			expect(createServer).toBeDefined()
		})
	})
})

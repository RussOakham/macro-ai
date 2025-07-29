import express, { Express, NextFunction, Request, Response } from 'express'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockConfig } from '../test-helpers/config.mock.ts'
import { mockLogger } from '../test-helpers/logger.mock.ts'

// Mock all external dependencies before importing the server module
vi.mock('../../config/default.ts', () => mockConfig.createModule())

vi.mock('../logger.ts', () => mockLogger.createModule())

// Mock all middleware modules
vi.mock('../../middleware/api-key.middleware.ts', () => ({
	apiKeyAuth: vi.fn((_req, _res, next: NextFunction) => {
		next()
	}),
}))

vi.mock('../../middleware/error.middleware.ts', () => ({
	errorHandler: vi.fn(() => {
		// Mock error handler implementation
	}),
}))

vi.mock('../../middleware/rate-limit.middleware.ts', () => ({
	defaultRateLimiter: vi.fn((_req, _res, next: NextFunction) => {
		next()
	}),
}))

vi.mock('../../middleware/security-headers.middleware.ts', () => ({
	helmetMiddleware: vi.fn((_req, _res, next: NextFunction) => {
		next()
	}),
	securityHeadersMiddleware: vi.fn((_req, _res, next: NextFunction) => {
		next()
	}),
}))

vi.mock('../../router/index.routes.ts', () => ({
	appRouter: vi.fn(() => vi.fn()),
}))

// Mock external packages
vi.mock('body-parser', () => ({
	default: {
		json: vi.fn(() => vi.fn()),
	},
}))

vi.mock('compression', () => ({
	default: vi.fn(() => vi.fn()),
}))

vi.mock('cookie-parser', () => ({
	default: vi.fn(() => vi.fn()),
}))

vi.mock('cors', () => ({
	default: vi.fn(() => vi.fn()),
}))

vi.mock('swagger-ui-express', () => ({
	default: {
		serve: vi.fn(),
		setup: vi.fn(() => vi.fn()),
	},
}))

vi.mock('express', () => {
	const mockStatic = vi.fn(() => vi.fn())
	const mockUrlencoded = vi.fn(() => vi.fn())
	const mockExpress = vi.fn(() => ({
		use: vi.fn(),
		listen: vi.fn(),
	}))

	// Add static and urlencoded as properties of the mock function
	Object.assign(mockExpress, {
		static: mockStatic,
		urlencoded: mockUrlencoded,
	})

	return {
		default: mockExpress,
	}
})

vi.mock('path', () => ({
	default: {
		join: vi.fn(() => '/mocked/path'),
	},
}))

// Mock process.cwd for static file serving while preserving other process properties
vi.mock('process', () => ({
	...process,
	cwd: vi.fn(() => '/mocked/cwd'),
}))

describe('createServer', () => {
	let mockApp: {
		use: ReturnType<typeof vi.fn>
		listen: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetModules()

		// Setup mock Express app
		mockApp = {
			use: vi.fn(),
			listen: vi.fn(),
		}

		// Mock express() to return our mock app
		vi.mocked(express).mockReturnValue(mockApp as unknown as Express)
	})

	describe('Express App Creation', () => {
		it('should create an Express application', async () => {
			// Act
			const { createServer } = await import('../server.ts')
			const app = createServer()

			// Assert
			expect(express).toHaveBeenCalledTimes(1)
			expect(app).toBe(mockApp)
		})
	})

	describe('Static File Serving', () => {
		it('should configure static file serving for public directory', async () => {
			// Arrange
			const mockStaticMiddleware = vi.fn()
			vi.mocked(express.static).mockReturnValue(mockStaticMiddleware)
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vi.mocked(path.join).mockReturnValue('/mocked/public/path')

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(vi.mocked(path.join)).toHaveBeenCalledWith(
				expect.any(String),
				'public',
			)
			expect(vi.mocked(express.static)).toHaveBeenCalledWith(
				'/mocked/public/path',
			)
			expect(mockApp.use).toHaveBeenCalledWith(mockStaticMiddleware)
		})
	})

	describe('Logger Middleware', () => {
		it('should add pino logger middleware', async () => {
			// Arrange
			const { pino } = await import('../logger.ts')

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(mockApp.use).toHaveBeenCalledWith(pino)
		})
	})

	describe('CORS Configuration', () => {
		it('should configure CORS with correct options', async () => {
			// Arrange
			const mockCorsMiddleware = vi.fn()
			const cors = await import('cors')
			vi.mocked(cors.default).mockReturnValue(mockCorsMiddleware)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(cors.default).toHaveBeenCalledWith({
				origin: ['http://localhost:3000', 'http://localhost:3030'],
				credentials: true,
				exposedHeaders: ['cache-control'], // 'set-cookie' cannot be exposed via CORS
				methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				allowedHeaders: [
					'Origin',
					'X-Requested-With',
					'Content-Type',
					'Accept',
					'Authorization',
					'X-API-KEY',
					'Cache-Control',
				],
				maxAge: 86400, // 24 hours
			})
			expect(mockApp.use).toHaveBeenCalledWith(mockCorsMiddleware)
		})
	})

	describe('Body Parsing Middleware', () => {
		it('should configure compression middleware with streaming filter', async () => {
			// Arrange
			const mockCompressionMiddleware = vi.fn()
			const compression = await import('compression')
			vi.mocked(compression.default).mockReturnValue(mockCompressionMiddleware)
			// Mock the filter function
			vi.mocked(compression.default).filter = vi.fn().mockReturnValue(true)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(compression.default).toHaveBeenCalledWith({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				filter: expect.any(Function),
			})
			expect(mockApp.use).toHaveBeenCalledWith(mockCompressionMiddleware)
		})

		it('should disable compression for streaming endpoints', async () => {
			// Arrange
			const mockCompressionMiddleware = vi.fn()
			const compression = await import('compression')
			vi.mocked(compression.default).mockReturnValue(mockCompressionMiddleware)
			vi.mocked(compression.default).filter = vi.fn().mockReturnValue(true)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Get the filter function that was passed to compression
			const compressionCall = vi.mocked(compression.default).mock.calls[0]?.[0]
			const filterFunction = compressionCall?.filter

			// Assert
			expect(filterFunction).toBeDefined()
			if (filterFunction) {
				// Create mock request objects with minimal required properties
				const streamingReq = {
					path: '/api/chats/123/stream',
					method: 'POST',
					url: '/api/chats/123/stream',
					headers: {},
					cookies: {},
				} as Request

				const regularReq = {
					path: '/api/chats',
					method: 'GET',
					url: '/api/chats',
					headers: {},
					cookies: {},
				} as Request

				const mockRes = {} as Response

				// Test streaming endpoint - should return false (no compression)
				expect(filterFunction(streamingReq, mockRes)).toBe(false)

				// Test regular endpoint - should use default filter
				expect(filterFunction(regularReq, mockRes)).toBe(true)
				expect(compression.default.filter).toHaveBeenCalledWith(
					regularReq,
					mockRes,
				)
			}
		})

		it('should configure body-parser JSON middleware', async () => {
			// Arrange
			const mockJsonMiddleware = vi.fn()
			const bodyParser = await import('body-parser')
			// eslint-disable-next-line @typescript-eslint/unbound-method
			vi.mocked(bodyParser.default.json).mockReturnValue(mockJsonMiddleware)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(vi.mocked(bodyParser.default.json)).toHaveBeenCalledTimes(1)
			expect(mockApp.use).toHaveBeenCalledWith(mockJsonMiddleware)
		})

		it('should configure URL encoded middleware', async () => {
			// Arrange
			const mockUrlencodedMiddleware = vi.fn()
			vi.mocked(express.urlencoded).mockReturnValue(mockUrlencodedMiddleware)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(express.urlencoded).toHaveBeenCalledWith({ extended: true })
			expect(mockApp.use).toHaveBeenCalledWith(mockUrlencodedMiddleware)
		})

		it('should configure cookie parser middleware', async () => {
			// Arrange
			const mockCookieParserMiddleware = vi.fn()
			const cookieParser = await import('cookie-parser')
			vi.mocked(cookieParser.default).mockReturnValue(
				mockCookieParserMiddleware,
			)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(cookieParser.default).toHaveBeenCalledTimes(1)
			expect(mockApp.use).toHaveBeenCalledWith(mockCookieParserMiddleware)
		})
	})

	describe('Security Middleware', () => {
		it('should add API key authentication middleware', async () => {
			// Arrange
			const { apiKeyAuth } = await import(
				'../../middleware/api-key.middleware.ts'
			)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(mockApp.use).toHaveBeenCalledWith(apiKeyAuth)
		})

		it('should add helmet security middleware', async () => {
			// Arrange
			const { helmetMiddleware } = await import(
				'../../middleware/security-headers.middleware.ts'
			)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(mockApp.use).toHaveBeenCalledWith(helmetMiddleware)
		})

		it('should add custom security headers middleware', async () => {
			// Arrange
			const { securityHeadersMiddleware } = await import(
				'../../middleware/security-headers.middleware.ts'
			)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(mockApp.use).toHaveBeenCalledWith(securityHeadersMiddleware)
		})

		it('should add rate limiting middleware', async () => {
			// Arrange
			const { defaultRateLimiter } = await import(
				'../../middleware/rate-limit.middleware.ts'
			)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(mockApp.use).toHaveBeenCalledWith(defaultRateLimiter)
		})
	})

	describe('Router Configuration', () => {
		it('should mount API router at /api path', async () => {
			// Arrange
			const mockRouterInstance = {
				use: vi.fn(),
				get: vi.fn(),
				post: vi.fn(),
				put: vi.fn(),
				delete: vi.fn(),
			} as unknown as Express
			const { appRouter } = await import('../../router/index.routes.ts')
			vi.mocked(appRouter).mockReturnValue(mockRouterInstance)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(appRouter).toHaveBeenCalledTimes(1)
			expect(mockApp.use).toHaveBeenCalledWith('/api', mockRouterInstance)
		})
	})

	describe('Swagger UI Configuration', () => {
		it('should configure Swagger UI at /api-docs path', async () => {
			// Arrange
			const mockSwaggerSetup = vi.fn()
			const swaggerUi = await import('swagger-ui-express')
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			vi.mocked(swaggerUi.default.setup).mockReturnValue(mockSwaggerSetup)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			expect(vi.mocked(swaggerUi.default.setup)).toHaveBeenCalledWith(
				undefined,
				{
					explorer: true,
					swaggerOptions: {
						url: '/swagger.json',
					},
				},
			)
			expect(mockApp.use).toHaveBeenCalledWith(
				'/api-docs',
				swaggerUi.default.serve,
				mockSwaggerSetup,
			)
		})
	})

	describe('Error Handler', () => {
		it('should add error handler as the last middleware', async () => {
			// Arrange
			const { errorHandler } = await import(
				'../../middleware/error.middleware.ts'
			)

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert
			expect(mockApp.use).toHaveBeenCalledWith(errorHandler)

			// Verify error handler is added last by checking the call order
			const useCalls = vi.mocked(mockApp.use).mock.calls
			const errorHandlerCallIndex = useCalls.findIndex(
				(call) => call[0] === errorHandler,
			)
			expect(errorHandlerCallIndex).toBe(useCalls.length - 1)
		})
	})

	describe('Middleware Order', () => {
		it('should apply middleware in the correct order', async () => {
			// Arrange
			const { pino } = await import('../logger.ts')
			const { apiKeyAuth } = await import(
				'../../middleware/api-key.middleware.ts'
			)
			const { helmetMiddleware, securityHeadersMiddleware } = await import(
				'../../middleware/security-headers.middleware.ts'
			)
			const { defaultRateLimiter } = await import(
				'../../middleware/rate-limit.middleware.ts'
			)
			const { errorHandler } = await import(
				'../../middleware/error.middleware.ts'
			)
			// Import appRouter for middleware order verification
			await import('../../router/index.routes.ts')
			await import('swagger-ui-express')

			// Act
			const { createServer } = await import('../server.ts')
			createServer()

			// Assert - Check the order of middleware calls
			const useCalls = vi.mocked(mockApp.use).mock.calls

			// Find indices of key middleware
			const pinoIndex = useCalls.findIndex((call) => call[0] === pino)
			const apiKeyIndex = useCalls.findIndex((call) => call[0] === apiKeyAuth)
			const helmetIndex = useCalls.findIndex(
				(call) => call[0] === helmetMiddleware,
			)
			const securityIndex = useCalls.findIndex(
				(call) => call[0] === securityHeadersMiddleware,
			)
			const rateLimitIndex = useCalls.findIndex(
				(call) => call[0] === defaultRateLimiter,
			)
			const apiRouterIndex = useCalls.findIndex((call) => call[0] === '/api')
			const swaggerIndex = useCalls.findIndex((call) => call[0] === '/api-docs')
			const errorHandlerIndex = useCalls.findIndex(
				(call) => call[0] === errorHandler,
			)

			// Verify order: logger -> security middleware -> routes -> error handler
			expect(pinoIndex).toBeGreaterThan(-1)
			expect(apiKeyIndex).toBeGreaterThan(pinoIndex)
			expect(helmetIndex).toBeGreaterThan(apiKeyIndex)
			expect(securityIndex).toBeGreaterThan(helmetIndex)
			expect(rateLimitIndex).toBeGreaterThan(securityIndex)
			expect(apiRouterIndex).toBeGreaterThan(rateLimitIndex)
			expect(swaggerIndex).toBeGreaterThan(apiRouterIndex)
			expect(errorHandlerIndex).toBeGreaterThan(swaggerIndex)
			expect(errorHandlerIndex).toBe(useCalls.length - 1) // Error handler should be last
		})
	})

	describe('Return Value', () => {
		it('should return the configured Express application', async () => {
			// Act
			const { createServer } = await import('../server.ts')
			const result = createServer()

			// Assert
			expect(result).toBe(mockApp)
			expect(result).toHaveProperty('use')
			expect(result).toHaveProperty('listen')
		})
	})
})

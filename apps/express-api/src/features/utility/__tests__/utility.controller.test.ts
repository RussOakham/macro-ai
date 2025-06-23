import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError } from '../../../utils/errors.ts'
import { mockExpress } from '../../../utils/test-helpers/express-mocks.ts'
import { utilityController } from '../utility.controller.ts'
import { utilityService } from '../utility.services.ts'

// Mock the utility service
vi.mock('../utility.services.ts', () => ({
	utilityService: {
		getHealthStatus: vi.fn(),
		getSystemInfo: vi.fn(),
	},
}))

// Mock the logger
vi.mock('../../../utils/logger.ts', () => ({
	pino: {
		logger: {
			error: vi.fn(),
			info: vi.fn(),
		},
	},
}))

describe('UtilityController', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction

	beforeEach(() => {
		const mocks = mockExpress.setup()
		mockRequest = mocks.req
		mockResponse = mocks.res
		mockNext = mocks.next
	})

	describe('getHealthStatus', () => {
		it('should return health status successfully', () => {
			// Arrange
			const mockHealthStatus = {
				message: 'Api Health Status: OK',
				timestamp: '2023-01-01T00:00:00.000Z',
				uptime: 100,
				memoryUsageMB: 50,
			}
			vi.mocked(utilityService.getHealthStatus).mockReturnValue([
				mockHealthStatus,
				null,
			])

			// Act
			utilityController.getHealthStatus(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(utilityService.getHealthStatus).toHaveBeenCalledOnce()
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Api Health Status: OK',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle error and call next middleware', () => {
			// Arrange
			const mockError = new InternalError('Health check failed', 'test')
			vi.mocked(utilityService.getHealthStatus).mockReturnValue([
				null,
				mockError,
			])

			// Act
			utilityController.getHealthStatus(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(utilityService.getHealthStatus).toHaveBeenCalledOnce()
			expect(mockNext).toHaveBeenCalledWith(mockError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('getSystemInfo', () => {
		it('should return system info successfully', () => {
			// Arrange
			const mockSystemInfo = {
				nodeVersion: 'v18.0.0',
				platform: 'linux',
				architecture: 'x64',
				uptime: 100,
				memoryUsage: {
					rss: 50,
					heapTotal: 30,
					heapUsed: 20,
					external: 5,
				},
				cpuUsage: {
					user: 1000,
					system: 500,
				},
				timestamp: '2023-01-01T00:00:00.000Z',
			}
			vi.mocked(utilityService.getSystemInfo).mockReturnValue([
				mockSystemInfo,
				null,
			])

			// Act
			utilityController.getSystemInfo(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(utilityService.getSystemInfo).toHaveBeenCalledOnce()
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith(mockSystemInfo)
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle error and call next middleware', () => {
			// Arrange
			const mockError = new InternalError('System info failed', 'test')
			vi.mocked(utilityService.getSystemInfo).mockReturnValue([null, mockError])

			// Act
			utilityController.getSystemInfo(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(utilityService.getSystemInfo).toHaveBeenCalledOnce()
			expect(mockNext).toHaveBeenCalledWith(mockError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})
})

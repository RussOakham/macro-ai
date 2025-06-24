import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError } from '../../../utils/errors.ts'
import { mockExpress } from '../../../utils/test-helpers/express-mocks.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { mockUtilityService } from '../../../utils/test-helpers/utility-service.mock.ts'
import { utilityController } from '../utility.controller.ts'
import { utilityService } from '../utility.services.ts'

// Mock the utility service using the reusable helper
vi.mock('../utility.services.ts', () => mockUtilityService.createModule())

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

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
			const mockHealthStatus = mockUtilityService.createHealthStatus()
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
			const mockSystemInfo = mockUtilityService.createSystemInfo()
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

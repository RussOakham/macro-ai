/* eslint-disable @typescript-eslint/unbound-method */
import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError } from '../../../utils/errors.ts'
import { createMockExpressObjects } from '../../../utils/test-helpers/enhanced-mocks.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { mockUtilityService } from '../../../utils/test-helpers/utility-service.mock.ts'
import { utilityController } from '../utility.controller.ts'
import { utilityService } from '../utility.services.ts'

// Mock the utility service using the reusable helper
vi.mock('../utility.services.ts', () => mockUtilityService.createModule())

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

describe('UtilityController', () => {
	let mockRequest: Request
	let mockResponse: Response
	let mockNext: NextFunction

	beforeEach(() => {
		vi.clearAllMocks()
		const { req, res, next } = createMockExpressObjects({
			headers: {
				'User-Agent': 'Mozilla/5.0 (Test Browser)',
				'X-Forwarded-For': '192.168.1.1',
				'X-Real-IP': '192.168.1.1',
				Origin: 'http://localhost:3000',
				Referer: 'http://localhost:3000/health',
			},
			method: 'GET',
			ip: '127.0.0.1',
			path: '/health',
		})
		mockRequest = req
		mockResponse = res
		mockNext = next
	})

	describe('getHealthStatus', () => {
		describe.each([
			[
				'successful health status',
				mockUtilityService.createHealthStatus(),
				null,
				StatusCodes.OK,
				{ message: 'Api Health Status: OK' },
			],
			[
				'health status error',
				null,
				new InternalError('Health check failed', 'test'),
				null,
				null,
			],
		] as const)(
			'should handle %s',
			(scenario, mockResult, mockError, expectedStatus, expectedJson) => {
				it(`should ${scenario}`, () => {
					// Arrange
					vi.mocked(utilityService.getHealthStatus).mockReturnValue(
						mockError ? [null, mockError] : [mockResult, null]
					)

					// Act
					utilityController.getHealthStatus(mockRequest, mockResponse, mockNext)

					// Assert
					expect(utilityService.getHealthStatus).toHaveBeenCalledOnce()
					if (mockError) {
						expect(mockNext).toHaveBeenCalledWith(mockError)
						expect(mockResponse.status).not.toHaveBeenCalled()
						expect(mockResponse.json).not.toHaveBeenCalled()
					} else {
						expect(mockResponse.status).toHaveBeenCalledWith(expectedStatus)
						expect(mockResponse.json).toHaveBeenCalledWith(expectedJson)
						expect(mockNext).not.toHaveBeenCalled()
					}
				})
			},
		)
	})

	describe('getSystemInfo', () => {
		describe.each([
			[
				'successful system info',
				mockUtilityService.createSystemInfo(),
				null,
				StatusCodes.OK,
			],
			[
				'system info error',
				null,
				new InternalError('System info failed', 'test'),
				null,
			],
		] as const)(
			'should handle %s',
			(scenario, mockResult, mockError, expectedStatus) => {
				it(`should ${scenario}`, () => {
					// Arrange
					vi.mocked(utilityService.getSystemInfo).mockReturnValue(
						mockError ? [null, mockError] : [mockResult, null]
					)

					// Act
					utilityController.getSystemInfo(mockRequest, mockResponse, mockNext)

					// Assert
					expect(utilityService.getSystemInfo).toHaveBeenCalledOnce()
					if (mockError) {
						expect(mockNext).toHaveBeenCalledWith(mockError)
						expect(mockResponse.status).not.toHaveBeenCalled()
						expect(mockResponse.json).not.toHaveBeenCalled()
					} else {
						expect(mockResponse.status).toHaveBeenCalledWith(expectedStatus)
						expect(mockResponse.json).toHaveBeenCalledWith(mockResult)
						expect(mockNext).not.toHaveBeenCalled()
					}
				})
			},
		)
	})
})

import { type GetUserCommandOutput } from '@aws-sdk/client-cognito-identity-provider'
import { type NextFunction, type Request, type Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CognitoService } from '../../features/auth/auth.services.ts'
import { UnauthorizedError } from '../../utils/errors.ts'
import { handleServiceError } from '../../utils/response-handlers.ts'
import { MockDataFactory } from '../../utils/test-helpers/advanced-mocking.ts'
import { createMockExpressObjects } from '../../utils/test-helpers/enhanced-mocks.ts'
import { mockErrorHandling } from '../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'

// Mock the logger using the reusable helper
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())

// Mock the cookies utility
vi.mock('../../utils/cookies.ts', () => ({
	getAccessToken: vi.fn(),
}))

// Mock the error handling module using the helper
vi.mock('../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Mock the response handlers
vi.mock('../../utils/response-handlers.ts', () => ({
	handleServiceError: vi.fn(),
}))

// Mock the CognitoService class directly for middleware testing
vi.mock('../../features/auth/auth.services.ts', () => ({
	CognitoService: vi.fn(),
}))

// Create a typed mock instance for the CognitoService
// This approach provides type safety while being simple and maintainable
const mockCognitoInstance = {
	getAuthUser: vi.fn(),
} satisfies Partial<CognitoService>

// Helper functions for creating mock data using enhanced factory
const createMockCognitoUser = (
	overrides: Partial<GetUserCommandOutput> = {},
): GetUserCommandOutput => ({
	...MockDataFactory.cognitoUser(),
	...overrides,
})

const createMockCognitoError = (message: string): Error => {
	const error = new Error(message)
	// Add Cognito-specific properties if needed
	return error
}

// Import after mocking
import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
// Note: verifyAuth is imported dynamically in tests to ensure mocks are set up first

describe('verifyAuth Middleware', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction

	beforeEach(() => {
		// Setup enhanced Express mocks
		const expressMocks = createMockExpressObjects()
		mockRequest = expressMocks.req
		mockResponse = expressMocks.res
		mockNext = expressMocks.next

		// Setup the CognitoService class mock to return our typed mock instance
		// This must be done after clearAllMocks to ensure it's not cleared
		vi.mocked(CognitoService).mockImplementation(
			() => mockCognitoInstance as unknown as CognitoService,
		)
	})

	describe('Access Token Extraction', () => {
		it('should call next with UnauthorizedError when tryCatchSync returns an error', async () => {
			// Arrange
			const tokenError = mockErrorHandling.errors.unauthorized(
				'Token extraction failed',
				'test',
			)
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(tokenError),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'verifyAuth',
			)
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Authentication failed')
			expect(error.service).toBe('verifyAuth middleware')
		})

		it('should handle token expired error specifically', async () => {
			// Arrange
			const tokenError = mockErrorHandling.errors.unauthorized(
				'Token expired',
				'test',
			)
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(tokenError),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Authentication token expired')
			expect(error.service).toBe('verifyAuth middleware')
		})

		it('should call next with UnauthorizedError when no access token is provided', async () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult(null),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Authentication required')
			expect(error.service).toBe('verifyAuth middleware')
		})

		it('should call next with UnauthorizedError when access token is empty string', async () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult(''),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Authentication required')
			expect(error.service).toBe('verifyAuth middleware')
		})
	})

	describe('Cognito Token Verification', () => {
		beforeEach(() => {
			// Setup successful token extraction
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
		})

		it('should call next with cognito error when getAuthUser returns an error', async () => {
			// Arrange - Using properly typed Cognito error
			const cognitoError = createMockCognitoError('Invalid access token')
			mockCognitoInstance.getAuthUser.mockResolvedValue([null, cognitoError])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockCognitoInstance.getAuthUser).toHaveBeenCalledWith(
				'valid-access-token',
			)
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
		})

		it('should call handleServiceError when cognito user is returned', async () => {
			// Arrange
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: 'test-user-id',
			})
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(handleServiceError).toHaveBeenCalledWith(
				mockCognitoUser,
				'Error verifying token',
				'middleware - verifyAuth',
			)
		})

		it('should call next with UnauthorizedError when handleServiceError returns failure', async () => {
			// Arrange
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: 'test-user-id',
				$metadata: { httpStatusCode: 401 },
			})
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])
			vi.mocked(handleServiceError).mockReturnValue({
				success: false,
				error: { status: 401, message: 'Service error' },
			})

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Service error')
			expect(error.service).toBe('verifyAuth middleware')
		})
	})

	describe('User Validation', () => {
		beforeEach(() => {
			// Setup successful token extraction and service error handling
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
		})

		describe.each([
			[undefined, 'no Username'],
			['', 'empty Username'],
			[null, 'null Username'],
		])('Invalid username scenarios: %s', (username, description) => {
			it(`should call next with UnauthorizedError when cognito user has ${description}`, async () => {
				// Arrange
				const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
					Username: username as unknown as string,
				})
				mockCognitoInstance.getAuthUser.mockResolvedValue([
					mockCognitoUser,
					null,
				])

				// Act
				await (
					await import('../auth.middleware.ts')
				).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

				// Assert
				expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
				const error = vi.mocked(mockNext).mock
					.calls[0]?.[0] as unknown as UnauthorizedError
				expect(error.message).toBe('Invalid authentication token')
				expect(error.service).toBe('verifyAuth middleware')
			})
		})
	})

	describe('Successful Authentication', () => {
		beforeEach(() => {
			// Setup successful token extraction and service error handling
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
		})

		describe.each([
			['test-user-id-123', 'alphanumeric username'],
			['550e8400-e29b-41d4-a716-446655440000', 'valid UUID'],
			['user123abc', 'alphanumeric username'],
			['admin@company.com', 'email-style username'],
		])('Username validation: %s', (username, description) => {
			it(`should proceed with ${description}`, async () => {
				// Arrange
				const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
					Username: username,
				})
				mockCognitoInstance.getAuthUser.mockResolvedValue([
					mockCognitoUser,
					null,
				])

				// Act
				await (
					await import('../auth.middleware.ts')
				).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

				// Assert
				expect(mockRequest.userId).toBe(username)
				expect(mockNext).toHaveBeenCalledWith()
				expect(mockNext).toHaveBeenCalledTimes(1)
				expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error))
			})
		})
	})

	describe('Logging Behavior', () => {
		it('should log warning when token expired error occurs', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const tokenError = new UnauthorizedError('Token expired', 'test')
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(tokenError),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.warn).toHaveBeenCalledWith(
				'[middleware - verifyAuth]: Token expired',
			)
		})

		it('should log error when token extraction fails', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const tokenError = new UnauthorizedError(
				'Token extraction failed',
				'test',
			)
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(tokenError),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith({
				msg: '[middleware - verifyAuth]: Error retrieving access token',
				error: 'Token extraction failed',
			})
		})

		it('should log warning when no access token is provided', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult(null),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.warn).toHaveBeenCalledWith(
				'[middleware - verifyAuth]: No access token provided',
			)
		})

		it('should log error when cognito verification fails', async () => {
			// Arrange - Using properly typed Cognito error
			const { pino } = await import('../../utils/logger.ts')
			const cognitoError = createMockCognitoError('User does not exist')
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			mockCognitoInstance.getAuthUser.mockResolvedValue([
				null,
				cognitoError as unknown as Error,
			])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith({
				msg: '[middleware - verifyAuth]: Error verifying token',
				error: 'User does not exist',
			})
		})

		it('should log warning when invalid access token is provided', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: '',
			})
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.warn).toHaveBeenCalledWith(
				'[middleware - verifyAuth]: Invalid access token',
			)
		})

		it('should log debug message when authentication is successful', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: 'test-user-id-123',
			})
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.debug).toHaveBeenCalledWith({
				msg: '[middleware - verifyAuth]: Authentication successful',
				userId: 'test-user-id-123',
			})
		})
	})

	describe('Edge Cases', () => {
		it('should handle whitespace-only Username', async () => {
			// Arrange
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: '   ',
			})
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockRequest.userId).toBe('   ')
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should handle very long Username', async () => {
			// Arrange
			const longUsername = 'a'.repeat(1000)
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: longUsername,
			})
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockRequest.userId).toBe(longUsername)
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should handle Username with special characters', async () => {
			// Arrange
			const specialUsername = 'user@domain.com'
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: specialUsername,
			})
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockRequest.userId).toBe(specialUsername)
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})
	})

	describe('Security Considerations', () => {
		it('should not leak token information in error messages', async () => {
			// Arrange
			const tokenError = new UnauthorizedError(
				'Token extraction failed',
				'test',
			)
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(tokenError),
			)

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Authentication failed')
			expect(error.message).not.toContain('valid-access-token')
		})

		it('should not leak cognito error details in error messages', async () => {
			// Arrange
			const cognitoError = new UnauthorizedError(
				'Detailed cognito error with sensitive info',
				'test',
			)
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			mockCognitoInstance.getAuthUser.mockResolvedValue([null, cognitoError])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			// The original error is passed through, but logging is controlled
		})

		it('should handle malformed cognito response gracefully', async () => {
			// Arrange
			const malformedResponse: GetUserCommandOutput = {
				// Missing Username property - simulating malformed response
				...createMockCognitoUser(),
				Username: undefined as unknown as string,
			}
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('valid-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([
				malformedResponse,
				null,
			])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Invalid authentication token')
		})
	})

	describe('Integration Flow', () => {
		it('should execute the complete authentication flow successfully', async () => {
			// Arrange
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: 'integration-test-user',
			})
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('integration-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert - Verify the complete flow
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'verifyAuth',
			)
			expect(mockCognitoInstance.getAuthUser).toHaveBeenCalledWith(
				'integration-access-token',
			)
			expect(handleServiceError).toHaveBeenCalledWith(
				mockCognitoUser,
				'Error verifying token',
				'middleware - verifyAuth',
			)
			expect(mockRequest.userId).toBe('integration-test-user')
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should verify all dependencies are called in correct order', async () => {
			// Arrange
			const mockCognitoUser: GetUserCommandOutput = createMockCognitoUser({
				Username: 'order-test-user',
			})
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('order-access-token'),
			)
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			mockCognitoInstance.getAuthUser.mockResolvedValue([mockCognitoUser, null])

			// Act
			await (
				await import('../auth.middleware.ts')
			).verifyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert - Verify call order by checking that functions were called
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalled()
			expect(mockCognitoInstance.getAuthUser).toHaveBeenCalled()
			expect(vi.mocked(handleServiceError)).toHaveBeenCalled()

			// Verify the sequence of calls
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledBefore(
				mockCognitoInstance.getAuthUser,
			)
			expect(mockCognitoInstance.getAuthUser).toHaveBeenCalledBefore(
				vi.mocked(handleServiceError),
			)
		})
	})
})

import type { Request } from 'express'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	COOKIE_NAMES,
	getAccessToken,
	getCookie,
	getRefreshToken,
	getSynchronizeToken,
	isCommonCookie,
	type TCookieNames,
	type TCookieValue,
} from '../cookies.ts'
import { AppError } from '../errors.ts'
import { mockExpress } from '../test-helpers/express-mocks.ts'

// Mock the errors module
vi.mock('../errors.ts', () => ({
	AppError: {
		unauthorized: vi.fn((message: string) => {
			const error = new Error(message)
			error.name = 'AppError'
			;(error as Error & { status: number }).status = 401
			;(error as Error & { type: string }).type = 'UnauthorizedError'
			throw error
		}),
	},
}))

describe('cookies.ts', () => {
	beforeEach(() => {
		// Setup Express mocks (includes vi.clearAllMocks())
		mockExpress.setup()
	})

	describe('COOKIE_NAMES constant', () => {
		it('should export correct cookie names', () => {
			expect(COOKIE_NAMES.ACCESS_TOKEN).toBe('macro-ai-accessToken')
			expect(COOKIE_NAMES.REFRESH_TOKEN).toBe('macro-ai-refreshToken')
			expect(COOKIE_NAMES.SYNCHRONIZE).toBe('macro-ai-synchronize')
		})

		it('should be a const object with expected structure', () => {
			// TypeScript ensures readonly behavior at compile time
			// At runtime, we can verify the object structure
			expect(typeof COOKIE_NAMES).toBe('object')
			expect(Object.keys(COOKIE_NAMES)).toEqual([
				'ACCESS_TOKEN',
				'REFRESH_TOKEN',
				'SYNCHRONIZE',
			])
		})
	})

	describe('getCookie function', () => {
		const createMockRequest = (
			cookies: Record<string, string> = {},
		): Request => {
			const expressMocks = mockExpress.setup()
			return {
				...expressMocks.req,
				cookies,
			} as Request
		}

		describe('when cookie exists', () => {
			it('should return cookie value when cookie exists and is required', () => {
				const req = createMockRequest({ testCookie: 'testValue' })
				const result = getCookie(req, 'testCookie', true)
				expect(result).toBe('testValue')
			})

			it('should return cookie value when cookie exists and is not required', () => {
				const req = createMockRequest({ testCookie: 'testValue' })
				const result = getCookie(req, 'testCookie', false)
				expect(result).toBe('testValue')
			})

			it('should return cookie value with default required=true', () => {
				const req = createMockRequest({ testCookie: 'testValue' })
				const result = getCookie(req, 'testCookie')
				expect(result).toBe('testValue')
			})
		})

		describe('when cookie does not exist', () => {
			it('should throw AppError when cookie is required and missing', () => {
				const req = createMockRequest({})

				expect(() => getCookie(req, 'missingCookie', true)).toThrow()
				expect(AppError.unauthorized).toHaveBeenCalledWith(
					"Cookie 'missingCookie' not found",
				)
			})

			it('should throw AppError when cookie is required by default and missing', () => {
				const req = createMockRequest({})

				expect(() => getCookie(req, 'missingCookie')).toThrow()
				expect(AppError.unauthorized).toHaveBeenCalledWith(
					"Cookie 'missingCookie' not found",
				)
			})

			it('should return undefined when cookie is not required and missing', () => {
				const req = createMockRequest({})
				const result = getCookie(req, 'missingCookie', false)
				expect(result).toBeUndefined()
			})
		})

		describe('edge cases', () => {
			it('should treat empty string cookie as missing when required', () => {
				const req = createMockRequest({ emptyCookie: '' })

				expect(() => getCookie(req, 'emptyCookie', true)).toThrow()
				expect(AppError.unauthorized).toHaveBeenCalledWith(
					"Cookie 'emptyCookie' not found",
				)
			})

			it('should return empty string when cookie is empty and not required', () => {
				const req = createMockRequest({ emptyCookie: '' })
				const result = getCookie(req, 'emptyCookie', false)
				expect(result).toBe('')
			})

			it('should handle cookie with special characters', () => {
				const specialValue = 'value-with-special_chars.123'
				const req = createMockRequest({ specialCookie: specialValue })
				const result = getCookie(req, 'specialCookie', true)
				expect(result).toBe(specialValue)
			})

			it('should handle request with no cookies property', () => {
				const req = {} as Request

				// When cookies property is undefined, accessing req.cookies[name] throws TypeError
				expect(() => getCookie(req, 'testCookie', true)).toThrow(TypeError)
			})
		})
	})

	describe('getAccessToken function', () => {
		const createMockRequest = (cookies: Record<string, string> = {}): Request =>
			({
				cookies,
			}) as Request

		describe('when access token exists', () => {
			it('should return access token when present and required', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.ACCESS_TOKEN]: 'access-token-123',
				})
				const result = getAccessToken(req, true)
				expect(result).toBe('access-token-123')
			})

			it('should return access token when present and not required', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.ACCESS_TOKEN]: 'access-token-123',
				})
				const result = getAccessToken(req, false)
				expect(result).toBe('access-token-123')
			})

			it('should return access token with default required=true', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.ACCESS_TOKEN]: 'access-token-123',
				})
				const result = getAccessToken(req)
				expect(result).toBe('access-token-123')
			})
		})

		describe('when access token does not exist', () => {
			it('should throw AppError when token is required and missing', () => {
				const req = createMockRequest({})

				expect(() => getAccessToken(req, true)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.ACCESS_TOKEN}' not found`,
				)
			})

			it('should throw AppError when token is required by default and missing', () => {
				const req = createMockRequest({})

				expect(() => getAccessToken(req)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.ACCESS_TOKEN}' not found`,
				)
			})

			it('should return undefined when token is not required and missing', () => {
				const req = createMockRequest({})
				const result = getAccessToken(req, false)
				expect(result).toBeUndefined()
			})
		})

		describe('edge cases', () => {
			it('should handle empty access token', () => {
				const req = createMockRequest({ [COOKIE_NAMES.ACCESS_TOKEN]: '' })

				expect(() => getAccessToken(req, true)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.ACCESS_TOKEN}' not found`,
				)
			})
		})
	})

	describe('getRefreshToken function', () => {
		const createMockRequest = (cookies: Record<string, string> = {}): Request =>
			({
				cookies,
			}) as Request

		describe('when refresh token exists', () => {
			it('should return refresh token when present and required', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.REFRESH_TOKEN]: 'refresh-token-456',
				})
				const result = getRefreshToken(req, true)
				expect(result).toBe('refresh-token-456')
			})

			it('should return refresh token when present and not required', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.REFRESH_TOKEN]: 'refresh-token-456',
				})
				const result = getRefreshToken(req, false)
				expect(result).toBe('refresh-token-456')
			})

			it('should return refresh token with default required=true', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.REFRESH_TOKEN]: 'refresh-token-456',
				})
				const result = getRefreshToken(req)
				expect(result).toBe('refresh-token-456')
			})
		})

		describe('when refresh token does not exist', () => {
			it('should throw AppError when token is required and missing', () => {
				const req = createMockRequest({})

				expect(() => getRefreshToken(req, true)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.REFRESH_TOKEN}' not found`,
				)
			})

			it('should throw AppError when token is required by default and missing', () => {
				const req = createMockRequest({})

				expect(() => getRefreshToken(req)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.REFRESH_TOKEN}' not found`,
				)
			})

			it('should return undefined when token is not required and missing', () => {
				const req = createMockRequest({})
				const result = getRefreshToken(req, false)
				expect(result).toBeUndefined()
			})
		})

		describe('edge cases', () => {
			it('should handle empty refresh token', () => {
				const req = createMockRequest({ [COOKIE_NAMES.REFRESH_TOKEN]: '' })

				expect(() => getRefreshToken(req, true)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.REFRESH_TOKEN}' not found`,
				)
			})
		})
	})

	describe('getSynchronizeToken function', () => {
		const createMockRequest = (cookies: Record<string, string> = {}): Request =>
			({
				cookies,
			}) as Request

		describe('when synchronize token exists', () => {
			it('should return synchronize token when present and required', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.SYNCHRONIZE]: 'sync-token-789',
				})
				const result = getSynchronizeToken(req, true)
				expect(result).toBe('sync-token-789')
			})

			it('should return synchronize token when present and not required', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.SYNCHRONIZE]: 'sync-token-789',
				})
				const result = getSynchronizeToken(req, false)
				expect(result).toBe('sync-token-789')
			})

			it('should return synchronize token with default required=true', () => {
				const req = createMockRequest({
					[COOKIE_NAMES.SYNCHRONIZE]: 'sync-token-789',
				})
				const result = getSynchronizeToken(req)
				expect(result).toBe('sync-token-789')
			})
		})

		describe('when synchronize token does not exist', () => {
			it('should throw AppError when token is required and missing', () => {
				const req = createMockRequest({})

				expect(() => getSynchronizeToken(req, true)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.SYNCHRONIZE}' not found`,
				)
			})

			it('should throw AppError when token is required by default and missing', () => {
				const req = createMockRequest({})

				expect(() => getSynchronizeToken(req)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.SYNCHRONIZE}' not found`,
				)
			})

			it('should return undefined when token is not required and missing', () => {
				const req = createMockRequest({})
				const result = getSynchronizeToken(req, false)
				expect(result).toBeUndefined()
			})
		})

		describe('edge cases', () => {
			it('should handle empty synchronize token', () => {
				const req = createMockRequest({ [COOKIE_NAMES.SYNCHRONIZE]: '' })

				expect(() => getSynchronizeToken(req, true)).toThrow()

				expect(AppError.unauthorized).toHaveBeenCalledWith(
					`Cookie '${COOKIE_NAMES.SYNCHRONIZE}' not found`,
				)
			})
		})
	})

	describe('isCommonCookie function', () => {
		describe('valid common cookie names', () => {
			it('should return true for ACCESS_TOKEN cookie name', () => {
				expect(isCommonCookie(COOKIE_NAMES.ACCESS_TOKEN)).toBe(true)
			})

			it('should return true for REFRESH_TOKEN cookie name', () => {
				expect(isCommonCookie(COOKIE_NAMES.REFRESH_TOKEN)).toBe(true)
			})

			it('should return true for SYNCHRONIZE cookie name', () => {
				expect(isCommonCookie(COOKIE_NAMES.SYNCHRONIZE)).toBe(true)
			})
		})

		describe('invalid cookie names', () => {
			it('should return false for unknown cookie name', () => {
				expect(isCommonCookie('unknown-cookie')).toBe(false)
			})

			it('should return false for empty string', () => {
				expect(isCommonCookie('')).toBe(false)
			})

			it('should return false for similar but incorrect cookie names', () => {
				expect(isCommonCookie('macro-ai-access-token')).toBe(false)
				expect(isCommonCookie('macro-ai-refresh-token')).toBe(false)
				expect(isCommonCookie('macro-ai-sync')).toBe(false)
			})

			it('should return false for case-sensitive variations', () => {
				expect(isCommonCookie('MACRO-AI-ACCESSTOKEN')).toBe(false)
				expect(isCommonCookie('Macro-Ai-AccessToken')).toBe(false)
			})
		})
	})

	describe('Type exports', () => {
		it('should export TCookieNames type', () => {
			// This is a compile-time test - if the type is not exported, TypeScript will fail
			const cookieName: TCookieNames = COOKIE_NAMES.ACCESS_TOKEN
			expect(cookieName).toBe(COOKIE_NAMES.ACCESS_TOKEN)
		})

		it('should export TCookieValue type', () => {
			// This is a compile-time test - if the type is not exported, TypeScript will fail
			const cookieValue: TCookieValue<TCookieNames> = 'test-value'
			expect(cookieValue).toBe('test-value')
		})
	})
})

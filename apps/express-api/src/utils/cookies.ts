import { Request } from 'express'

import { AppError } from './errors.ts'

// Common cookie names as const for type inference
const COOKIE_NAMES = {
	ACCESS_TOKEN: 'macro-ai-accessToken',
	REFRESH_TOKEN: 'macro-ai-refreshToken',
	SYNCHRONIZE: 'macro-ai-synchronize',
} as const

// Type for common cookie names
type TCookieNames = (typeof COOKIE_NAMES)[keyof typeof COOKIE_NAMES]

// Generic type for cookie extraction
type TCookieValue<T> = T extends TCookieNames ? string : unknown

/**
 * Extracts a cookie value from the request
 * @param req Express request object
 * @param name Cookie name
 * @param required Whether the cookie is required (throws if missing)
 * @returns Cookie value or undefined if not required and not found
 * @throws AppError if cookie is required and missing
 */
const getCookie = <T extends string>(
	req: Request,
	name: T,
	required = true,
): T extends TCookieNames ? string : string | undefined => {
	const cookie = req.cookies[name] as string | undefined

	if (!cookie && required) {
		throw AppError.unauthorized(`Cookie '${name}' not found`)
	}

	return cookie as T extends TCookieNames ? string : string | undefined
}

/**
 * Extracts the access token from cookies
 * @param req Express request object
 * @param required Whether the token is required (throws if missing)
 * @returns Access token string
 * @throws AppError if token is required and missing
 */
const getAccessToken = (req: Request, required = true): string => {
	return getCookie(req, COOKIE_NAMES.ACCESS_TOKEN, required)
}

/**
 * Extracts the refresh token from cookies
 * @param req Express request object
 * @param required Whether the token is required (throws if missing)
 * @returns Refresh token string
 * @throws AppError if token is required and missing
 */
const getRefreshToken = (req: Request, required = true): string => {
	return getCookie(req, COOKIE_NAMES.REFRESH_TOKEN, required)
}

/**
 * Extracts the synchronize token from cookies
 * @param req Express request object
 * @param required Whether the token is required (throws if missing)
 * @returns Synchronize token string
 * @throws AppError if token is required and missing
 */
const getSynchronizeToken = (req: Request, required = true): string => {
	return getCookie(req, COOKIE_NAMES.SYNCHRONIZE, required)
}

/**
 * Type guard to check if a cookie name is a common cookie
 * @param name Cookie name to check
 * @returns Boolean indicating if the cookie name is common
 */
const isCommonCookie = (name: string): name is TCookieNames => {
	return Object.values(COOKIE_NAMES).includes(name as TCookieNames)
}

export {
	COOKIE_NAMES,
	getAccessToken,
	getCookie,
	getRefreshToken,
	getSynchronizeToken,
	isCommonCookie,
}
export type { TCookieNames, TCookieValue }

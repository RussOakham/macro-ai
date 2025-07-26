// Unified client - auto-generated, do not edit manually
import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'

import { authEndpoints } from './auth.client'
import { chatEndpoints } from './chat.client'
import { userEndpoints } from './user.client'

// Combines all domain endpoints into a single client for backward compatibility
export const endpoints = makeApi([
	...authEndpoints,
	...chatEndpoints,
	...userEndpoints,
])

export const api = new Zodios(endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, endpoints, options)
}

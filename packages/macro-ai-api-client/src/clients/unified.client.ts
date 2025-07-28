// Unified client - auto-generated, do not edit manually
import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'

import { authEndpoints } from './auth.client.js'
import { chatEndpoints } from './chat.client.js'
import { userEndpoints } from './user.client.js'

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

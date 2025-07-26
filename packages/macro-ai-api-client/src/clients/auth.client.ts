import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'

const authEndpoints = makeApi([])

export const authClient = new Zodios(authEndpoints)

export function createAuthClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, authEndpoints, options)
}

export { authEndpoints }

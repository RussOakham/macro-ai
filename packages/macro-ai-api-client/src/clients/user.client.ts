import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'

const userEndpoints = makeApi([])

export const userClient = new Zodios(userEndpoints)

export function createUserClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, userEndpoints, options)
}

export { userEndpoints }

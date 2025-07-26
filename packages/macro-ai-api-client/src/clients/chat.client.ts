import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'

const chatEndpoints = makeApi([])

export const chatClient = new Zodios(chatEndpoints)

export function createChatClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, chatEndpoints, options)
}

export { chatEndpoints }

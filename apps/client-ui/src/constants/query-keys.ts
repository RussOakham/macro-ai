// Definition: Constants for query keys
// Types: Type inferred from the object keys and consumed from types/index.ts
const QUERY_KEY = {
	authUser: 'authUser',
	user: 'user',
	chat: 'chat',
	messages: 'messages',
} as const

const QUERY_KEY_MODIFIERS = {
	list: 'list',
	detail: 'detail',
} as const

export { QUERY_KEY, QUERY_KEY_MODIFIERS }

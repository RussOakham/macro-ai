// Definition: Constants for query keys
// Types: Type inferred from the object keys and consumed from types/index.ts
const QUERY_KEY = {
	authUser: 'authUser',
	chat: 'chat',
	messages: 'messages',
	user: 'user',
} as const

const QUERY_KEY_MODIFIERS = {
	detail: 'detail',
	list: 'list',
} as const

export { QUERY_KEY, QUERY_KEY_MODIFIERS }

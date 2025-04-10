import { QUERY_KEY } from '@/constants/query-keys'

// Type QueryKey = 'user' | 'chat' | 'messages'
type QueryKey = keyof typeof QUERY_KEY

// Type for the values (if needed): "user" | "chat" | "messages"
type QueryKeyValue = (typeof QUERY_KEY)[QueryKey]

export type { QueryKey, QueryKeyValue }

// ============================================================================
// Chat Types - Using API Client Types for Type Safety and Consistency
// ============================================================================

import type {
	ChatDeleteChatsByIdResponse,
	ChatGetChatsByIdResponse,
	ChatGetChatsResponse,
	ChatPostChatsByIdStreamRequest,
	ChatPostChatsRequest,
	ChatPostChatsResponse,
	ChatPutChatsByIdRequest,
	ChatPutChatsByIdResponse,
} from '@repo/macro-ai-api-client'

// ============================================================================
// Re-export API Client Types for Convenience
// ============================================================================

// Request types
export type {
	ChatPostChatsByIdStreamRequest,
	ChatPostChatsRequest,
	ChatPutChatsByIdRequest,
}

// Response types
export type {
	ChatDeleteChatsByIdResponse,
	ChatGetChatsByIdResponse,
	ChatGetChatsResponse,
	ChatPostChatsResponse,
	ChatPutChatsByIdResponse,
}

// ============================================================================
// Derived Types for Frontend Use
// ============================================================================

// Extract Chat type from API response
export type Chat = ChatGetChatsResponse['data'][0]

// Extract pagination metadata type
export type PaginationMeta = NonNullable<ChatGetChatsResponse['meta']>

// Pagination options for requests
export interface PaginationOptions {
	page?: number
	limit?: number
}

// Generic API response wrapper (inferred from API client types)
export interface ApiResponse<T> {
	success: boolean
	data: T
	meta?: PaginationMeta
}

// Chat list response (alias for convenience)
export type ChatListResponse = ChatGetChatsResponse

// ============================================================================
// Frontend-Specific Types
// ============================================================================

// Chat with transformed dates for frontend use
export interface ChatWithDates {
	id: string
	userId: string
	title: string
	createdAt: Date
	updatedAt: Date
}

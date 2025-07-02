// ============================================================================
// Chat Types - Frontend (Aligned with Backend API)
// ============================================================================

// Chat interface - matches backend TChat from chat.schemas.ts
interface Chat {
	id: string
	userId: string
	title: string
	createdAt: Date
	updatedAt: Date
}

// Pagination options - matches backend PaginationOptions
interface PaginationOptions {
	page?: number
	limit?: number
}

// ============================================================================
// API Response Types - Matches Backend Response Schemas
// ============================================================================

// Generic API response wrapper - matches backend pattern
interface ApiResponse<T> {
	success: boolean
	data: T
	meta?: {
		page: number
		limit: number
		total: number
	}
}

// Chat list response - matches backend ChatListResponse
type ChatListResponse = ApiResponse<Chat[]>

// ============================================================================
// Exports
// ============================================================================

export type { ApiResponse, Chat, ChatListResponse, PaginationOptions }

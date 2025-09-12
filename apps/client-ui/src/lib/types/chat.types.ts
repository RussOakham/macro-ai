// ============================================================================
// Derived Types for Frontend Use
// ============================================================================

import type { GetChatsResponse } from '@repo/macro-ai-api-client'

// Generic API response wrapper (inferred from API client types)
export interface ApiResponse<T> {
	data: T
	meta?: PaginationMeta
	success: boolean
}

// Chat with transformed dates for frontend use
export interface ChatWithDates {
	createdAt: Date
	id: string
	title: string
	updatedAt: Date
	userId: string
}

// Extract pagination metadata type
export type PaginationMeta = NonNullable<GetChatsResponse['meta']>

// ============================================================================
// Frontend-Specific Types
// ============================================================================

// Pagination options for requests
export interface PaginationOptions {
	limit?: number
	page?: number
}

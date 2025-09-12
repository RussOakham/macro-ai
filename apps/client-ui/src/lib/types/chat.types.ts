// ============================================================================
// Derived Types for Frontend Use
// ============================================================================

import type { GetChatsResponse } from '@repo/macro-ai-api-client'

// Extract pagination metadata type
export type PaginationMeta = NonNullable<GetChatsResponse['meta']>

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

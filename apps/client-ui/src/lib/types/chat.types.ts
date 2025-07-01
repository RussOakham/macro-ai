// ============================================================================
// Chat Types - Frontend (Aligned with Backend API)
// ============================================================================

// Chat interface - matches backend TChat from chat.schemas.ts
interface Chat {
	id: string
	userId: string
	title: string
	messages: Message[] // old message interface - to be removed
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
// Zustand Store Types (UI State Only)
// ============================================================================

// Zustand store interface - only for UI-specific state
interface ChatStore {
	chats: Chat[]
	currentChatId: string | null
	addChat: (chat: Chat) => void
	updateChat: (chatId: string, updates: Partial<Chat>) => void
	deleteChat: (chatId: string) => void
	setCurrentChat: (chatId: string | null) => void
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	addMessage: (chatId: string, message: any) => void // Keep for backward compatibility
}

// Old message interface - to be removed
interface Message {
	id: string
	role: 'user' | 'assistant'
	content: string
	timestamp: Date
}

// ============================================================================
// Exports
// ============================================================================

export type {
	ApiResponse,
	Chat,
	ChatListResponse,
	ChatStore,
	Message,
	PaginationOptions,
}

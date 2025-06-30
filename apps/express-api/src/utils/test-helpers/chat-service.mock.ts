import { vi } from 'vitest'

// Type inference helper - this will be used inside functions to avoid hoisting issues
type ChatServiceType =
	typeof import('../../features/chat/chat.service.ts').chatService

// Type inference from actual chatService instance - following established pattern
// This ensures our mocks stay in sync with the real implementation
type MockChatServiceType = {
	[K in keyof ChatServiceType]: ReturnType<typeof vi.fn>
}

/**
 * Reusable mock for ChatService supporting service method mocking
 *
 * Service Method Mock Usage (for controller tests):
 * ```typescript
 * import { mockChatService } from '../../utils/test-helpers/chat-service.mock.ts'
 *
 * vi.mock('../chat.service.ts', () => mockChatService.createModule())
 *
 * describe('Chat Controller', () => {
 *   let chatMocks: ReturnType<typeof mockChatService.setup>
 *
 *   beforeEach(() => {
 *     chatMocks = mockChatService.setup()
 *   })
 *
 *   it('should test something', () => {
 *     const mockChat = mockChatService.createChat({ title: 'Test Chat' })
 *     chatMocks.getUserChats.mockResolvedValue([{ chats: [mockChat], total: 1 }, null])
 *   })
 * })
 * ```
 */

/**
 * Creates a basic service mock with all methods
 * Use this for creating fresh mock instances
 * Creates mocks for all known ChatService methods based on the type inference
 */
export const createChatServiceMock = (): MockChatServiceType => {
	// Create mocks for all known methods - these are inferred from the type
	// This maintains type safety while avoiding hoisting issues
	return {
		getUserChats: vi.fn(),
		createChat: vi.fn(),
		getChatWithMessages: vi.fn(),
		verifyChatOwnership: vi.fn(),
		updateChat: vi.fn(),
		deleteChat: vi.fn(),
		sendMessage: vi.fn(),
		sendMessageStreaming: vi.fn(),
		updateMessageContent: vi.fn(),
		semanticSearch: vi.fn(),
	} as MockChatServiceType
}

/**
 * Creates a mock factory for vi.mock() to mock the ChatService
 * Use this for controller tests that use the ChatService
 */
export const createServiceMock = (): {
	chatService: MockChatServiceType
} => {
	const serviceMock = createChatServiceMock()

	return {
		chatService: serviceMock,
	}
}

/**
 * Sets up and returns the service method mocks for easy access in tests
 * Use this in beforeEach for controller tests
 */
export const setupServiceMock = (): MockChatServiceType => {
	vi.clearAllMocks()
	return createChatServiceMock()
}

/**
 * Creates a mock TChat object with proper defaults
 * Use this to create consistent chat test data
 */
export const createMockChat = (
	overrides: Partial<{
		id: string
		userId: string
		title: string
		createdAt: Date
		updatedAt: Date
	}> = {},
) => ({
	id: '987fcdeb-51a2-43d1-9f12-123456789abc',
	userId: '123e4567-e89b-12d3-a456-426614174000',
	title: 'Test Chat',
	createdAt: new Date('2024-01-01T00:00:00Z'),
	updatedAt: new Date('2024-01-01T00:00:00Z'),
	...overrides,
})

/**
 * Creates a mock TChatMessage object with proper defaults
 * Use this to create consistent message test data
 */
export const createMockMessage = (
	overrides: Partial<{
		id: string
		chatId: string
		role: 'user' | 'assistant' | 'system'
		content: string
		metadata: Record<string, unknown>
		embedding: number[] | null
		createdAt: Date
	}> = {},
) => ({
	id: 'msg-123',
	chatId: '987fcdeb-51a2-43d1-9f12-123456789abc',
	role: 'user' as const,
	content: 'Hello, world!',
	metadata: {},
	embedding: null,
	createdAt: new Date('2024-01-01T00:00:00Z'),
	...overrides,
})

/**
 * Creates a mock ChatWithMessages object with proper defaults
 * Use this to create consistent chat with messages test data
 */
export const createMockChatWithMessages = (
	overrides: Partial<{
		id: string
		userId: string
		title: string
		createdAt: Date
		updatedAt: Date
		messages: ReturnType<typeof createMockMessage>[]
	}> = {},
) => {
	const baseChat = createMockChat(overrides)
	const defaultMessages = [createMockMessage({ chatId: baseChat.id })]

	return {
		...baseChat,
		messages: overrides.messages ?? defaultMessages,
	}
}

/**
 * Creates a mock TInsertChat object with proper defaults
 * Use this to create consistent chat insertion test data
 */
export const createMockInsertChat = (
	overrides: Partial<{
		id?: string
		userId: string
		title: string
	}> = {},
) => ({
	id: '987fcdeb-51a2-43d1-9f12-123456789abc',
	userId: '123e4567-e89b-12d3-a456-426614174000',
	title: 'Test Chat',
	...overrides,
})

/**
 * Creates a mock pagination result for getUserChats
 * Use this to create consistent paginated chat results
 */
export const createMockChatsPagination = (
	overrides: Partial<{
		chats: ReturnType<typeof createMockChat>[]
		total: number
	}> = {},
) => ({
	chats: overrides.chats ?? [createMockChat()],
	total: overrides.total ?? 1,
})

/**
 * Creates a mock semantic search result
 * Use this to create consistent search result test data
 */
export const createMockSemanticSearchResult = (
	overrides: Partial<{
		chatId: string
		messageId: string
		content: string
		similarity: number
		metadata: Record<string, unknown>
		createdAt: Date
	}> = {},
) => ({
	chatId: '987fcdeb-51a2-43d1-9f12-123456789abc',
	messageId: 'msg-123',
	content: 'Hello, world!',
	similarity: 0.95,
	metadata: {},
	createdAt: new Date('2024-01-01T00:00:00Z'),
	...overrides,
})

/**
 * Unified export object supporting service method mocking
 * Following the established pattern from other mock helpers
 */
export const mockChatService = {
	// Core factory functions
	create: createChatServiceMock,
	createModule: createServiceMock,
	setup: setupServiceMock,

	// Mock data creators
	createChat: createMockChat,
	createMessage: createMockMessage,
	createChatWithMessages: createMockChatWithMessages,
	createInsertChat: createMockInsertChat,
	createChatsPagination: createMockChatsPagination,
	createSemanticSearchResult: createMockSemanticSearchResult,
}

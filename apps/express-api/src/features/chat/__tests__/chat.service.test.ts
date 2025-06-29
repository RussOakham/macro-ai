import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	InternalError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from '../../../utils/errors.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'

// Mock dependencies
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../../utils/error-handling/try-catch.ts', () => ({
	tryCatch: vi.fn(),
	tryCatchSync: vi.fn(),
}))

// Import types for proper typing
import type { AIService } from '../ai.service.ts'
import type {
	IChatRepository,
	IMessageRepository,
	TChat,
	TChatMessage,
} from '../chat.types.ts'
import type { VectorService } from '../vector.service.ts'

// Create type-safe mocks using Pick to only include public methods
type MockAIService = Pick<
	AIService,
	| 'generateResponse'
	| 'generateStreamingResponse'
	| 'generateEmbedding'
	| 'generateEmbeddings'
	| 'generateEmbeddingsBatch'
	| 'validateMessages'
	| 'getModelConfig'
>

type MockVectorService = Pick<
	VectorService,
	| 'createMessageEmbedding'
	| 'createMessageEmbeddingsBatch'
	| 'semanticSearch'
	| 'deleteMessageEmbedding'
	| 'deleteChatEmbeddings'
	| 'getUserEmbeddings'
	| 'getChatEmbeddings'
>

// Create properly typed mock AI Service with vi.fn() return types
const mockAIService = {
	generateResponse: vi.fn(),
	generateStreamingResponse: vi.fn(),
	generateEmbedding: vi.fn(),
	generateEmbeddings: vi.fn(),
	generateEmbeddingsBatch: vi.fn(),
	validateMessages: vi.fn(),
	getModelConfig: vi.fn(),
} satisfies MockAIService

// Create properly typed mock Vector Service with vi.fn() return types
const mockVectorService = {
	createMessageEmbedding: vi.fn(),
	createMessageEmbeddingsBatch: vi.fn(),
	semanticSearch: vi.fn(),
	deleteMessageEmbedding: vi.fn(),
	deleteChatEmbeddings: vi.fn(),
	getUserEmbeddings: vi.fn(),
	getChatEmbeddings: vi.fn(),
} satisfies MockVectorService

// Create properly typed mock Chat Repository with vi.fn() return types
const mockChatRepository = {
	findChatById: vi.fn(),
	findChatsByUserId: vi.fn(),
	createChat: vi.fn(),
	updateChat: vi.fn(),
	deleteChat: vi.fn(),
	verifyChatOwnership: vi.fn(),
	updateChatTimestamp: vi.fn(),
} satisfies IChatRepository

// Create properly typed mock Message Repository with vi.fn() return types
const mockMessageRepository = {
	findMessageById: vi.fn(),
	findMessagesByChatId: vi.fn(),
	createMessage: vi.fn(),
	updateMessage: vi.fn(),
	deleteMessage: vi.fn(),
	getChatHistory: vi.fn(),
} satisfies IMessageRepository

// Import after mocking
import { tryCatchSync } from '../../../utils/error-handling/try-catch.ts'
import { ChatService } from '../chat.service.ts'

describe('ChatService (Refactored)', () => {
	let chatService: ChatService

	// Mock data
	const mockUserId = 'user-123'
	const mockChatId = 'chat-456'
	const mockMessageId = 'message-789'

	const mockChat: TChat = {
		id: mockChatId,
		userId: mockUserId,
		title: 'Test Chat',
		createdAt: new Date('2023-01-01'),
		updatedAt: new Date('2023-01-01'),
	}

	const mockChatMessage: TChatMessage = {
		id: mockMessageId,
		chatId: mockChatId,
		role: 'user',
		content: 'Hello, world!',
		metadata: {},
		embedding: null,
		createdAt: new Date('2023-01-01'),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		chatService = new ChatService(
			mockAIService as unknown as AIService,
			mockVectorService as unknown as VectorService,
			mockChatRepository,
			mockMessageRepository,
		)
	})

	describe('verifyChatOwnership', () => {
		it('should return true when user owns the chat', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])

			// Act
			const [result, error] = await chatService.verifyChatOwnership(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(mockChatRepository.verifyChatOwnership).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
			)
			expect(result).toBe(true)
			expect(error).toBeNull()
		})

		it('should return false when user does not own the chat', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([false, null])

			// Act
			const [result, error] = await chatService.verifyChatOwnership(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBe(false)
			expect(error).toBeNull()
		})

		it('should return error when repository fails', async () => {
			// Arrange
			const mockError = new InternalError('Database error', 'test')
			mockChatRepository.verifyChatOwnership.mockResolvedValue([
				null,
				mockError,
			])

			// Act
			const [result, error] = await chatService.verifyChatOwnership(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(mockError)
		})
	})

	describe('createChat', () => {
		it('should create a chat successfully', async () => {
			// Arrange
			const createRequest = { userId: mockUserId, title: 'New Chat' }

			vi.mocked(tryCatchSync).mockReturnValue([createRequest, null])
			mockChatRepository.createChat.mockResolvedValue([mockChat, null])

			// Act
			const [result, error] = await chatService.createChat(createRequest)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'chatService - validateCreateChatRequest',
			)
			expect(mockChatRepository.createChat).toHaveBeenCalledWith({
				userId: createRequest.userId,
				title: createRequest.title,
			})
			expect(result).toEqual(mockChat)
			expect(error).toBeNull()
		})

		it('should return validation error for invalid request', async () => {
			// Arrange
			const invalidRequest = { userId: '', title: '' }
			const validationError = new ValidationError(
				'Valid userId is required',
				undefined,
				'chatService',
			)

			vi.mocked(tryCatchSync).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await chatService.createChat(invalidRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(validationError)
		})

		it('should return error when repository fails', async () => {
			// Arrange
			const createRequest = { userId: mockUserId, title: 'New Chat' }
			const repositoryError = new InternalError('Repository error', 'test')

			vi.mocked(tryCatchSync).mockReturnValue([createRequest, null])
			mockChatRepository.createChat.mockResolvedValue([null, repositoryError])

			// Act
			const [result, error] = await chatService.createChat(createRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(repositoryError)
		})
	})

	describe('getUserChats', () => {
		it('should return user chats with pagination', async () => {
			// Arrange
			const expectedResult = { chats: [mockChat], total: 1 }
			mockChatRepository.findChatsByUserId.mockResolvedValue([
				expectedResult,
				null,
			])

			// Act
			const [result, error] = await chatService.getUserChats(mockUserId, {
				page: 1,
				limit: 20,
			})

			// Assert
			expect(mockChatRepository.findChatsByUserId).toHaveBeenCalledWith(
				mockUserId,
				{ page: 1, limit: 20 },
			)
			expect(result).toEqual(expectedResult)
			expect(error).toBeNull()
		})

		it('should return validation error for invalid pagination', async () => {
			// Act
			const [result, error] = await chatService.getUserChats(mockUserId, {
				page: 0,
				limit: 101,
			})

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(ValidationError)
			expect(error?.message).toBe('Invalid pagination parameters')
		})
	})

	describe('getChatWithMessages', () => {
		it('should return chat with messages when user owns chat', async () => {
			// Arrange
			const mockMessages = [mockChatMessage]

			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockChatRepository.findChatById.mockResolvedValue([mockChat, null])
			mockMessageRepository.findMessagesByChatId.mockResolvedValue([
				mockMessages,
				null,
			])

			// Act
			const [result, error] = await chatService.getChatWithMessages(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(mockChatRepository.verifyChatOwnership).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
			)
			expect(mockChatRepository.findChatById).toHaveBeenCalledWith(mockChatId)
			expect(mockMessageRepository.findMessagesByChatId).toHaveBeenCalledWith(
				mockChatId,
			)
			expect(result).toEqual({
				...mockChat,
				messages: mockMessages,
			})
			expect(error).toBeNull()
		})

		it('should return unauthorized error when user does not own chat', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([false, null])

			// Act
			const [result, error] = await chatService.getChatWithMessages(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(UnauthorizedError)
			expect(error?.message).toBe('User does not have access to this chat')
		})

		it('should return not found error when chat does not exist', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockChatRepository.findChatById.mockResolvedValue([undefined, null])

			// Act
			const [result, error] = await chatService.getChatWithMessages(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(NotFoundError)
			expect(error?.message).toBe('Chat not found')
		})
	})

	describe('sendMessage', () => {
		it('should send message and get AI response successfully', async () => {
			// Arrange
			const sendRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI',
				role: 'user' as const,
			}

			const mockUserMessage = { ...mockChatMessage, content: 'Hello AI' }
			const mockAIMessage = {
				...mockChatMessage,
				id: 'ai-message-123',
				role: 'assistant',
				content: 'Hello human!',
			}
			const mockChatHistory = [{ role: 'user' as const, content: 'Hello AI' }]

			// Mock validation
			vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])

			// Mock repository calls
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockMessageRepository.createMessage
				.mockResolvedValueOnce([mockUserMessage, null]) // User message
				.mockResolvedValueOnce([mockAIMessage, null]) // AI message
			mockMessageRepository.getChatHistory.mockResolvedValue([
				mockChatHistory,
				null,
			])
			mockChatRepository.updateChatTimestamp.mockResolvedValue([
				undefined,
				null,
			])

			// Mock AI service
			mockAIService.generateResponse.mockResolvedValue(['Hello human!', null])

			// Mock vector service
			mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])

			// Act
			const [result, error] = await chatService.sendMessage(sendRequest)

			// Assert
			expect(mockAIService.generateResponse).toHaveBeenCalledWith(
				mockChatHistory,
			)
			expect(mockVectorService.createMessageEmbedding).toHaveBeenCalledTimes(2) // User and AI messages
			expect(result).toEqual({
				userMessage: mockUserMessage,
				aiResponse: mockAIMessage,
			})
			expect(error).toBeNull()
		})

		it('should return validation error for invalid message request', async () => {
			// Arrange
			const invalidRequest = { chatId: '', userId: '', content: '' }
			const validationError = new ValidationError(
				'Valid chatId is required',
				undefined,
				'chatService',
			)

			vi.mocked(tryCatchSync).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await chatService.sendMessage(invalidRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(validationError)
		})

		it('should return unauthorized error when user does not own chat', async () => {
			// Arrange
			const sendRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI',
			}

			vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
			mockChatRepository.verifyChatOwnership.mockResolvedValue([false, null])

			// Act
			const [result, error] = await chatService.sendMessage(sendRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(UnauthorizedError)
		})
	})

	describe('deleteChat', () => {
		it('should delete chat successfully when user owns it', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockVectorService.deleteChatEmbeddings.mockResolvedValue([
				undefined,
				null,
			])
			mockChatRepository.deleteChat.mockResolvedValue([undefined, null])

			// Act
			const [result, error] = await chatService.deleteChat(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(mockChatRepository.verifyChatOwnership).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
			)
			expect(mockVectorService.deleteChatEmbeddings).toHaveBeenCalledWith(
				mockChatId,
			)
			expect(mockChatRepository.deleteChat).toHaveBeenCalledWith(mockChatId)
			expect(result).toBeUndefined()
			expect(error).toBeNull()
		})

		it('should return unauthorized error when user does not own chat', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([false, null])

			// Act
			const [result, error] = await chatService.deleteChat(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(UnauthorizedError)
			expect(error?.message).toBe('User does not have access to this chat')
		})
	})

	describe('semanticSearch', () => {
		it('should delegate to vector service', async () => {
			// Arrange
			const searchOptions = {
				query: 'test query',
				userId: mockUserId,
				limit: 10,
				threshold: 0.7,
			}
			const mockResults = [
				{
					chatId: mockChatId,
					messageId: mockMessageId,
					content: 'test content',
					similarity: 0.9,
					metadata: {},
					createdAt: new Date(),
				},
			]

			mockVectorService.semanticSearch.mockResolvedValue([mockResults, null])

			// Act
			const [result, error] = await chatService.semanticSearch(searchOptions)

			// Assert
			expect(mockVectorService.semanticSearch).toHaveBeenCalledWith(
				searchOptions,
			)
			expect(result).toEqual(mockResults)
			expect(error).toBeNull()
		})
	})
})

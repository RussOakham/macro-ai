import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	InternalError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from '../../../utils/errors.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'

// Mock dependencies BEFORE any imports
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

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

// Helper function to create async generator for streaming tests
// eslint-disable-next-line func-style, @typescript-eslint/require-await
async function* createMockStream(chunks: string[]): AsyncIterable<string> {
	for (const chunk of chunks) {
		yield chunk
	}
}

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

		it('should handle empty chat ID', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([false, null])

			// Act
			const [result, error] = await chatService.verifyChatOwnership(
				'',
				mockUserId,
			)

			// Assert
			expect(mockChatRepository.verifyChatOwnership).toHaveBeenCalledWith(
				'',
				mockUserId,
			)
			expect(result).toBe(false)
			expect(error).toBeNull()
		})

		it('should handle empty user ID', async () => {
			// Arrange
			mockChatRepository.verifyChatOwnership.mockResolvedValue([false, null])

			// Act
			const [result, error] = await chatService.verifyChatOwnership(
				mockChatId,
				'',
			)

			// Assert
			expect(mockChatRepository.verifyChatOwnership).toHaveBeenCalledWith(
				mockChatId,
				'',
			)
			expect(result).toBe(false)
			expect(error).toBeNull()
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

		it('should return validation error for empty title', async () => {
			// Arrange
			const invalidRequest = { userId: mockUserId, title: '' }
			const validationError = new ValidationError(
				'Valid title is required',
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

		it('should return validation error for title too long', async () => {
			// Arrange
			const longTitle = 'a'.repeat(256) // 256 characters, exceeds 255 limit
			const invalidRequest = { userId: mockUserId, title: longTitle }
			const validationError = new ValidationError(
				'Title must be 255 characters or less',
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

		it('should return validation error for invalid userId type', async () => {
			// Arrange
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
			const invalidRequest = { userId: 123 as any, title: 'Valid Title' }
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

		it('should use default pagination when no options provided', async () => {
			// Arrange
			const expectedResult = { chats: [mockChat], total: 1 }
			mockChatRepository.findChatsByUserId.mockResolvedValue([
				expectedResult,
				null,
			])

			// Act
			const [result, error] = await chatService.getUserChats(mockUserId)

			// Assert
			expect(mockChatRepository.findChatsByUserId).toHaveBeenCalledWith(
				mockUserId,
				{ page: 1, limit: 20 },
			)
			expect(result).toEqual(expectedResult)
			expect(error).toBeNull()
		})

		it('should return validation error for negative page', async () => {
			// Act
			const [result, error] = await chatService.getUserChats(mockUserId, {
				page: -1,
				limit: 20,
			})

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(ValidationError)
		})

		it('should return validation error for zero limit', async () => {
			// Act
			const [result, error] = await chatService.getUserChats(mockUserId, {
				page: 1,
				limit: 0,
			})

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(ValidationError)
		})

		it('should return validation error for limit exceeding maximum', async () => {
			// Act
			const [result, error] = await chatService.getUserChats(mockUserId, {
				page: 1,
				limit: 101,
			})

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(ValidationError)
		})

		it('should return error when repository fails', async () => {
			// Arrange
			const repositoryError = new InternalError('Repository error', 'test')
			mockChatRepository.findChatsByUserId.mockResolvedValue([
				null,
				repositoryError,
			])

			// Act
			const [result, error] = await chatService.getUserChats(mockUserId, {
				page: 1,
				limit: 20,
			})

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(repositoryError)
		})

		it('should handle empty results', async () => {
			// Arrange
			const expectedResult = { chats: [], total: 0 }
			mockChatRepository.findChatsByUserId.mockResolvedValue([
				expectedResult,
				null,
			])

			// Act
			const [result, error] = await chatService.getUserChats(mockUserId)

			// Assert
			expect(result).toEqual(expectedResult)
			expect(error).toBeNull()
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

		it('should return error when ownership verification fails', async () => {
			// Arrange
			const ownershipError = new InternalError(
				'Ownership verification failed',
				'test',
			)
			mockChatRepository.verifyChatOwnership.mockResolvedValue([
				null,
				ownershipError,
			])

			// Act
			const [result, error] = await chatService.getChatWithMessages(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(ownershipError)
		})

		it('should return error when chat retrieval fails', async () => {
			// Arrange
			const chatError = new InternalError('Chat retrieval failed', 'test')
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockChatRepository.findChatById.mockResolvedValue([null, chatError])

			// Act
			const [result, error] = await chatService.getChatWithMessages(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(chatError)
		})

		it('should return error when message retrieval fails', async () => {
			// Arrange
			const messageError = new InternalError('Message retrieval failed', 'test')
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockChatRepository.findChatById.mockResolvedValue([mockChat, null])
			mockMessageRepository.findMessagesByChatId.mockResolvedValue([
				null,
				messageError,
			])

			// Act
			const [result, error] = await chatService.getChatWithMessages(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(messageError)
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

		it('should return validation error for empty content', async () => {
			// Arrange
			const invalidRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: '',
			}
			const validationError = new ValidationError(
				'Valid content is required',
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

		it('should return validation error for content too long', async () => {
			// Arrange
			const longContent = 'a'.repeat(10001) // Exceeds 10000 character limit
			const invalidRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: longContent,
			}
			const validationError = new ValidationError(
				'Content must be 10000 characters or less',
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

		it('should return validation error for invalid role', async () => {
			// Arrange
			const invalidRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI',
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
				role: 'invalid-role' as any,
			}
			const validationError = new ValidationError(
				'Invalid role specified',
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

		it('should return error when ownership verification fails in sendMessage', async () => {
			// Arrange
			const sendRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI',
				role: 'user' as const,
			}
			const ownershipError = new InternalError(
				'Ownership verification failed',
				'test',
			)

			vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
			mockChatRepository.verifyChatOwnership.mockResolvedValue([
				null,
				ownershipError,
			])

			// Act
			const [result, error] = await chatService.sendMessage(sendRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(ownershipError)
		})

		it('should return error when user message save fails in sendMessage', async () => {
			// Arrange
			const sendRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI',
				role: 'user' as const,
			}
			const saveError = new InternalError('User message save failed', 'test')

			vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockMessageRepository.createMessage.mockResolvedValueOnce([
				null,
				saveError,
			])

			// Act
			const [result, error] = await chatService.sendMessage(sendRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(saveError)
		})

		it('should return error when chat history retrieval fails in sendMessage', async () => {
			// Arrange
			const sendRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI',
				role: 'user' as const,
			}
			const mockUserMessage = { ...mockChatMessage, content: 'Hello AI' }
			const historyError = new InternalError(
				'Chat history retrieval failed',
				'test',
			)

			vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockMessageRepository.createMessage.mockResolvedValueOnce([
				mockUserMessage,
				null,
			])
			mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
			mockMessageRepository.getChatHistory.mockResolvedValue([
				null,
				historyError,
			])

			// Act
			const [result, error] = await chatService.sendMessage(sendRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(historyError)
		})

		it('should return error when AI message save fails in sendMessage', async () => {
			// Arrange
			const sendRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI',
				role: 'user' as const,
			}
			const mockUserMessage = { ...mockChatMessage, content: 'Hello AI' }
			const mockChatHistory = [{ role: 'user' as const, content: 'Hello AI' }]
			const aiSaveError = new InternalError('AI message save failed', 'test')

			vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockMessageRepository.createMessage
				.mockResolvedValueOnce([mockUserMessage, null]) // User message succeeds
				.mockResolvedValueOnce([null, aiSaveError]) // AI message fails
			mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
			mockMessageRepository.getChatHistory.mockResolvedValue([
				mockChatHistory,
				null,
			])
			mockAIService.generateResponse.mockResolvedValue(['Hello human!', null])

			// Act
			const [result, error] = await chatService.sendMessage(sendRequest)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(aiSaveError)
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

		it('should return error when ownership verification fails', async () => {
			// Arrange
			const ownershipError = new InternalError(
				'Ownership verification failed',
				'test',
			)
			mockChatRepository.verifyChatOwnership.mockResolvedValue([
				null,
				ownershipError,
			])

			// Act
			const [result, error] = await chatService.deleteChat(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(ownershipError)
		})

		it('should continue when vector service deletion succeeds', async () => {
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
			expect(result).toBeUndefined()
			expect(error).toBeNull()
			expect(mockVectorService.deleteChatEmbeddings).toHaveBeenCalledWith(
				mockChatId,
			)
		})

		it('should return error when chat repository deletion fails', async () => {
			// Arrange
			const deleteError = new InternalError('Chat deletion failed', 'test')
			mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
			mockVectorService.deleteChatEmbeddings.mockResolvedValue([
				undefined,
				null,
			])
			mockChatRepository.deleteChat.mockResolvedValue([null, deleteError])

			// Act
			const [result, error] = await chatService.deleteChat(
				mockChatId,
				mockUserId,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(deleteError)
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

		it('should return error when vector service fails', async () => {
			// Arrange
			const searchOptions = {
				query: 'test query',
				userId: mockUserId,
				limit: 10,
				threshold: 0.7,
			}
			const vectorError = new InternalError('Vector service error', 'test')
			mockVectorService.semanticSearch.mockResolvedValue([null, vectorError])

			// Act
			const [result, error] = await chatService.semanticSearch(searchOptions)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(vectorError)
		})

		describe('sendMessageStreaming', () => {
			const streamingRequest = {
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello AI streaming',
				role: 'user' as const,
			}

			it('should send message and return streaming response successfully', async () => {
				// Arrange
				const mockUserMessage = {
					...mockChatMessage,
					content: 'Hello AI streaming',
				}
				const mockAIMessage = {
					...mockChatMessage,
					id: 'ai-message-streaming-123',
					role: 'assistant',
					content: '',
				}
				const mockChatHistory = [
					{ role: 'user' as const, content: 'Hello AI streaming' },
				]
				const mockStreamChunks = ['Hello', ' there', '!']
				const mockStream = createMockStream(mockStreamChunks)

				// Mock validation
				vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])

				// Mock repository calls
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockMessageRepository.createMessage
					.mockResolvedValueOnce([mockUserMessage, null]) // User message
					.mockResolvedValueOnce([mockAIMessage, null]) // AI placeholder message
				mockMessageRepository.getChatHistory.mockResolvedValue([
					mockChatHistory,
					null,
				])
				mockChatRepository.updateChatTimestamp.mockResolvedValue([
					undefined,
					null,
				])

				// Mock AI service streaming
				mockAIService.generateStreamingResponse.mockReturnValue([
					mockStream,
					null,
				])

				// Mock vector service
				mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(streamingRequest)

				// Assert
				expect(mockAIService.generateStreamingResponse).toHaveBeenCalledWith(
					mockChatHistory,
				)
				expect(mockVectorService.createMessageEmbedding).toHaveBeenCalledWith({
					messageId: mockUserMessage.id,
					chatId: streamingRequest.chatId,
					userId: streamingRequest.userId,
					content: streamingRequest.content,
					metadata: { role: 'user' },
				})
				expect(mockChatRepository.updateChatTimestamp).toHaveBeenCalledWith(
					mockChatId,
				)
				expect(result).toEqual({
					userMessage: mockUserMessage,
					streamingResponse: {
						messageId: mockAIMessage.id,
						stream: mockStream,
					},
				})
				expect(error).toBeNull()
			})

			it('should return validation error for invalid streaming request', async () => {
				// Arrange
				const invalidRequest = { chatId: '', userId: '', content: '' }
				const validationError = new ValidationError(
					'Valid chatId is required',
					undefined,
					'chatService',
				)

				vi.mocked(tryCatchSync).mockReturnValue([null, validationError])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(invalidRequest)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(validationError)
			})

			it('should return unauthorized error when user does not own chat', async () => {
				// Arrange
				vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])
				mockChatRepository.verifyChatOwnership.mockResolvedValue([false, null])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(streamingRequest)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(UnauthorizedError)
				expect(error?.message).toBe('User does not have access to this chat')
			})

			it('should return error when ownership verification fails', async () => {
				// Arrange
				const ownershipError = new InternalError(
					'Ownership check failed',
					'test',
				)
				vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])
				mockChatRepository.verifyChatOwnership.mockResolvedValue([
					null,
					ownershipError,
				])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(streamingRequest)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(ownershipError)
			})

			it('should return error when user message save fails', async () => {
				// Arrange
				const saveError = new InternalError('Message save failed', 'test')
				vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockMessageRepository.createMessage.mockResolvedValueOnce([
					null,
					saveError,
				])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(streamingRequest)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(saveError)
			})

			it('should return error when chat history retrieval fails', async () => {
				// Arrange
				const historyError = new InternalError(
					'History retrieval failed',
					'test',
				)
				const mockUserMessage = {
					...mockChatMessage,
					content: 'Hello AI streaming',
				}

				vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockMessageRepository.createMessage.mockResolvedValueOnce([
					mockUserMessage,
					null,
				])
				mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
				mockMessageRepository.getChatHistory.mockResolvedValue([
					null,
					historyError,
				])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(streamingRequest)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(historyError)
			})

			it('should return error when AI streaming response fails', async () => {
				// Arrange
				const aiError = new InternalError('AI streaming failed', 'test')
				const mockUserMessage = {
					...mockChatMessage,
					content: 'Hello AI streaming',
				}
				const mockChatHistory = [
					{ role: 'user' as const, content: 'Hello AI streaming' },
				]

				vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockMessageRepository.createMessage.mockResolvedValueOnce([
					mockUserMessage,
					null,
				])
				mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
				mockMessageRepository.getChatHistory.mockResolvedValue([
					mockChatHistory,
					null,
				])
				mockAIService.generateStreamingResponse.mockReturnValue([null, aiError])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(streamingRequest)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(aiError)
			})

			it('should return error when AI message save fails', async () => {
				// Arrange
				const aiSaveError = new InternalError('AI message save failed', 'test')
				const mockUserMessage = {
					...mockChatMessage,
					content: 'Hello AI streaming',
				}
				const mockChatHistory = [
					{ role: 'user' as const, content: 'Hello AI streaming' },
				]
				const mockStreamChunks = ['Hello', ' there', '!']
				const mockStream = createMockStream(mockStreamChunks)

				vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockMessageRepository.createMessage
					.mockResolvedValueOnce([mockUserMessage, null]) // User message succeeds
					.mockResolvedValueOnce([null, aiSaveError]) // AI message fails
				mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
				mockMessageRepository.getChatHistory.mockResolvedValue([
					mockChatHistory,
					null,
				])
				mockAIService.generateStreamingResponse.mockReturnValue([
					mockStream,
					null,
				])

				// Act
				const [result, error] =
					await chatService.sendMessageStreaming(streamingRequest)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(aiSaveError)
			})
		})

		describe('updateMessageContent', () => {
			const mockMessageId = 'message-update-123'
			const newContent = 'Updated message content'

			it('should update message content successfully', async () => {
				// Arrange
				const updatedMessage = {
					...mockChatMessage,
					id: mockMessageId,
					content: newContent,
				}
				mockMessageRepository.updateMessage.mockResolvedValue([
					updatedMessage,
					null,
				])

				// Act
				const [result, error] = await chatService.updateMessageContent(
					mockMessageId,
					newContent,
				)

				// Assert
				expect(mockMessageRepository.updateMessage).toHaveBeenCalledWith(
					mockMessageId,
					{ content: newContent },
				)
				expect(result).toEqual(updatedMessage)
				expect(error).toBeNull()
			})

			it('should return error when repository update fails', async () => {
				// Arrange
				const updateError = new InternalError('Update failed', 'test')
				mockMessageRepository.updateMessage.mockResolvedValue([
					null,
					updateError,
				])

				// Act
				const [result, error] = await chatService.updateMessageContent(
					mockMessageId,
					newContent,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(updateError)
			})

			it('should return not found error when message does not exist', async () => {
				// Arrange
				mockMessageRepository.updateMessage.mockResolvedValue([undefined, null])

				// Act
				const [result, error] = await chatService.updateMessageContent(
					mockMessageId,
					newContent,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(NotFoundError)
				expect(error?.message).toBe('Message not found')
			})

			it('should handle empty content update', async () => {
				// Arrange
				const emptyContent = ''
				const updatedMessage = {
					...mockChatMessage,
					id: mockMessageId,
					content: emptyContent,
				}
				mockMessageRepository.updateMessage.mockResolvedValue([
					updatedMessage,
					null,
				])

				// Act
				const [result, error] = await chatService.updateMessageContent(
					mockMessageId,
					emptyContent,
				)

				// Assert
				expect(mockMessageRepository.updateMessage).toHaveBeenCalledWith(
					mockMessageId,
					{ content: emptyContent },
				)
				expect(result).toEqual(updatedMessage)
				expect(error).toBeNull()
			})
		})

		describe('AI Service Integration Failures', () => {
			describe('sendMessage with AI failures', () => {
				const sendRequest = {
					chatId: mockChatId,
					userId: mockUserId,
					content: 'Hello AI',
					role: 'user' as const,
				}

				it('should return error when AI response generation fails', async () => {
					// Arrange
					const mockUserMessage = { ...mockChatMessage, content: 'Hello AI' }
					const mockChatHistory = [
						{ role: 'user' as const, content: 'Hello AI' },
					]
					const aiError = new InternalError('AI service unavailable', 'test')

					vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
					mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
					mockMessageRepository.createMessage.mockResolvedValueOnce([
						mockUserMessage,
						null,
					])
					mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
					mockMessageRepository.getChatHistory.mockResolvedValue([
						mockChatHistory,
						null,
					])
					mockAIService.generateResponse.mockResolvedValue([null, aiError])

					// Act
					const [result, error] = await chatService.sendMessage(sendRequest)

					// Assert
					expect(result).toBeNull()
					expect(error).toBe(aiError)
				})

				it('should return error when AI response is empty', async () => {
					// Arrange
					const mockUserMessage = { ...mockChatMessage, content: 'Hello AI' }
					const mockAIMessage = {
						...mockChatMessage,
						id: 'ai-message-123',
						role: 'assistant',
						content: '',
					}
					const mockChatHistory = [
						{ role: 'user' as const, content: 'Hello AI' },
					]

					vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
					mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
					mockMessageRepository.createMessage
						.mockResolvedValueOnce([mockUserMessage, null])
						.mockResolvedValueOnce([mockAIMessage, null])
					mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
					mockMessageRepository.getChatHistory.mockResolvedValue([
						mockChatHistory,
						null,
					])
					mockAIService.generateResponse.mockResolvedValue(['', null])
					mockChatRepository.updateChatTimestamp.mockResolvedValue([
						undefined,
						null,
					])

					// Act
					const [result, error] = await chatService.sendMessage(sendRequest)

					// Assert - Should still succeed with empty response
					expect(result?.userMessage).toEqual(mockUserMessage)
					expect(result?.aiResponse).toEqual(mockAIMessage)
					expect(error).toBeNull()
				})
			})

			describe('Vector service integration failures', () => {
				it('should handle vector embedding creation failure gracefully in sendMessage', async () => {
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
					const mockChatHistory = [
						{ role: 'user' as const, content: 'Hello AI' },
					]

					vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
					mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
					mockMessageRepository.createMessage
						.mockResolvedValueOnce([mockUserMessage, null])
						.mockResolvedValueOnce([mockAIMessage, null])
					// Vector service calls succeed - testing that the service continues despite potential failures
					mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
					mockMessageRepository.getChatHistory.mockResolvedValue([
						mockChatHistory,
						null,
					])
					mockAIService.generateResponse.mockResolvedValue([
						'Hello human!',
						null,
					])
					mockChatRepository.updateChatTimestamp.mockResolvedValue([
						undefined,
						null,
					])

					// Act
					const [result, error] = await chatService.sendMessage(sendRequest)

					// Assert - Should succeed with vector embedding calls
					expect(result).toEqual({
						userMessage: mockUserMessage,
						aiResponse: mockAIMessage,
					})
					expect(error).toBeNull()
					expect(
						mockVectorService.createMessageEmbedding,
					).toHaveBeenCalledTimes(2)
				})

				it('should handle vector embedding creation in sendMessageStreaming', async () => {
					// Arrange
					const streamingRequest = {
						chatId: mockChatId,
						userId: mockUserId,
						content: 'Hello AI streaming',
						role: 'user' as const,
					}
					const mockUserMessage = {
						...mockChatMessage,
						content: 'Hello AI streaming',
					}
					const mockAIMessage = {
						...mockChatMessage,
						id: 'ai-message-streaming-123',
						role: 'assistant',
						content: '',
					}
					const mockChatHistory = [
						{ role: 'user' as const, content: 'Hello AI streaming' },
					]
					const mockStreamChunks = ['Hello', ' there', '!']
					const mockStream = createMockStream(mockStreamChunks)

					vi.mocked(tryCatchSync).mockReturnValue([streamingRequest, null])
					mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
					mockMessageRepository.createMessage
						.mockResolvedValueOnce([mockUserMessage, null])
						.mockResolvedValueOnce([mockAIMessage, null])
					mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
					mockMessageRepository.getChatHistory.mockResolvedValue([
						mockChatHistory,
						null,
					])
					mockAIService.generateStreamingResponse.mockReturnValue([
						mockStream,
						null,
					])
					mockChatRepository.updateChatTimestamp.mockResolvedValue([
						undefined,
						null,
					])

					// Act
					const [result, error] =
						await chatService.sendMessageStreaming(streamingRequest)

					// Assert
					expect(result).toBeDefined()
					expect(error).toBeNull()
					expect(mockVectorService.createMessageEmbedding).toHaveBeenCalledWith(
						{
							messageId: mockUserMessage.id,
							chatId: streamingRequest.chatId,
							userId: streamingRequest.userId,
							content: streamingRequest.content,
							metadata: { role: 'user' },
						},
					)
				})
			})
		})

		describe('Repository Transaction Failures', () => {
			it('should handle concurrent chat access in getChatWithMessages', async () => {
				// Arrange
				const concurrentError = new InternalError(
					'Concurrent access detected',
					'test',
				)
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockChatRepository.findChatById.mockResolvedValue([
					null,
					concurrentError,
				])

				// Act
				const [result, error] = await chatService.getChatWithMessages(
					mockChatId,
					mockUserId,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(concurrentError)
			})

			it('should handle message repository failure in getChatWithMessages', async () => {
				// Arrange
				const messageError = new InternalError('Message fetch failed', 'test')
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockChatRepository.findChatById.mockResolvedValue([mockChat, null])
				mockMessageRepository.findMessagesByChatId.mockResolvedValue([
					null,
					messageError,
				])

				// Act
				const [result, error] = await chatService.getChatWithMessages(
					mockChatId,
					mockUserId,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(messageError)
			})

			it('should handle chat timestamp update successfully', async () => {
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

				vi.mocked(tryCatchSync).mockReturnValue([sendRequest, null])
				mockChatRepository.verifyChatOwnership.mockResolvedValue([true, null])
				mockMessageRepository.createMessage
					.mockResolvedValueOnce([mockUserMessage, null])
					.mockResolvedValueOnce([mockAIMessage, null])
				mockVectorService.createMessageEmbedding.mockResolvedValue([{}, null])
				mockMessageRepository.getChatHistory.mockResolvedValue([
					mockChatHistory,
					null,
				])
				mockAIService.generateResponse.mockResolvedValue(['Hello human!', null])
				mockChatRepository.updateChatTimestamp.mockResolvedValue([
					undefined,
					null,
				])

				// Act
				const [result, error] = await chatService.sendMessage(sendRequest)

				// Assert
				expect(result).toEqual({
					userMessage: mockUserMessage,
					aiResponse: mockAIMessage,
				})
				expect(error).toBeNull()
				expect(mockChatRepository.updateChatTimestamp).toHaveBeenCalledWith(
					mockChatId,
				)
			})
		})
	})
})

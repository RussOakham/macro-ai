import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError, InternalError } from '../../../utils/errors.ts'
import { mockDatabase } from '../../../utils/test-helpers/drizzle-db.mock.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'

// Mock dependencies BEFORE any imports
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../../data-access/db.ts', () => mockDatabase.createModule())
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Mock response handlers
vi.mock('../../../utils/response-handlers.ts', () => ({
	safeValidateSchema: vi.fn(),
}))

// Import after mocking
import { tryCatch } from '../../../utils/error-handling/try-catch.ts'
import { safeValidateSchema } from '../../../utils/response-handlers.ts'
// Import the repository instances to test
import {
	chatRepository,
	messageRepository,
	vectorRepository,
} from '../chat.data-access.ts'
import type {
	PaginationOptions,
	SemanticSearchOptions,
	SemanticSearchResult,
	TChat,
	TChatMessage,
	TChatVector,
	TInsertChat,
	TInsertChatMessage,
	TInsertChatVector,
} from '../chat.types.ts'

describe('Chat Data Access Layer', () => {
	// Mock data - properly typed
	const mockUserId = '123e4567-e89b-12d3-a456-426614174000'
	const mockChatId = 'chat-456-789-012'
	const mockMessageId = 'message-789-012-345'
	const mockVectorId = 'vector-012-345-678'

	const mockChat: TChat = {
		id: mockChatId,
		userId: mockUserId,
		title: 'Test Chat',
		createdAt: new Date('2023-01-01T00:00:00Z'),
		updatedAt: new Date('2023-01-01T00:00:00Z'),
	}

	const mockInsertChat: TInsertChat = {
		userId: mockUserId,
		title: 'New Test Chat',
	}

	const mockChatMessage: TChatMessage = {
		id: mockMessageId,
		chatId: mockChatId,
		role: 'user',
		content: 'Hello, world!',
		metadata: {},
		embedding: null,
		createdAt: new Date('2023-01-01T00:00:00Z'),
	}

	const mockInsertChatMessage: TInsertChatMessage = {
		chatId: mockChatId,
		role: 'user',
		content: 'Hello, world!',
		metadata: {},
	}

	const mockChatVector: TChatVector = {
		id: mockVectorId,
		userId: mockUserId,
		chatId: mockChatId,
		messageId: mockMessageId,
		content: 'Hello, world!',
		embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
		metadata: {},
		createdAt: new Date('2023-01-01T00:00:00Z'),
		updatedAt: new Date('2023-01-01T00:00:00Z'),
	}

	const mockInsertChatVector: TInsertChatVector = {
		userId: mockUserId,
		chatId: mockChatId,
		messageId: mockMessageId,
		content: 'Hello, world!',
		embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
		metadata: {},
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('ChatRepository', () => {
		beforeEach(() => {
			mockDatabase.setup()
		})

		describe('findChatById', () => {
			it('should return chat when found', async () => {
				// Arrange
				const mockDbResult = [mockChat]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([mockChat, null])

				// Act
				const [result, error] = await chatRepository.findChatById(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - findChatById',
				)
				expect(safeValidateSchema).toHaveBeenCalledWith(
					mockChat,
					expect.any(Object),
					'chatRepository - findChatById',
				)
				expect(result).toEqual(mockChat)
				expect(error).toBeNull()
			})

			it('should return undefined when chat not found', async () => {
				// Arrange
				const mockDbResult: TChat[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] = await chatRepository.findChatById(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - findChatById',
				)
				expect(safeValidateSchema).not.toHaveBeenCalled()
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database query fails', async () => {
				// Arrange
				const dbError = new InternalError('Database connection failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] = await chatRepository.findChatById(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - findChatById',
				)
				expect(safeValidateSchema).not.toHaveBeenCalled()
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when validation fails', async () => {
				// Arrange
				const mockDbResult = [{ ...mockChat, invalidField: 'invalid' }]
				const validationError = new InternalError('Validation failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

				// Act
				const [result, error] = await chatRepository.findChatById(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - findChatById',
				)
				expect(safeValidateSchema).toHaveBeenCalledWith(
					mockDbResult[0],
					expect.any(Object),
					'chatRepository - findChatById',
				)
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(AppError)
			})
		})

		describe('findChatsByUserId', () => {
			it('should return paginated chats for user', async () => {
				// Arrange
				const mockChats = [
					mockChat,
					{ ...mockChat, id: 'chat-2', title: 'Chat 2' },
				]
				const mockCountResult = [{ count: 2 }]
				const paginationOptions: PaginationOptions = { page: 1, limit: 20 }

				vi.mocked(tryCatch)
					.mockResolvedValueOnce([mockChats, null]) // chats query
					.mockResolvedValueOnce([mockCountResult, null]) // count query
				vi.mocked(safeValidateSchema)
					.mockReturnValueOnce([mockChats[0], null])
					.mockReturnValueOnce([mockChats[1], null])

				// Act
				const [result, error] = await chatRepository.findChatsByUserId(
					mockUserId,
					paginationOptions,
				)

				// Assert
				expect(tryCatch).toHaveBeenCalledTimes(2)
				expect(safeValidateSchema).toHaveBeenCalledTimes(2)
				expect(result).toEqual({
					chats: mockChats,
					total: 2,
				})
				expect(error).toBeNull()
			})

			it('should use default pagination when not provided', async () => {
				// Arrange
				const mockChats = [mockChat]
				const mockCountResult = [{ count: 1 }]

				vi.mocked(tryCatch)
					.mockResolvedValueOnce([mockChats, null])
					.mockResolvedValueOnce([mockCountResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([mockChat, null])

				// Act
				const [result, error] =
					await chatRepository.findChatsByUserId(mockUserId)

				// Assert
				expect(result).toEqual({
					chats: mockChats,
					total: 1,
				})
				expect(error).toBeNull()
			})

			it('should return error when chats query fails', async () => {
				// Arrange
				const dbError = new InternalError('Database error', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await chatRepository.findChatsByUserId(mockUserId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when count query fails', async () => {
				// Arrange
				const mockChats = [mockChat]
				const countError = new InternalError('Count query failed', 'test')

				vi.mocked(tryCatch)
					.mockResolvedValueOnce([mockChats, null])
					.mockResolvedValueOnce([null, countError])

				// Act
				const [result, error] =
					await chatRepository.findChatsByUserId(mockUserId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(countError)
			})

			it('should return error when validation fails', async () => {
				// Arrange
				const invalidChat = { ...mockChat, invalidField: 'invalid' }
				const mockChats = [invalidChat]
				const mockCountResult = [{ count: 1 }]
				const validationError = new InternalError('Validation failed', 'test')

				vi.mocked(tryCatch)
					.mockResolvedValueOnce([mockChats, null])
					.mockResolvedValueOnce([mockCountResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

				// Act
				const [result, error] =
					await chatRepository.findChatsByUserId(mockUserId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(AppError)
			})

			it('should handle empty results', async () => {
				// Arrange
				const mockChats: TChat[] = []
				const mockCountResult = [{ count: 0 }]

				vi.mocked(tryCatch)
					.mockResolvedValueOnce([mockChats, null])
					.mockResolvedValueOnce([mockCountResult, null])

				// Act
				const [result, error] =
					await chatRepository.findChatsByUserId(mockUserId)

				// Assert
				expect(result).toEqual({
					chats: [],
					total: 0,
				})
				expect(error).toBeNull()
			})
		})

		describe('createChat', () => {
			it('should create chat successfully', async () => {
				// Arrange
				const mockDbResult = [mockChat]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([mockChat, null])

				// Act
				const [result, error] = await chatRepository.createChat(mockInsertChat)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - createChat',
				)
				expect(safeValidateSchema).toHaveBeenCalledWith(
					mockChat,
					expect.any(Object),
					'chatRepository - createChat',
				)
				expect(result).toEqual(mockChat)
				expect(error).toBeNull()
			})

			it('should return error when database insert fails', async () => {
				// Arrange
				const dbError = new InternalError('Insert failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] = await chatRepository.createChat(mockInsertChat)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when no chat is returned', async () => {
				// Arrange
				const mockDbResult: TChat[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] = await chatRepository.createChat(mockInsertChat)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(InternalError)
				expect(error?.message).toBe('Failed to create chat')
			})

			it('should return error when validation fails', async () => {
				// Arrange
				const invalidChat = { ...mockChat, invalidField: 'invalid' }
				const mockDbResult = [invalidChat]
				const validationError = new InternalError('Validation failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

				// Act
				const [result, error] = await chatRepository.createChat(mockInsertChat)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(AppError)
			})
		})

		describe('updateChat', () => {
			it('should update chat successfully', async () => {
				// Arrange
				const updateData = { title: 'Updated Chat Title' }
				const updatedChat = { ...mockChat, ...updateData }
				const mockDbResult = [updatedChat]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([updatedChat, null])

				// Act
				const [result, error] = await chatRepository.updateChat(
					mockChatId,
					updateData,
				)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - updateChat',
				)
				expect(result).toEqual(updatedChat)
				expect(error).toBeNull()
			})

			it('should return undefined when chat not found', async () => {
				// Arrange
				const updateData = { title: 'Updated Title' }
				const mockDbResult: TChat[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] = await chatRepository.updateChat(
					mockChatId,
					updateData,
				)

				// Assert
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database update fails', async () => {
				// Arrange
				const updateData = { title: 'Updated Title' }
				const dbError = new InternalError('Update failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] = await chatRepository.updateChat(
					mockChatId,
					updateData,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})

		describe('deleteChat', () => {
			it('should delete chat successfully', async () => {
				// Arrange
				vi.mocked(tryCatch).mockResolvedValue([undefined, null])

				// Act
				const [result, error] = await chatRepository.deleteChat(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - deleteChat',
				)
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database delete fails', async () => {
				// Arrange
				const dbError = new InternalError('Delete failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] = await chatRepository.deleteChat(mockChatId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})

		describe('verifyChatOwnership', () => {
			it('should return true when user owns chat', async () => {
				// Arrange
				const mockDbResult = [{ id: mockChatId }]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] = await chatRepository.verifyChatOwnership(
					mockChatId,
					mockUserId,
				)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - verifyChatOwnership',
				)
				expect(result).toBe(true)
				expect(error).toBeNull()
			})

			it('should return false when user does not own chat', async () => {
				// Arrange
				const mockDbResult: { id: string }[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] = await chatRepository.verifyChatOwnership(
					mockChatId,
					mockUserId,
				)

				// Assert
				expect(result).toBe(false)
				expect(error).toBeNull()
			})

			it('should return error when database query fails', async () => {
				// Arrange
				const dbError = new InternalError('Query failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] = await chatRepository.verifyChatOwnership(
					mockChatId,
					mockUserId,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})

		describe('updateChatTimestamp', () => {
			it('should update timestamp successfully', async () => {
				// Arrange
				vi.mocked(tryCatch).mockResolvedValue([undefined, null])

				// Act
				const [result, error] =
					await chatRepository.updateChatTimestamp(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'chatRepository - updateChatTimestamp',
				)
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database update fails', async () => {
				// Arrange
				const dbError = new InternalError('Timestamp update failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await chatRepository.updateChatTimestamp(mockChatId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})
	})

	describe('MessageRepository', () => {
		beforeEach(() => {
			mockDatabase.setup()
		})

		describe('findMessageById', () => {
			it('should return message when found', async () => {
				// Arrange
				const mockDbResult = [mockChatMessage]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([mockChatMessage, null])

				// Act
				const [result, error] =
					await messageRepository.findMessageById(mockMessageId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'messageRepository - findMessageById',
				)
				expect(safeValidateSchema).toHaveBeenCalledWith(
					mockChatMessage,
					expect.any(Object),
					'messageRepository - findMessageById',
				)
				expect(result).toEqual(mockChatMessage)
				expect(error).toBeNull()
			})

			it('should return undefined when message not found', async () => {
				// Arrange
				const mockDbResult: TChatMessage[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] =
					await messageRepository.findMessageById(mockMessageId)

				// Assert
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database query fails', async () => {
				// Arrange
				const dbError = new InternalError('Database error', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await messageRepository.findMessageById(mockMessageId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when validation fails', async () => {
				// Arrange
				const invalidMessage = { ...mockChatMessage, invalidField: 'invalid' }
				const mockDbResult = [invalidMessage]
				const validationError = new InternalError('Validation failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

				// Act
				const [result, error] =
					await messageRepository.findMessageById(mockMessageId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(AppError)
			})
		})

		describe('findMessagesByChatId', () => {
			it('should return messages for chat', async () => {
				// Arrange
				const mockMessages = [
					mockChatMessage,
					{ ...mockChatMessage, id: 'message-2', content: 'Second message' },
				]
				vi.mocked(tryCatch).mockResolvedValue([mockMessages, null])
				vi.mocked(safeValidateSchema)
					.mockReturnValueOnce([mockMessages[0], null])
					.mockReturnValueOnce([mockMessages[1], null])

				// Act
				const [result, error] =
					await messageRepository.findMessagesByChatId(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'messageRepository - findMessagesByChatId',
				)
				expect(safeValidateSchema).toHaveBeenCalledTimes(2)
				expect(result).toEqual(mockMessages)
				expect(error).toBeNull()
			})

			it('should return empty array when no messages found', async () => {
				// Arrange
				const mockDbResult: TChatMessage[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] =
					await messageRepository.findMessagesByChatId(mockChatId)

				// Assert
				expect(result).toEqual([])
				expect(error).toBeNull()
			})

			it('should return error when database query fails', async () => {
				// Arrange
				const dbError = new InternalError('Database error', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await messageRepository.findMessagesByChatId(mockChatId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when validation fails', async () => {
				// Arrange
				const invalidMessage = { ...mockChatMessage, invalidField: 'invalid' }
				const mockMessages = [invalidMessage]
				const validationError = new InternalError('Validation failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([mockMessages, null])
				vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

				// Act
				const [result, error] =
					await messageRepository.findMessagesByChatId(mockChatId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(AppError)
			})
		})

		describe('createMessage', () => {
			it('should create message successfully', async () => {
				// Arrange
				const mockDbResult = [mockChatMessage]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([mockChatMessage, null])

				// Act
				const [result, error] = await messageRepository.createMessage(
					mockInsertChatMessage,
				)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'messageRepository - createMessage',
				)
				expect(result).toEqual(mockChatMessage)
				expect(error).toBeNull()
			})

			it('should return error when database insert fails', async () => {
				// Arrange
				const dbError = new InternalError('Insert failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] = await messageRepository.createMessage(
					mockInsertChatMessage,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when no message is returned', async () => {
				// Arrange
				const mockDbResult: TChatMessage[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] = await messageRepository.createMessage(
					mockInsertChatMessage,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(InternalError)
				expect(error?.message).toBe('Failed to create message')
			})
		})

		describe('updateMessage', () => {
			it('should update message successfully', async () => {
				// Arrange
				const updateData = { content: 'Updated content' }
				const updatedMessage = { ...mockChatMessage, ...updateData }
				const mockDbResult = [updatedMessage]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([updatedMessage, null])

				// Act
				const [result, error] = await messageRepository.updateMessage(
					mockMessageId,
					updateData,
				)

				// Assert
				expect(result).toEqual(updatedMessage)
				expect(error).toBeNull()
			})

			it('should return undefined when message not found', async () => {
				// Arrange
				const updateData = { content: 'Updated content' }
				const mockDbResult: TChatMessage[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] = await messageRepository.updateMessage(
					mockMessageId,
					updateData,
				)

				// Assert
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})
		})

		describe('deleteMessage', () => {
			it('should delete message successfully', async () => {
				// Arrange
				vi.mocked(tryCatch).mockResolvedValue([undefined, null])

				// Act
				const [result, error] =
					await messageRepository.deleteMessage(mockMessageId)

				// Assert
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database delete fails', async () => {
				// Arrange
				const dbError = new InternalError('Delete failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await messageRepository.deleteMessage(mockMessageId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})

		describe('getChatHistory', () => {
			it('should return formatted chat history', async () => {
				// Arrange
				const mockMessages = [
					mockChatMessage,
					{
						...mockChatMessage,
						id: 'message-2',
						role: 'assistant' as const,
						content: 'AI response',
					},
				]
				const expectedHistory = [
					{ role: 'user', content: 'Hello, world!' },
					{ role: 'assistant', content: 'AI response' },
				]

				// Mock the findMessagesByChatId method
				const findMessagesSpy = vi
					.spyOn(messageRepository, 'findMessagesByChatId')
					.mockResolvedValue([mockMessages, null])

				// Act
				const [result, error] =
					await messageRepository.getChatHistory(mockChatId)

				// Assert
				expect(findMessagesSpy).toHaveBeenCalledWith(mockChatId)
				expect(result).toEqual(expectedHistory)
				expect(error).toBeNull()
			})

			it('should return error when findMessagesByChatId fails', async () => {
				// Arrange
				const dbError = new InternalError('Database error', 'test')
				const findMessagesSpy = vi
					.spyOn(messageRepository, 'findMessagesByChatId')
					.mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await messageRepository.getChatHistory(mockChatId)

				// Assert
				expect(findMessagesSpy).toHaveBeenCalledWith(mockChatId)
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})
	})

	describe('VectorRepository', () => {
		beforeEach(() => {
			mockDatabase.setup()
		})

		describe('createVector', () => {
			it('should create vector successfully', async () => {
				// Arrange
				const mockDbResult = [mockChatVector]
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])
				vi.mocked(safeValidateSchema).mockReturnValue([mockChatVector, null])

				// Act
				const [result, error] =
					await vectorRepository.createVector(mockInsertChatVector)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'vectorRepository - createVector',
				)
				expect(result).toEqual(mockChatVector)
				expect(error).toBeNull()
			})

			it('should return error when database insert fails', async () => {
				// Arrange
				const dbError = new InternalError('Insert failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await vectorRepository.createVector(mockInsertChatVector)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when no vector is returned', async () => {
				// Arrange
				const mockDbResult: TChatVector[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] =
					await vectorRepository.createVector(mockInsertChatVector)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(InternalError)
				expect(error?.message).toBe('Failed to create vector')
			})
		})

		describe('findVectorsByUserId', () => {
			it('should return vectors for user', async () => {
				// Arrange
				const mockVectors = [
					mockChatVector,
					{ ...mockChatVector, id: 'vector-2', content: 'Second vector' },
				]
				vi.mocked(tryCatch).mockResolvedValue([mockVectors, null])
				vi.mocked(safeValidateSchema)
					.mockReturnValueOnce([mockVectors[0], null])
					.mockReturnValueOnce([mockVectors[1], null])

				// Act
				const [result, error] =
					await vectorRepository.findVectorsByUserId(mockUserId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'vectorRepository - findVectorsByUserId',
				)
				expect(result).toEqual(mockVectors)
				expect(error).toBeNull()
			})

			it('should return empty array when no vectors found', async () => {
				// Arrange
				const mockDbResult: TChatVector[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockDbResult, null])

				// Act
				const [result, error] =
					await vectorRepository.findVectorsByUserId(mockUserId)

				// Assert
				expect(result).toEqual([])
				expect(error).toBeNull()
			})

			it('should return error when database query fails', async () => {
				// Arrange
				const dbError = new InternalError('Database error', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await vectorRepository.findVectorsByUserId(mockUserId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})

			it('should return error when validation fails', async () => {
				// Arrange
				const invalidVector = { ...mockChatVector, invalidField: 'invalid' }
				const mockVectors = [invalidVector]
				const validationError = new InternalError('Validation failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([mockVectors, null])
				vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

				// Act
				const [result, error] =
					await vectorRepository.findVectorsByUserId(mockUserId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(AppError)
			})
		})

		describe('findVectorsByChatId', () => {
			it('should return vectors for chat', async () => {
				// Arrange
				const mockVectors = [mockChatVector]
				vi.mocked(tryCatch).mockResolvedValue([mockVectors, null])
				vi.mocked(safeValidateSchema).mockReturnValue([mockChatVector, null])

				// Act
				const [result, error] =
					await vectorRepository.findVectorsByChatId(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'vectorRepository - findVectorsByChatId',
				)
				expect(result).toEqual(mockVectors)
				expect(error).toBeNull()
			})
		})

		describe('semanticSearch', () => {
			it('should return search results', async () => {
				// Arrange
				const searchOptions: SemanticSearchOptions = {
					query: 'test query',
					userId: mockUserId,
					chatId: mockChatId,
					limit: 5,
					threshold: 0.8,
				}
				const mockSearchResults: SemanticSearchResult[] = [
					{
						chatId: mockChatId,
						messageId: mockMessageId,
						content: 'Hello, world!',
						similarity: 0.95,
						metadata: {},
						createdAt: new Date('2023-01-01T00:00:00Z'),
					},
				]
				vi.mocked(tryCatch).mockResolvedValue([mockSearchResults, null])

				// Act
				const [result, error] =
					await vectorRepository.semanticSearch(searchOptions)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'vectorRepository - semanticSearch',
				)
				expect(result).toEqual(mockSearchResults)
				expect(error).toBeNull()
			})

			it('should return empty array when no results found', async () => {
				// Arrange
				const searchOptions: SemanticSearchOptions = {
					query: 'test query',
					userId: mockUserId,
					limit: 5,
					threshold: 0.8,
				}
				const mockSearchResults: SemanticSearchResult[] = []
				vi.mocked(tryCatch).mockResolvedValue([mockSearchResults, null])

				// Act
				const [result, error] =
					await vectorRepository.semanticSearch(searchOptions)

				// Assert
				expect(result).toEqual([])
				expect(error).toBeNull()
			})

			it('should return error when search fails', async () => {
				// Arrange
				const searchOptions: SemanticSearchOptions = {
					query: 'test query',
					userId: mockUserId,
					limit: 5,
					threshold: 0.8,
				}
				const dbError = new InternalError('Search failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await vectorRepository.semanticSearch(searchOptions)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})

		describe('deleteVectorsByMessageId', () => {
			it('should delete vectors successfully', async () => {
				// Arrange
				vi.mocked(tryCatch).mockResolvedValue([undefined, null])

				// Act
				const [result, error] =
					await vectorRepository.deleteVectorsByMessageId(mockMessageId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'vectorRepository - deleteVectorsByMessageId',
				)
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database delete fails', async () => {
				// Arrange
				const dbError = new InternalError('Delete failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await vectorRepository.deleteVectorsByMessageId(mockMessageId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})

		describe('deleteVectorsByChatId', () => {
			it('should delete vectors successfully', async () => {
				// Arrange
				vi.mocked(tryCatch).mockResolvedValue([undefined, null])

				// Act
				const [result, error] =
					await vectorRepository.deleteVectorsByChatId(mockChatId)

				// Assert
				expect(tryCatch).toHaveBeenCalledWith(
					expect.any(Object),
					'vectorRepository - deleteVectorsByChatId',
				)
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should return error when database delete fails', async () => {
				// Arrange
				const dbError = new InternalError('Delete failed', 'test')
				vi.mocked(tryCatch).mockResolvedValue([null, dbError])

				// Act
				const [result, error] =
					await vectorRepository.deleteVectorsByChatId(mockChatId)

				// Assert
				expect(result).toBeNull()
				expect(error).toBe(dbError)
			})
		})
	})
})

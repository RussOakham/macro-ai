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
import type { TChatMessage, TInsertChatMessage } from '../chat.types.ts'
// Import the repository instances to test
import { messageRepository } from '../message.data-access.ts'

describe('Message Data Access Layer', () => {
	// Mock data - properly typed
	const mockChatId = 'chat-456-789-012'
	const mockMessageId = 'message-789-012-345'

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

	beforeEach(() => {
		vi.clearAllMocks()
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
})

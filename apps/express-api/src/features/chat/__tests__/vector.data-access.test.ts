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

import type {
	SemanticSearchOptions,
	SemanticSearchResult,
	TChatVector,
	TInsertChatVector,
} from '../chat.types.ts'

// Import after mocking
import { tryCatch } from '../../../utils/error-handling/try-catch.ts'
import { safeValidateSchema } from '../../../utils/response-handlers.ts'
// Import the repository instances to test
import { vectorRepository } from '../vector.data-access.ts'

describe('Chat Data Access Layer', () => {
	// Mock data - properly typed
	const mockUserId = '123e4567-e89b-12d3-a456-426614174000'
	const mockChatId = 'chat-456-789-012'
	const mockMessageId = 'message-789-012-345'
	const mockVectorId = 'vector-012-345-678'

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

		// eslint-disable-next-line no-secrets/no-secrets
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
					// eslint-disable-next-line no-secrets/no-secrets
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

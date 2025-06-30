import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError } from '../../../utils/errors.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'

// Mock dependencies BEFORE any imports
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Mock AI service
vi.mock('../ai.service.ts', () => ({
	aiService: {
		generateEmbedding: vi.fn(),
		generateEmbeddings: vi.fn(),
		generateEmbeddingsBatch: vi.fn(),
	},
	AIService: vi.fn().mockImplementation(() => ({
		generateEmbedding: vi.fn(),
		generateEmbeddings: vi.fn(),
		generateEmbeddingsBatch: vi.fn(),
	})),
}))

// Mock vector repository
vi.mock('../vector.data-access.ts', () => ({
	vectorRepository: {
		createVector: vi.fn(),
		findVectorsByUserId: vi.fn(),
		findVectorsByChatId: vi.fn(),
		semanticSearch: vi.fn(),
		deleteVectorsByMessageId: vi.fn(),
		deleteVectorsByChatId: vi.fn(),
	},
}))

// Import after mocking
import type { AIService } from '../ai.service.ts'
import { aiService } from '../ai.service.ts'
import type {
	IVectorRepository,
	SemanticSearchOptions,
	SemanticSearchResult,
	TChatVector,
	TInsertChatVector,
} from '../chat.types.ts'
import { vectorRepository } from '../vector.data-access.ts'
import { VectorService } from '../vector.service.ts'

// Create proper mock types for the services
interface MockAIService {
	generateEmbedding: ReturnType<typeof vi.fn>
	generateEmbeddings: ReturnType<typeof vi.fn>
	generateEmbeddingsBatch: ReturnType<typeof vi.fn>
}

interface MockVectorRepository {
	createVector: ReturnType<typeof vi.fn>
	findVectorsByUserId: ReturnType<typeof vi.fn>
	findVectorsByChatId: ReturnType<typeof vi.fn>
	semanticSearch: ReturnType<typeof vi.fn>
	deleteVectorsByMessageId: ReturnType<typeof vi.fn>
	deleteVectorsByChatId: ReturnType<typeof vi.fn>
}

describe('VectorService', () => {
	let vectorService: VectorService
	let mockAIService: MockAIService
	let mockVectorRepository: MockVectorRepository

	// Mock data - properly typed
	const mockUserId = '123e4567-e89b-12d3-a456-426614174000'
	const mockChatId = 'chat-456-789-012'
	const mockMessageId = 'message-789-012-345'
	const mockVectorId = 'vector-012-345-678'

	const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5]

	const mockMessageData = {
		messageId: mockMessageId,
		chatId: mockChatId,
		userId: mockUserId,
		content: 'Hello, world!',
		metadata: { source: 'user' },
	}

	const mockInsertChatVector: TInsertChatVector = {
		messageId: mockMessageId,
		chatId: mockChatId,
		userId: mockUserId,
		content: 'Hello, world!',
		embedding: mockEmbedding,
		metadata: { source: 'user' },
	}

	const mockChatVector: TChatVector = {
		id: mockVectorId,
		userId: mockUserId,
		chatId: mockChatId,
		messageId: mockMessageId,
		content: 'Hello, world!',
		embedding: mockEmbedding,
		metadata: { source: 'user' },
		createdAt: new Date('2023-01-01T00:00:00Z'),
		updatedAt: new Date('2023-01-01T00:00:00Z'),
	}

	const mockSemanticSearchResult: SemanticSearchResult = {
		chatId: mockChatId,
		messageId: mockMessageId,
		content: 'Hello, world!',
		similarity: 0.95,
		metadata: { source: 'user' },
		createdAt: new Date('2023-01-01T00:00:00Z'),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockAIService = aiService as unknown as MockAIService
		mockVectorRepository = vectorRepository as unknown as MockVectorRepository
		vectorService = new VectorService(
			mockAIService as unknown as AIService,
			mockVectorRepository as unknown as IVectorRepository,
		)
	})

	describe('createMessageEmbedding', () => {
		it('should create message embedding successfully', async () => {
			// Arrange
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.createVector.mockResolvedValue([
				mockChatVector,
				null,
			])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbedding(mockMessageData)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(
				mockMessageData.content,
			)
			expect(mockVectorRepository.createVector).toHaveBeenCalledWith(
				mockInsertChatVector,
			)
			expect(result).toEqual(mockChatVector)
			expect(error).toBeNull()
		})

		it('should return error when AI service fails to generate embedding', async () => {
			// Arrange
			const aiError = new InternalError('AI service failed', 'test')
			mockAIService.generateEmbedding.mockResolvedValue([null, aiError])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbedding(mockMessageData)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(
				mockMessageData.content,
			)
			expect(mockVectorRepository.createVector).not.toHaveBeenCalled()
			expect(result).toBeNull()
			expect(error).toBe(aiError)
		})

		it('should return error when vector repository fails to store vector', async () => {
			// Arrange
			const dbError = new InternalError('Database error', 'test')
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.createVector.mockResolvedValue([null, dbError])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbedding(mockMessageData)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(
				mockMessageData.content,
			)
			expect(mockVectorRepository.createVector).toHaveBeenCalledWith(
				mockInsertChatVector,
			)
			expect(result).toBeNull()
			expect(error).toBe(dbError)
		})

		it('should handle message data without metadata', async () => {
			// Arrange
			const messageDataWithoutMetadata = {
				messageId: mockMessageId,
				chatId: mockChatId,
				userId: mockUserId,
				content: 'Hello, world!',
			}
			const expectedVectorData = {
				...mockInsertChatVector,
				metadata: {},
			}
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.createVector.mockResolvedValue([
				mockChatVector,
				null,
			])

			// Act
			const [result, error] = await vectorService.createMessageEmbedding(
				messageDataWithoutMetadata,
			)

			// Assert
			expect(mockVectorRepository.createVector).toHaveBeenCalledWith(
				expectedVectorData,
			)
			expect(result).toEqual(mockChatVector)
			expect(error).toBeNull()
		})

		it('should handle empty embedding array', async () => {
			// Arrange
			const emptyEmbedding: number[] = []
			mockAIService.generateEmbedding.mockResolvedValue([emptyEmbedding, null])
			mockVectorRepository.createVector.mockResolvedValue([
				mockChatVector,
				null,
			])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbedding(mockMessageData)

			// Assert
			expect(mockVectorRepository.createVector).toHaveBeenCalledWith({
				...mockInsertChatVector,
				embedding: emptyEmbedding,
			})
			expect(result).toEqual(mockChatVector)
			expect(error).toBeNull()
		})
	})

	describe('createMessageEmbeddingsBatch', () => {
		it('should create batch embeddings successfully', async () => {
			// Arrange
			const messagesData = [
				mockMessageData,
				{
					...mockMessageData,
					messageId: 'message-2',
					content: 'Second message',
				},
				{
					...mockMessageData,
					messageId: 'message-3',
					content: 'Third message',
				},
			]

			const mockVector1 = mockChatVector
			const mockVector2 = {
				...mockChatVector,
				id: 'vector-2',
				messageId: 'message-2',
			}
			const mockVector3 = {
				...mockChatVector,
				id: 'vector-3',
				messageId: 'message-3',
			}
			const mockVectors = [mockVector1, mockVector2, mockVector3]

			// Mock createMessageEmbedding to return success for all messages
			const createEmbeddingSpy = vi
				.spyOn(vectorService, 'createMessageEmbedding')
				.mockResolvedValueOnce([mockVector1, null])
				.mockResolvedValueOnce([mockVector2, null])
				.mockResolvedValueOnce([mockVector3, null])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbeddingsBatch(messagesData)

			// Assert
			expect(createEmbeddingSpy).toHaveBeenCalledTimes(3)
			expect(createEmbeddingSpy).toHaveBeenCalledWith(messagesData[0])
			expect(createEmbeddingSpy).toHaveBeenCalledWith(messagesData[1])
			expect(createEmbeddingSpy).toHaveBeenCalledWith(messagesData[2])
			expect(result).toEqual(mockVectors)
			expect(error).toBeNull()
		})

		it('should handle partial failures in batch processing', async () => {
			// Arrange
			const messagesData = [
				mockMessageData,
				{
					...mockMessageData,
					messageId: 'message-2',
					content: 'Second message',
				},
			]

			const batchError = new InternalError('Embedding failed', 'test')
			const createEmbeddingSpy = vi
				.spyOn(vectorService, 'createMessageEmbedding')
				.mockResolvedValueOnce([mockChatVector, null])
				.mockResolvedValueOnce([null, batchError])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbeddingsBatch(messagesData)

			// Assert
			expect(createEmbeddingSpy).toHaveBeenCalledTimes(2)
			expect(result).toBeNull()
			expect(error).toBe(batchError)
		})

		it('should handle empty messages array', async () => {
			// Arrange
			const messagesData: (typeof mockMessageData)[] = []

			// Act
			const [result, error] =
				await vectorService.createMessageEmbeddingsBatch(messagesData)

			// Assert
			expect(result).toEqual([])
			expect(error).toBeNull()
		})

		it('should process large batches in chunks', async () => {
			// Arrange
			const messagesData = Array.from({ length: 12 }, (_, i) => ({
				...mockMessageData,
				messageId: `message-${i.toString()}`,
				content: `Message ${i.toString()}`,
			}))

			const mockVectors = messagesData.map((msg, i) => ({
				...mockChatVector,
				id: `vector-${i.toString()}`,
				messageId: msg.messageId,
			}))

			// Mock createMessageEmbedding to return success for all messages
			const createEmbeddingSpy = vi.spyOn(
				vectorService,
				'createMessageEmbedding',
			)
			mockVectors.forEach((vector) => {
				createEmbeddingSpy.mockResolvedValueOnce([vector, null])
			})

			// Act
			const [result, error] =
				await vectorService.createMessageEmbeddingsBatch(messagesData)

			// Assert
			expect(createEmbeddingSpy).toHaveBeenCalledTimes(12)
			expect(result).toEqual(mockVectors)
			expect(error).toBeNull()
		})

		it('should return first error when multiple failures occur', async () => {
			// Arrange
			const messagesData = [
				mockMessageData,
				{
					...mockMessageData,
					messageId: 'message-2',
					content: 'Second message',
				},
				{
					...mockMessageData,
					messageId: 'message-3',
					content: 'Third message',
				},
			]

			const firstError = new InternalError('First error', 'test')
			const secondError = new InternalError('Second error', 'test')
			vi.spyOn(vectorService, 'createMessageEmbedding')
				.mockResolvedValueOnce([null, firstError])
				.mockResolvedValueOnce([null, secondError])
				.mockResolvedValueOnce([mockChatVector, null])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbeddingsBatch(messagesData)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(firstError)
		})
	})

	describe('semanticSearch', () => {
		const mockSearchOptions: SemanticSearchOptions = {
			query: 'test search query',
			userId: mockUserId,
			chatId: mockChatId,
			limit: 10,
			threshold: 0.7,
		}

		it('should perform semantic search successfully', async () => {
			// Arrange
			const mockSearchResults = [mockSemanticSearchResult]
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.semanticSearch.mockResolvedValue([
				mockSearchResults,
				null,
			])

			// Act
			const [result, error] =
				await vectorService.semanticSearch(mockSearchOptions)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(
				mockSearchOptions.query,
			)
			expect(mockVectorRepository.semanticSearch).toHaveBeenCalledWith(
				mockSearchOptions,
			)
			expect(result).toEqual(mockSearchResults)
			expect(error).toBeNull()
		})

		it('should return error when AI service fails to generate query embedding', async () => {
			// Arrange
			const aiError = new InternalError('AI service failed', 'test')
			mockAIService.generateEmbedding.mockResolvedValue([null, aiError])

			// Act
			const [result, error] =
				await vectorService.semanticSearch(mockSearchOptions)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(
				mockSearchOptions.query,
			)
			expect(mockVectorRepository.semanticSearch).not.toHaveBeenCalled()
			expect(result).toBeNull()
			expect(error).toBe(aiError)
		})

		it('should return error when vector repository search fails', async () => {
			// Arrange
			const searchError = new InternalError('Search failed', 'test')
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.semanticSearch.mockResolvedValue([null, searchError])

			// Act
			const [result, error] =
				await vectorService.semanticSearch(mockSearchOptions)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(
				mockSearchOptions.query,
			)
			expect(mockVectorRepository.semanticSearch).toHaveBeenCalledWith(
				mockSearchOptions,
			)
			expect(result).toBeNull()
			expect(error).toBe(searchError)
		})

		it('should handle empty search results', async () => {
			// Arrange
			const emptyResults: SemanticSearchResult[] = []
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.semanticSearch.mockResolvedValue([
				emptyResults,
				null,
			])

			// Act
			const [result, error] =
				await vectorService.semanticSearch(mockSearchOptions)

			// Assert
			expect(result).toEqual([])
			expect(error).toBeNull()
		})

		it('should use default limit and threshold when not provided', async () => {
			// Arrange
			const optionsWithoutDefaults = {
				query: 'test query',
				userId: mockUserId,
			}
			const expectedOptions = {
				...optionsWithoutDefaults,
				limit: 10,
				threshold: 0.7,
			}
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.semanticSearch.mockResolvedValue([[], null])

			// Act
			const [result, error] = await vectorService.semanticSearch(
				optionsWithoutDefaults,
			)

			// Assert
			expect(mockVectorRepository.semanticSearch).toHaveBeenCalledWith(
				expectedOptions,
			)
			expect(result).toEqual([])
			expect(error).toBeNull()
		})

		it('should handle search without chatId filter', async () => {
			// Arrange
			const optionsWithoutChatId = {
				query: 'test query',
				userId: mockUserId,
				limit: 5,
				threshold: 0.8,
			}
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.semanticSearch.mockResolvedValue([[], null])

			// Act
			const [result, error] =
				await vectorService.semanticSearch(optionsWithoutChatId)

			// Assert
			expect(mockVectorRepository.semanticSearch).toHaveBeenCalledWith(
				optionsWithoutChatId,
			)
			expect(result).toEqual([])
			expect(error).toBeNull()
		})

		it('should truncate long queries in logs', async () => {
			// Arrange
			const longQuery = 'a'.repeat(200)
			const optionsWithLongQuery = {
				...mockSearchOptions,
				query: longQuery,
			}
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.semanticSearch.mockResolvedValue([[], null])

			// Act
			const [result, error] =
				await vectorService.semanticSearch(optionsWithLongQuery)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(longQuery)
			expect(result).toEqual([])
			expect(error).toBeNull()
		})
	})

	describe('deleteMessageEmbedding', () => {
		it('should delete message embedding successfully', async () => {
			// Arrange
			mockVectorRepository.deleteVectorsByMessageId.mockResolvedValue([
				undefined,
				null,
			])

			// Act
			const [result, error] =
				await vectorService.deleteMessageEmbedding(mockMessageId)

			// Assert
			expect(
				mockVectorRepository.deleteVectorsByMessageId,
			).toHaveBeenCalledWith(mockMessageId)
			expect(result).toBeUndefined()
			expect(error).toBeNull()
		})

		it('should return error when repository deletion fails', async () => {
			// Arrange
			const deleteError = new InternalError('Delete failed', 'test')
			mockVectorRepository.deleteVectorsByMessageId.mockResolvedValue([
				null,
				deleteError,
			])

			// Act
			const [result, error] =
				await vectorService.deleteMessageEmbedding(mockMessageId)

			// Assert
			expect(
				mockVectorRepository.deleteVectorsByMessageId,
			).toHaveBeenCalledWith(mockMessageId)
			expect(result).toBeNull()
			expect(error).toBe(deleteError)
		})
	})

	describe('deleteChatEmbeddings', () => {
		it('should delete chat embeddings successfully', async () => {
			// Arrange
			mockVectorRepository.deleteVectorsByChatId.mockResolvedValue([
				undefined,
				null,
			])

			// Act
			const [result, error] =
				await vectorService.deleteChatEmbeddings(mockChatId)

			// Assert
			expect(mockVectorRepository.deleteVectorsByChatId).toHaveBeenCalledWith(
				mockChatId,
			)
			expect(result).toBeUndefined()
			expect(error).toBeNull()
		})

		it('should return error when repository deletion fails', async () => {
			// Arrange
			const deleteError = new InternalError('Delete failed', 'test')
			mockVectorRepository.deleteVectorsByChatId.mockResolvedValue([
				null,
				deleteError,
			])

			// Act
			const [result, error] =
				await vectorService.deleteChatEmbeddings(mockChatId)

			// Assert
			expect(mockVectorRepository.deleteVectorsByChatId).toHaveBeenCalledWith(
				mockChatId,
			)
			expect(result).toBeNull()
			expect(error).toBe(deleteError)
		})
	})

	describe('getUserEmbeddings', () => {
		it('should get user embeddings successfully', async () => {
			// Arrange
			const mockVectors = [
				mockChatVector,
				{ ...mockChatVector, id: 'vector-2' },
			]
			mockVectorRepository.findVectorsByUserId.mockResolvedValue([
				mockVectors,
				null,
			])

			// Act
			const [result, error] = await vectorService.getUserEmbeddings(mockUserId)

			// Assert
			expect(mockVectorRepository.findVectorsByUserId).toHaveBeenCalledWith(
				mockUserId,
			)
			expect(result).toEqual(mockVectors)
			expect(error).toBeNull()
		})

		it('should return error when repository query fails', async () => {
			// Arrange
			const queryError = new InternalError('Query failed', 'test')
			mockVectorRepository.findVectorsByUserId.mockResolvedValue([
				null,
				queryError,
			])

			// Act
			const [result, error] = await vectorService.getUserEmbeddings(mockUserId)

			// Assert
			expect(mockVectorRepository.findVectorsByUserId).toHaveBeenCalledWith(
				mockUserId,
			)
			expect(result).toBeNull()
			expect(error).toBe(queryError)
		})

		it('should handle empty user embeddings', async () => {
			// Arrange
			const emptyVectors: TChatVector[] = []
			mockVectorRepository.findVectorsByUserId.mockResolvedValue([
				emptyVectors,
				null,
			])

			// Act
			const [result, error] = await vectorService.getUserEmbeddings(mockUserId)

			// Assert
			expect(result).toEqual([])
			expect(error).toBeNull()
		})
	})

	describe('getChatEmbeddings', () => {
		it('should get chat embeddings successfully', async () => {
			// Arrange
			const mockVectors = [
				mockChatVector,
				{ ...mockChatVector, id: 'vector-2' },
			]
			mockVectorRepository.findVectorsByChatId.mockResolvedValue([
				mockVectors,
				null,
			])

			// Act
			const [result, error] = await vectorService.getChatEmbeddings(mockChatId)

			// Assert
			expect(mockVectorRepository.findVectorsByChatId).toHaveBeenCalledWith(
				mockChatId,
			)
			expect(result).toEqual(mockVectors)
			expect(error).toBeNull()
		})

		it('should return error when repository query fails', async () => {
			// Arrange
			const queryError = new InternalError('Query failed', 'test')
			mockVectorRepository.findVectorsByChatId.mockResolvedValue([
				null,
				queryError,
			])

			// Act
			const [result, error] = await vectorService.getChatEmbeddings(mockChatId)

			// Assert
			expect(mockVectorRepository.findVectorsByChatId).toHaveBeenCalledWith(
				mockChatId,
			)
			expect(result).toBeNull()
			expect(error).toBe(queryError)
		})

		it('should handle empty chat embeddings', async () => {
			// Arrange
			const emptyVectors: TChatVector[] = []
			mockVectorRepository.findVectorsByChatId.mockResolvedValue([
				emptyVectors,
				null,
			])

			// Act
			const [result, error] = await vectorService.getChatEmbeddings(mockChatId)

			// Assert
			expect(result).toEqual([])
			expect(error).toBeNull()
		})
	})

	describe('Edge Cases and Error Scenarios', () => {
		it('should handle AI service timeout in createMessageEmbedding', async () => {
			// Arrange
			const timeoutError = new InternalError('Request timeout', 'aiService')
			mockAIService.generateEmbedding.mockResolvedValue([null, timeoutError])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbedding(mockMessageData)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(timeoutError)
		})

		it('should handle very large embedding arrays', async () => {
			// Arrange
			const largeEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536)
			mockAIService.generateEmbedding.mockResolvedValue([largeEmbedding, null])
			mockVectorRepository.createVector.mockResolvedValue([
				mockChatVector,
				null,
			])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbedding(mockMessageData)

			// Assert
			expect(mockVectorRepository.createVector).toHaveBeenCalledWith({
				...mockInsertChatVector,
				embedding: largeEmbedding,
			})
			expect(result).toEqual(mockChatVector)
			expect(error).toBeNull()
		})

		it('should handle batch processing with single message', async () => {
			// Arrange
			const singleMessageData = [mockMessageData]
			const createEmbeddingSpy = vi
				.spyOn(vectorService, 'createMessageEmbedding')
				.mockResolvedValue([mockChatVector, null])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbeddingsBatch(singleMessageData)

			// Assert
			expect(createEmbeddingSpy).toHaveBeenCalledTimes(1)
			expect(result).toEqual([mockChatVector])
			expect(error).toBeNull()
		})

		it('should handle semantic search with very long query', async () => {
			// Arrange
			const veryLongQuery = 'a'.repeat(10000)
			const searchOptions = {
				query: veryLongQuery,
				userId: mockUserId,
				chatId: mockChatId,
				limit: 10,
				threshold: 0.7,
			}
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.semanticSearch.mockResolvedValue([[], null])

			// Act
			const [result, error] = await vectorService.semanticSearch(searchOptions)

			// Assert
			expect(mockAIService.generateEmbedding).toHaveBeenCalledWith(
				veryLongQuery,
			)
			expect(result).toEqual([])
			expect(error).toBeNull()
		})

		it('should handle batch processing with unknown error type', async () => {
			// Arrange
			const messagesData = [mockMessageData]
			const unknownError = new InternalError('Unknown error', 'test')
			vi.spyOn(vectorService, 'createMessageEmbedding').mockResolvedValue([
				null,
				unknownError,
			])

			// Act
			const [result, error] =
				await vectorService.createMessageEmbeddingsBatch(messagesData)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(unknownError)
		})

		it('should handle metadata with complex nested objects', async () => {
			// Arrange
			const complexMetadata = {
				source: 'user',
				context: {
					conversation: {
						id: 'conv-123',
						participants: ['user1', 'user2'],
					},
					timestamp: new Date().toISOString(),
				},
				tags: ['important', 'follow-up'],
			}
			const messageDataWithComplexMetadata = {
				...mockMessageData,
				metadata: complexMetadata,
			}
			const expectedVectorData = {
				...mockInsertChatVector,
				metadata: complexMetadata,
			}
			mockAIService.generateEmbedding.mockResolvedValue([mockEmbedding, null])
			mockVectorRepository.createVector.mockResolvedValue([
				mockChatVector,
				null,
			])

			// Act
			const [result, error] = await vectorService.createMessageEmbedding(
				messageDataWithComplexMetadata,
			)

			// Assert
			expect(mockVectorRepository.createVector).toHaveBeenCalledWith(
				expectedVectorData,
			)
			expect(result).toEqual(mockChatVector)
			expect(error).toBeNull()
		})
	})
})

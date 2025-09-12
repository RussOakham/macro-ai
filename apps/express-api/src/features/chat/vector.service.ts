import type {
	IVectorRepository,
	SemanticSearchOptions,
	SemanticSearchResult,
	TChatVector,
	TInsertChatVector,
} from './chat.types.ts'

import {
	type AppError,
	InternalError,
	type Result,
} from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
// oxlint-disable-next-line no-duplicate-imports
import { type AIService } from './ai.service.ts'

const { logger } = pino

/**
 * Redact query text to prevent PII exposure in logs
 * @param query The query text to redact
 * @returns Redacted query text
 */
const redactQuery = (query: string): string => {
	// Truncate to first 50 chars and add ellipsis
	const truncated = query.slice(0, 50)
	return truncated.length < query.length ? `${truncated}...` : truncated
}

/**
 * VectorService handles embedding generation and semantic search operations
 * Integrates with AI service for embedding generation and vector repository for storage
 */
export class VectorService {
	constructor(
		private readonly aiService: AIService,
		private readonly vectorRepository: IVectorRepository,
	) {}

	/**
	 * Generate and store embedding for a chat message
	 * @param messageData Message data for embedding generation
	 * @param messageData.messageId - Unique identifier for the message
	 * @param messageData.chatId - Chat ID the message belongs to
	 * @param messageData.userId - User ID who sent the message
	 * @param messageData.content - Message content to embed
	 * @param messageData.metadata - Additional metadata for the embedding
	 * @returns Result tuple with created vector or error
	 */
	public async createMessageEmbedding(messageData: {
		messageId: string
		chatId: string
		userId: string
		content: string
		metadata?: Record<string, unknown>
	}): Promise<Result<TChatVector>> {
		const { messageId, chatId, userId, content, metadata = {} } = messageData

		// Generate embedding using AI service
		const [embedding, embeddingError] =
			await this.aiService.generateEmbedding(content)
		if (embeddingError) {
			logger.error({
				msg: 'Failed to generate embedding for message',
				messageId,
				error: embeddingError,
			})
			return [null, embeddingError]
		}

		// Prepare vector data for storage
		const vectorData: TInsertChatVector = {
			messageId,
			chatId,
			userId,
			content,
			embedding,
			metadata,
		}

		// Store vector in database
		const [vector, vectorError] =
			await this.vectorRepository.createVector(vectorData)
		if (vectorError) {
			logger.error({
				msg: 'Failed to store vector for message',
				messageId,
				error: vectorError,
			})
			return [null, vectorError]
		}

		logger.info({
			msg: 'Successfully created message embedding',
			messageId,
			chatId,
			userId,
			embeddingDimensions: embedding.length,
		})

		return [vector, null]
	}

	/**
	 * Generate embeddings for multiple messages in batch
	 * @param messagesData Array of message data for embedding generation
	 * @returns Result tuple with created vectors array or error
	 */
	public async createMessageEmbeddingsBatch(
		messagesData: {
			messageId: string
			chatId: string
			userId: string
			content: string
			metadata?: Record<string, unknown>
		}[],
	): Promise<Result<TChatVector[]>> {
		const vectors: TChatVector[] = []
		const errors: AppError[] = []

		// Process messages in parallel batches
		const batchSize = 5 // Configurable batch size
		for (let i = 0; i < messagesData.length; i += batchSize) {
			const batch = messagesData.slice(i, i + batchSize)

			const batchPromises = batch.map(async (messageData) => {
				const [vector, error] = await this.createMessageEmbedding(messageData)
				if (error) {
					errors.push(error)
					return null
				}
				return vector
			})

			const batchResults = await Promise.all(batchPromises)

			// Collect successful results
			for (const result of batchResults) {
				if (result) {
					vectors.push(result)
				}
			}
		}

		// If any errors occurred, return the first one
		if (errors.length > 0) {
			logger.error({
				msg: 'Batch embedding generation had errors',
				totalMessages: messagesData.length,
				successfulEmbeddings: vectors.length,
				errorCount: errors.length,
			})
			const [firstError] = errors
			return [
				null,
				firstError ??
					new InternalError('Unknown batch processing error', 'vectorService'),
			]
		}

		logger.info({
			msg: 'Successfully created batch message embeddings',
			totalMessages: messagesData.length,
			successfulEmbeddings: vectors.length,
		})

		return [vectors, null]
	}

	/**
	 * Perform semantic search across chat messages
	 * @param options Search options including query, user context, and filters
	 * @returns Result tuple with search results or error
	 */
	public async semanticSearch(
		options: SemanticSearchOptions,
	): Promise<Result<SemanticSearchResult[]>> {
		const { query, userId, chatId, limit = 10, threshold = 0.7 } = options

		// Generate embedding for the search query
		const [queryEmbedding, embeddingError] =
			await this.aiService.generateEmbedding(query)
		if (embeddingError) {
			logger.error({
				msg: 'Failed to generate embedding for search query',
				query: redactQuery(query),
				userId,
				error: embeddingError,
			})
			return [null, embeddingError]
		}

		// TODO: Implement actual semantic search with the query embedding
		// For now, delegate to the vector repository (which has placeholder implementation)
		const [results, searchError] = await this.vectorRepository.semanticSearch({
			query,
			userId,
			chatId,
			limit,
			threshold,
		})

		if (searchError) {
			logger.error({
				msg: 'Semantic search failed',
				query: redactQuery(query),
				userId,
				chatId,
				error: searchError,
			})
			return [null, searchError]
		}

		logger.info({
			msg: 'Semantic search completed',
			query: redactQuery(query),
			userId,
			chatId,
			resultsCount: results.length,
			embeddingDimensions: queryEmbedding.length,
		})

		return [results, null]
	}

	/**
	 * Delete embeddings for a specific message
	 * @param messageId The message ID to delete embeddings for
	 * @returns Result tuple with void or error
	 */
	public async deleteMessageEmbedding(
		messageId: string,
	): Promise<Result<void>> {
		const [, error] =
			await this.vectorRepository.deleteVectorsByMessageId(messageId)
		if (error) {
			logger.error({
				msg: 'Failed to delete message embedding',
				messageId,
				error,
			})
			return [null, error]
		}

		logger.info({
			msg: 'Successfully deleted message embedding',
			messageId,
		})

		return [undefined, null]
	}

	/**
	 * Delete all embeddings for a specific chat
	 * @param chatId The chat ID to delete embeddings for
	 * @returns Result tuple with void or error
	 */
	public async deleteChatEmbeddings(chatId: string): Promise<Result<void>> {
		const [, error] = await this.vectorRepository.deleteVectorsByChatId(chatId)
		if (error) {
			logger.error({
				msg: 'Failed to delete chat embeddings',
				chatId,
				error,
			})
			return [null, error]
		}

		logger.info({
			msg: 'Successfully deleted chat embeddings',
			chatId,
		})

		return [undefined, null]
	}

	/**
	 * Get embeddings for a specific user
	 * @param userId The user ID to get embeddings for
	 * @returns Result tuple with vectors array or error
	 */
	public async getUserEmbeddings(
		userId: string,
	): Promise<Result<TChatVector[]>> {
		const [vectors, error] =
			await this.vectorRepository.findVectorsByUserId(userId)
		if (error) {
			logger.error({
				msg: 'Failed to get user embeddings',
				userId,
				error,
			})
			return [null, error]
		}

		logger.info({
			msg: 'Successfully retrieved user embeddings',
			userId,
			vectorCount: vectors.length,
		})

		return [vectors, null]
	}

	/**
	 * Get embeddings for a specific chat
	 * @param chatId The chat ID to get embeddings for
	 * @returns Result tuple with vectors array or error
	 */
	public async getChatEmbeddings(
		chatId: string,
	): Promise<Result<TChatVector[]>> {
		const [vectors, error] =
			await this.vectorRepository.findVectorsByChatId(chatId)
		if (error) {
			logger.error({
				msg: 'Failed to get chat embeddings',
				chatId,
				error,
			})
			return [null, error]
		}

		logger.info({
			msg: 'Successfully retrieved chat embeddings',
			chatId,
			vectorCount: vectors.length,
		})

		return [vectors, null]
	}
}

// Create and export singleton instance
// Import dependencies here to avoid circular dependency
import { aiService } from './ai.service.ts'
import { vectorRepository } from './vector.data-access.ts'
export const vectorService = new VectorService(aiService, vectorRepository)

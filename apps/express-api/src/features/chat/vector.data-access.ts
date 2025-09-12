import { desc, eq, type SQL } from 'drizzle-orm'

import type {
	IVectorRepository,
	SemanticSearchOptions,
	SemanticSearchResult,
	TChatVector,
	TInsertChatVector,
} from './chat.types.ts'

import { db } from '../../data-access/db.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError, InternalError, Result } from '../../utils/errors.ts'
import { safeValidateSchema } from '../../utils/response-handlers.ts'
import { chatVectorsTable, selectChatVectorSchema } from './chat.schemas.ts'

/**
 * VectorRepository class that implements the IVectorRepository interface
 * Handles all vector/embedding-related database operations for semantic search
 */
class VectorRepository implements IVectorRepository {
	private readonly db: typeof db

	constructor(database: typeof db = db) {
		this.db = database
	}

	/**
	 * Create a new vector/embedding
	 * @param vectorData The vector data to insert
	 * @returns Result tuple with the created vector object
	 */
	public createVector = async (
		vectorData: TInsertChatVector,
	): Promise<Result<TChatVector>> => {
		const [vector, error] = await tryCatch(
			this.db.insert(chatVectorsTable).values(vectorData).returning(),
			'vectorRepository - createVector',
		)

		if (error) {
			return [null, error]
		}

		// If no vector created, return error
		if (!vector.length) {
			return [
				null,
				new InternalError(
					'Failed to create vector',
					'vectorRepository - createVector',
				),
			]
		}

		const [createdVector] = vector
		if (!createdVector) {
			return [
				null,
				new InternalError(
					'Failed to create vector',
					'vectorRepository - createVector',
				),
			]
		}

		// Validate the returned vector with Zod
		const [validationResult, validationError] = safeValidateSchema(
			createdVector,
			selectChatVectorSchema,
			'vectorRepository - createVector',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'vectorRepository - createVector'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Generic helper method to find vectors with a given filter condition
	 * @param filterCondition The SQL filter condition to apply
	 * @param methodName The method name for error context
	 * @returns Result tuple with validated vectors array
	 */
	private async findVectorsWithFilter(
		filterCondition: SQL,
		methodName: string,
	): Promise<Result<TChatVector[]>> {
		const [vectors, error] = await tryCatch(
			this.db
				.select()
				.from(chatVectorsTable)
				.where(filterCondition)
				.orderBy(desc(chatVectorsTable.createdAt)),
			`vectorRepository - ${methodName}`,
		)

		if (error) {
			return [null, error]
		}

		// Validate each vector
		const validatedVectors: TChatVector[] = []
		for (const vector of vectors) {
			const [validationResult, validationError] = safeValidateSchema(
				vector,
				selectChatVectorSchema,
				`vectorRepository - ${methodName}`,
			)

			if (validationError) {
				return [
					null,
					AppError.from(validationError, `vectorRepository - ${methodName}`),
				]
			}

			validatedVectors.push(validationResult)
		}

		return [validatedVectors, null]
	}

	/**
	 * Find vectors by user ID
	 * @param userId The user's unique identifier
	 * @returns Result tuple with vectors array
	 */
	public findVectorsByUserId = async (
		userId: string,
	): Promise<Result<TChatVector[]>> => {
		return await this.findVectorsWithFilter(
			eq(chatVectorsTable.userId, userId),
			'findVectorsByUserId',
		)
	}

	/**
	 * Find vectors by chat ID
	 * @param chatId The chat's unique identifier
	 * @returns Result tuple with vectors array
	 */
	public findVectorsByChatId = async (
		chatId: string,
	): Promise<Result<TChatVector[]>> => {
		return await this.findVectorsWithFilter(
			eq(chatVectorsTable.chatId, chatId),
			// eslint-disable-next-line no-secrets/no-secrets
			'findVectorsByChatId',
		)
	}

	/**
	 * Perform semantic search using pgvector similarity
	 * @param options Search options including query, limit, threshold, and user context
	 * @returns Result tuple with search results array
	 */
	// eslint-disable-next-line class-methods-use-this
	public semanticSearch = async (
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		options: SemanticSearchOptions,
	): Promise<Result<SemanticSearchResult[]>> => {
		// Note: In a real implementation, this would:
		// 1. Extract userId, chatId, limit, threshold from options
		// 2. Generate embedding for the search query using AI service
		// 3. Execute pgvector similarity search with the embedding
		// 4. Return results ordered by similarity score
		//
		// Example query structure:
		// SELECT chat_id, message_id, content,
		//        1 - (embedding <=> $queryEmbedding) as similarity,
		//        metadata, created_at
		// FROM chat_vectors
		// WHERE user_id = $userId
		//   AND ($chatId IS NULL OR chat_id = $chatId)
		//   AND 1 - (embedding <=> $queryEmbedding) >= $threshold
		// ORDER BY similarity DESC
		// LIMIT $limit

		// For now, return empty results as placeholder
		// TODO: Implement actual semantic search with embeddings
		const [results, error] = await tryCatch(
			Promise.resolve([]) as Promise<SemanticSearchResult[]>,
			'vectorRepository - semanticSearch',
		)

		if (error) {
			return [null, error]
		}

		return [results, null]
	}

	/**
	 * Delete vectors by message ID
	 * @param messageId The message's unique identifier
	 * @returns Result tuple with void or error
	 */
	public deleteVectorsByMessageId = async (
		messageId: string,
	): Promise<Result<void>> => {
		const [, error] = await tryCatch(
			this.db
				.delete(chatVectorsTable)
				.where(eq(chatVectorsTable.messageId, messageId)),
			'vectorRepository - deleteVectorsByMessageId',
		)

		if (error) {
			return [null, error]
		}

		return [undefined, null]
	}

	/**
	 * Delete vectors by chat ID
	 * @param chatId The chat's unique identifier
	 * @returns Result tuple with void or error
	 */
	public deleteVectorsByChatId = async (
		chatId: string,
	): Promise<Result<void>> => {
		const [, error] = await tryCatch(
			this.db
				.delete(chatVectorsTable)
				.where(eq(chatVectorsTable.chatId, chatId)),
			'vectorRepository - deleteVectorsByChatId',
		)

		if (error) {
			return [null, error]
		}

		return [undefined, null]
	}
}

const vectorRepository = new VectorRepository()

export { vectorRepository }

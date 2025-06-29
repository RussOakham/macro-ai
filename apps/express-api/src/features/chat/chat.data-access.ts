import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError, InternalError, Result } from '../../utils/errors.ts'
import { safeValidateSchema } from '../../utils/response-handlers.ts'

import {
	chatMessagesTable,
	chatsTable,
	chatVectorsTable,
	selectChatSchema,
	selectChatVectorSchema,
	selectMessageSchema,
} from './chat.schemas.ts'
import type {
	IChatRepository,
	IMessageRepository,
	IVectorRepository,
	PaginationOptions,
	SemanticSearchOptions,
	SemanticSearchResult,
	TChat,
	TChatMessage,
	TChatVector,
	TInsertChat,
	TInsertChatMessage,
	TInsertChatVector,
} from './chat.types.ts'

/**
 * ChatRepository class that implements the IChatRepository interface
 * Handles all chat-related database operations
 */
class ChatRepository implements IChatRepository {
	private readonly db: typeof db

	constructor(database: typeof db = db) {
		this.db = database
	}

	/**
	 * Find a chat by ID
	 * @param id The chat's unique identifier
	 * @returns Result tuple with the chat object or undefined if not found
	 */
	public findChatById = async (
		id: string,
	): Promise<Result<TChat | undefined>> => {
		const [chats, error] = await tryCatch(
			this.db.select().from(chatsTable).where(eq(chatsTable.id, id)).limit(1),
			'chatRepository - findChatById',
		)

		if (error) {
			return [null, error]
		}

		// If no chat found, return undefined
		if (!chats.length) return [undefined, null]

		// Validate the returned chat with Zod
		const [validationResult, validationError] = safeValidateSchema(
			chats[0],
			selectChatSchema,
			'chatRepository - findChatById',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'chatRepository - findChatById'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Find chats by user ID with pagination
	 * @param userId The user's unique identifier
	 * @param options Pagination options
	 * @returns Result tuple with chats array and total count
	 */
	public findChatsByUserId = async (
		userId: string,
		options: PaginationOptions = {},
	): Promise<Result<{ chats: TChat[]; total: number }>> => {
		const { page = 1, limit = 20 } = options
		const offset = (page - 1) * limit

		// Get chats with pagination
		const [chats, chatsError] = await tryCatch(
			this.db
				.select()
				.from(chatsTable)
				.where(eq(chatsTable.userId, userId))
				.orderBy(desc(chatsTable.updatedAt))
				.limit(limit)
				.offset(offset),
			'chatRepository - findChatsByUserId',
		)

		if (chatsError) {
			return [null, chatsError]
		}

		// Get total count for pagination
		const [totalResult, totalError] = await tryCatch(
			this.db
				.select({ count: sql<number>`count(*)` })
				.from(chatsTable)
				.where(eq(chatsTable.userId, userId)),
			'chatRepository - findChatsByUserId - count',
		)

		if (totalError) {
			return [null, totalError]
		}

		const total = totalResult[0]?.count ?? 0

		// Validate each chat
		const validatedChats: TChat[] = []
		for (const chat of chats) {
			const [validationResult, validationError] = safeValidateSchema(
				chat,
				selectChatSchema,
				'chatRepository - findChatsByUserId',
			)

			if (validationError) {
				return [
					null,
					AppError.from(validationError, 'chatRepository - findChatsByUserId'),
				]
			}

			validatedChats.push(validationResult)
		}

		return [{ chats: validatedChats, total }, null]
	}

	/**
	 * Create a new chat
	 * @param chatData The chat data to insert
	 * @returns Result tuple with the created chat object
	 */
	public createChat = async (chatData: TInsertChat): Promise<Result<TChat>> => {
		const [chat, error] = await tryCatch(
			this.db.insert(chatsTable).values(chatData).returning(),
			'chatRepository - createChat',
		)

		if (error) {
			return [null, error]
		}

		// If no chat created, return error
		if (!chat.length) {
			return [
				null,
				new InternalError(
					'Failed to create chat',
					'chatRepository - createChat',
				),
			]
		}

		const createdChat = chat[0]
		if (!createdChat) {
			return [
				null,
				new InternalError(
					'Failed to create chat',
					'chatRepository - createChat',
				),
			]
		}

		// Validate the returned chat with Zod
		const [validationResult, validationError] = safeValidateSchema(
			createdChat,
			selectChatSchema,
			'chatRepository - createChat',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'chatRepository - createChat'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Update a chat
	 * @param id The chat's unique identifier
	 * @param chatData The chat data to update
	 * @returns Result tuple with the updated chat object or undefined if not found
	 */
	public updateChat = async (
		id: string,
		chatData: Partial<TInsertChat>,
	): Promise<Result<TChat | undefined>> => {
		const [chat, error] = await tryCatch(
			this.db
				.update(chatsTable)
				.set(chatData)
				.where(eq(chatsTable.id, id))
				.returning(),
			'chatRepository - updateChat',
		)

		if (error) {
			return [null, error]
		}

		// If no chat found, return undefined
		if (!chat.length) return [undefined, null]

		const updatedChat = chat[0]
		if (!updatedChat) return [undefined, null]

		// Validate the returned chat with Zod
		const [validationResult, validationError] = safeValidateSchema(
			updatedChat,
			selectChatSchema,
			'chatRepository - updateChat',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'chatRepository - updateChat'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Delete a chat
	 * @param id The chat's unique identifier
	 * @returns Result tuple with void or error
	 */
	public deleteChat = async (id: string): Promise<Result<void>> => {
		const [, error] = await tryCatch(
			this.db.delete(chatsTable).where(eq(chatsTable.id, id)),
			'chatRepository - deleteChat',
		)

		if (error) {
			return [null, error]
		}

		return [undefined, null]
	}

	/**
	 * Verify that a user owns a specific chat
	 * @param chatId The chat ID to verify
	 * @param userId The user ID to verify ownership
	 * @returns Result tuple with boolean ownership status or error
	 */
	public verifyChatOwnership = async (
		chatId: string,
		userId: string,
	): Promise<Result<boolean>> => {
		const [chat, error] = await tryCatch(
			this.db
				.select({ id: chatsTable.id })
				.from(chatsTable)
				.where(and(eq(chatsTable.id, chatId), eq(chatsTable.userId, userId)))
				.limit(1),
			'chatRepository - verifyChatOwnership',
		)

		if (error) {
			return [null, error]
		}

		return [chat.length > 0, null]
	}

	/**
	 * Update chat timestamp
	 * @param chatId The chat's unique identifier
	 * @returns Result tuple with void or error
	 */
	public updateChatTimestamp = async (
		chatId: string,
	): Promise<Result<void>> => {
		const [, error] = await tryCatch(
			this.db
				.update(chatsTable)
				.set({ updatedAt: new Date() })
				.where(eq(chatsTable.id, chatId)),
			'chatRepository - updateChatTimestamp',
		)

		if (error) {
			return [null, error]
		}

		return [undefined, null]
	}
}

/**
 * MessageRepository class that implements the IMessageRepository interface
 * Handles all message-related database operations
 */
class MessageRepository implements IMessageRepository {
	private readonly db: typeof db

	constructor(database: typeof db = db) {
		this.db = database
	}

	/**
	 * Find a message by ID
	 * @param id The message's unique identifier
	 * @returns Result tuple with the message object or undefined if not found
	 */
	public findMessageById = async (
		id: string,
	): Promise<Result<TChatMessage | undefined>> => {
		const [messages, error] = await tryCatch(
			this.db
				.select()
				.from(chatMessagesTable)
				.where(eq(chatMessagesTable.id, id))
				.limit(1),
			'messageRepository - findMessageById',
		)

		if (error) {
			return [null, error]
		}

		// If no message found, return undefined
		if (!messages.length) return [undefined, null]

		// Validate the returned message with Zod
		const [validationResult, validationError] = safeValidateSchema(
			messages[0],
			selectMessageSchema,
			'messageRepository - findMessageById',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'messageRepository - findMessageById'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Find messages by chat ID
	 * @param chatId The chat's unique identifier
	 * @returns Result tuple with messages array
	 */
	public findMessagesByChatId = async (
		chatId: string,
	): Promise<Result<TChatMessage[]>> => {
		const [messages, error] = await tryCatch(
			this.db
				.select()
				.from(chatMessagesTable)
				.where(eq(chatMessagesTable.chatId, chatId))
				.orderBy(chatMessagesTable.createdAt),
			'messageRepository - findMessagesByChatId',
		)

		if (error) {
			return [null, error]
		}

		// Validate each message
		const validatedMessages: TChatMessage[] = []
		for (const message of messages) {
			const [validationResult, validationError] = safeValidateSchema(
				message,
				selectMessageSchema,
				'messageRepository - findMessagesByChatId',
			)

			if (validationError) {
				return [
					null,
					AppError.from(
						validationError,
						'messageRepository - findMessagesByChatId',
					),
				]
			}

			validatedMessages.push(validationResult)
		}

		return [validatedMessages, null]
	}

	/**
	 * Create a new message
	 * @param messageData The message data to insert
	 * @returns Result tuple with the created message object
	 */
	public createMessage = async (
		messageData: TInsertChatMessage,
	): Promise<Result<TChatMessage>> => {
		const [message, error] = await tryCatch(
			this.db.insert(chatMessagesTable).values(messageData).returning(),
			'messageRepository - createMessage',
		)

		if (error) {
			return [null, error]
		}

		// If no message created, return error
		if (!message.length) {
			return [
				null,
				new InternalError(
					'Failed to create message',
					'messageRepository - createMessage',
				),
			]
		}

		const createdMessage = message[0]
		if (!createdMessage) {
			return [
				null,
				new InternalError(
					'Failed to create message',
					'messageRepository - createMessage',
				),
			]
		}

		// Validate the returned message with Zod
		const [validationResult, validationError] = safeValidateSchema(
			createdMessage,
			selectMessageSchema,
			'messageRepository - createMessage',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'messageRepository - createMessage'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Update a message
	 * @param id The message's unique identifier
	 * @param messageData The message data to update
	 * @returns Result tuple with the updated message object or undefined if not found
	 */
	public updateMessage = async (
		id: string,
		messageData: Partial<TInsertChatMessage>,
	): Promise<Result<TChatMessage | undefined>> => {
		const [message, error] = await tryCatch(
			this.db
				.update(chatMessagesTable)
				.set(messageData)
				.where(eq(chatMessagesTable.id, id))
				.returning(),
			'messageRepository - updateMessage',
		)

		if (error) {
			return [null, error]
		}

		// If no message found, return undefined
		if (!message.length) return [undefined, null]

		const updatedMessage = message[0]
		if (!updatedMessage) return [undefined, null]

		// Validate the returned message with Zod
		const [validationResult, validationError] = safeValidateSchema(
			updatedMessage,
			selectMessageSchema,
			'messageRepository - updateMessage',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'messageRepository - updateMessage'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Delete a message
	 * @param id The message's unique identifier
	 * @returns Result tuple with void or error
	 */
	public deleteMessage = async (id: string): Promise<Result<void>> => {
		const [, error] = await tryCatch(
			this.db.delete(chatMessagesTable).where(eq(chatMessagesTable.id, id)),
			'messageRepository - deleteMessage',
		)

		if (error) {
			return [null, error]
		}

		return [undefined, null]
	}

	/**
	 * Get chat history formatted for AI service
	 * @param chatId The chat's unique identifier
	 * @returns Result tuple with formatted chat history
	 */
	public getChatHistory = async (
		chatId: string,
	): Promise<
		Result<{ role: 'user' | 'assistant' | 'system'; content: string }[]>
	> => {
		const [messages, error] = await this.findMessagesByChatId(chatId)

		if (error) {
			return [null, error]
		}

		// Convert to AI service format
		const chatHistory = messages.map((msg) => ({
			role: msg.role as 'user' | 'assistant' | 'system',
			content: msg.content,
		}))

		return [chatHistory, null]
	}
}

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

		const createdVector = vector[0]
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
	 * Find vectors by user ID
	 * @param userId The user's unique identifier
	 * @returns Result tuple with vectors array
	 */
	public findVectorsByUserId = async (
		userId: string,
	): Promise<Result<TChatVector[]>> => {
		const [vectors, error] = await tryCatch(
			this.db
				.select()
				.from(chatVectorsTable)
				.where(eq(chatVectorsTable.userId, userId))
				.orderBy(desc(chatVectorsTable.createdAt)),
			'vectorRepository - findVectorsByUserId',
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
				'vectorRepository - findVectorsByUserId',
			)

			if (validationError) {
				return [
					null,
					AppError.from(
						validationError,
						'vectorRepository - findVectorsByUserId',
					),
				]
			}

			validatedVectors.push(validationResult)
		}

		return [validatedVectors, null]
	}

	/**
	 * Find vectors by chat ID
	 * @param chatId The chat's unique identifier
	 * @returns Result tuple with vectors array
	 */
	public findVectorsByChatId = async (
		chatId: string,
	): Promise<Result<TChatVector[]>> => {
		const [vectors, error] = await tryCatch(
			this.db
				.select()
				.from(chatVectorsTable)
				.where(eq(chatVectorsTable.chatId, chatId))
				.orderBy(desc(chatVectorsTable.createdAt)),
			'vectorRepository - findVectorsByChatId',
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
				'vectorRepository - findVectorsByChatId',
			)

			if (validationError) {
				return [
					null,
					AppError.from(
						validationError,
						'vectorRepository - findVectorsByChatId',
					),
				]
			}

			validatedVectors.push(validationResult)
		}

		return [validatedVectors, null]
	}

	/**
	 * Perform semantic search using pgvector similarity
	 * @param options Search options including query, limit, threshold, and user context
	 * @returns Result tuple with search results array
	 */
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

// Create instances of the repositories
const chatRepository = new ChatRepository()
const messageRepository = new MessageRepository()
const vectorRepository = new VectorRepository()

export { chatRepository, messageRepository, vectorRepository }

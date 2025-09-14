import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError, InternalError, type Result } from '../../utils/errors.ts'
import { safeValidateSchema } from '../../utils/response-handlers.ts'
import { chatsTable, selectChatSchema } from './chat.schemas.ts'
import type {
	IChatRepository,
	PaginationOptions,
	TChat,
	TInsertChat,
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

		const [createdChat] = chat
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

		const total = Number(totalResult[0]?.count ?? 0)

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

		const [updatedChat] = chat
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
}

// Create instances of the repositories
const chatRepository = new ChatRepository()

export { chatRepository }

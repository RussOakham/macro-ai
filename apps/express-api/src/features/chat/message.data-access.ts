import { eq } from 'drizzle-orm'

import type {
	IMessageRepository,
	TChatMessage,
	TInsertChatMessage,
} from './chat.types.ts'

import { db } from '../../data-access/db.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError, InternalError, Result } from '../../utils/errors.ts'
import { safeValidateSchema } from '../../utils/response-handlers.ts'
import { chatMessagesTable, selectMessageSchema } from './chat.schemas.ts'

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

		const [createdMessage] = message
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

		const [updatedMessage] = message
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

const messageRepository = new MessageRepository()

export { messageRepository }

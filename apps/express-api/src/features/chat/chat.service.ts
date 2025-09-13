import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import {
	NotFoundError,
	type Result,
	UnauthorizedError,
	ValidationError,
} from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
// oxlint-disable-next-line no-duplicate-imports
import { type AIService } from './ai.service.ts'
import type {
	ChatWithMessages,
	IChatRepository,
	IChatService,
	IMessageRepository,
	PaginationOptions,
	SemanticSearchOptions,
	SemanticSearchResult,
	TChat,
	TChatMessage,
} from './chat.types.ts'
// oxlint-disable-next-line no-duplicate-imports
import { type VectorService } from './vector.service.ts'

const { logger } = pino

// Type alias for message roles
type MessageRole = 'assistant' | 'system' | 'user'

// Interface for chat message with AI role
interface ChatMessageWithRole {
	role: MessageRole
	content: string
}

// Interface for message creation
interface SendMessageRequest {
	chatId: string
	userId: string
	content: string
	role?: MessageRole
}

// Interface for streaming response
interface StreamingResponse {
	messageId: string
	stream: AsyncIterable<string>
}

/**
 * ChatService handles all chat-related business logic
 * Provides Go-style error handling for all operations
 * Uses repository pattern for data access and includes vector/embedding integration
 */
export class ChatService implements IChatService {
	constructor(
		private readonly aiService: AIService,
		private readonly vectorService: VectorService,
		private readonly chatRepository: IChatRepository,
		private readonly messageRepository: IMessageRepository,
	) {}

	/**
	 * Create a new chat for a user
	 * @param request - Chat creation request
	 * @param request.userId - User ID creating the chat
	 * @param request.title - Title for the new chat
	 * @returns Result tuple with created chat or error
	 */
	public async createChat(request: {
		userId: string
		title: string
	}): Promise<Result<TChat>> {
		// Validate input
		const [validatedRequest, validationError] =
			this.validateCreateChatRequest(request)
		if (validationError) {
			return [null, validationError]
		}

		// Create chat using repository
		const [createdChat, error] = await this.chatRepository.createChat({
			userId: validatedRequest.userId,
			title: validatedRequest.title,
		})

		if (error) {
			return [null, error]
		}

		logger.info({
			msg: 'Chat created successfully',
			chatId: createdChat.id,
			userId: validatedRequest.userId,
		})

		return [createdChat, null]
	}

	/**
	 * Delete a chat and all its messages (ownership verification required)
	 * @param chatId - The ID of the chat to delete
	 * @param userId - The ID of the user requesting deletion (must own the chat)
	 * @returns Result tuple with void on success or error
	 */
	public async deleteChat(
		chatId: string,
		userId: string,
	): Promise<Result<void>> {
		// Verify ownership first
		const [isOwner, ownershipError] = await this.verifyChatOwnership(
			chatId,
			userId,
		)
		if (ownershipError) {
			return [null, ownershipError]
		}

		if (!isOwner) {
			return [
				null,
				new UnauthorizedError(
					'User does not have access to this chat',
					'chatService',
				),
			]
		}

		// Delete chat embeddings first
		await this.vectorService.deleteChatEmbeddings(chatId)

		// Delete chat (messages will be deleted by cascade)
		const [, error] = await this.chatRepository.deleteChat(chatId)
		if (error) {
			return [null, error]
		}

		logger.info({
			msg: 'Chat deleted successfully',
			chatId,
			userId,
		})

		return [undefined, null]
	}

	/**
	 * Get a specific chat with its messages
	 * @param chatId - The chat ID
	 * @param userId - The user ID for ownership verification
	 * @returns Result tuple with chat and messages or error
	 */
	public async getChatWithMessages(
		chatId: string,
		userId: string,
	): Promise<Result<ChatWithMessages>> {
		// Verify ownership first
		const [isOwner, ownershipError] = await this.verifyChatOwnership(
			chatId,
			userId,
		)
		if (ownershipError) {
			return [null, ownershipError]
		}

		if (!isOwner) {
			return [
				null,
				new UnauthorizedError(
					'User does not have access to this chat',
					'chatService',
				),
			]
		}

		// Get chat details using repository
		const [chat, chatError] = await this.chatRepository.findChatById(chatId)
		if (chatError) {
			return [null, chatError]
		}

		if (!chat) {
			return [null, new NotFoundError('Chat not found', 'chatService')]
		}

		// Get messages for the chat using repository
		const [messages, messagesError] =
			await this.messageRepository.findMessagesByChatId(chatId)
		if (messagesError) {
			return [null, messagesError]
		}

		const chatWithMessages: ChatWithMessages = {
			...chat,
			messages,
		}

		return [chatWithMessages, null]
	}

	/**
	 * Get all chats for a specific user with pagination
	 * @param userId - The ID of the user to get chats for
	 * @param options - Pagination options (page, limit)
	 * @returns Result tuple with paginated chats and total count or error
	 */
	public async getUserChats(
		userId: string,
		options: PaginationOptions = {},
	): Promise<Result<{ chats: TChat[]; total: number }>> {
		const { page = 1, limit = 20 } = options

		// Validate pagination parameters
		// Check if page and limit are integers
		if (!Number.isInteger(page) || !Number.isInteger(limit)) {
			return [
				null,
				new ValidationError(
					'Invalid pagination parameters: page and limit must be integers',
					{ page, limit },
					'chatService',
				),
			]
		}

		// Check if page and limit are within valid ranges
		if (page < 1 || limit < 1 || limit > 100) {
			return [
				null,
				new ValidationError(
					'Invalid pagination parameters: page must be >= 1, limit must be between 1 and 100',
					{ page, limit },
					'chatService',
				),
			]
		}

		// Get chats using repository
		return await this.chatRepository.findChatsByUserId(userId, { page, limit })
	}

	/**
	 * Perform semantic search across chat messages
	 * @param options - Search options including query, user context, and filters
	 * @returns Result tuple with search results or error
	 */
	public async semanticSearch(
		options: SemanticSearchOptions,
	): Promise<Result<SemanticSearchResult[]>> {
		return await this.vectorService.semanticSearch(options)
	}

	/**
	 * Send a message and get AI response (non-streaming)
	 * @param request - Message sending request
	 * @returns Result tuple with user message and AI response or error
	 */
	public async sendMessage(
		request: SendMessageRequest,
	): Promise<Result<{ userMessage: TChatMessage; aiResponse: TChatMessage }>> {
		// Validate input
		const [validatedRequest, validationError] =
			this.validateSendMessageRequest(request)
		if (validationError) {
			return [null, validationError]
		}

		// Verify chat ownership
		const [isOwner, ownershipError] = await this.verifyChatOwnership(
			validatedRequest.chatId,
			validatedRequest.userId,
		)
		if (ownershipError) {
			return [null, ownershipError]
		}

		if (!isOwner) {
			return [
				null,
				new UnauthorizedError(
					'User does not have access to this chat',
					'chatService',
				),
			]
		}

		// Save user message
		const [userMessage, userMessageError] = await this.saveMessage({
			chatId: validatedRequest.chatId,
			role: validatedRequest.role ?? 'user',
			content: validatedRequest.content,
		})

		if (userMessageError) {
			return [null, userMessageError]
		}

		// Generate embedding for the user message
		await this.vectorService.createMessageEmbedding({
			messageId: userMessage.id,
			chatId: validatedRequest.chatId,
			userId: validatedRequest.userId,
			content: validatedRequest.content,
			metadata: { role: validatedRequest.role ?? 'user' },
		})

		// Get chat history for AI context
		const [chatHistory, historyError] = await this.getChatHistory(
			validatedRequest.chatId,
		)
		if (historyError) {
			return [null, historyError]
		}

		// Generate AI response
		const [aiResponseText, aiError] =
			await this.aiService.generateResponse(chatHistory)
		if (aiError) {
			return [null, aiError]
		}

		// Save AI response
		const [aiMessage, aiMessageError] = await this.saveMessage({
			chatId: validatedRequest.chatId,
			role: 'assistant',
			content: aiResponseText,
		})

		if (aiMessageError) {
			return [null, aiMessageError]
		}

		// Generate embedding for the AI response
		await this.vectorService.createMessageEmbedding({
			messageId: aiMessage.id,
			chatId: validatedRequest.chatId,
			userId: validatedRequest.userId,
			content: aiResponseText,
			metadata: { role: 'assistant' },
		})

		// Update chat timestamp
		await this.updateChatTimestamp(validatedRequest.chatId)

		logger.info({
			msg: 'Message exchange completed',
			chatId: validatedRequest.chatId,
			userMessageId: userMessage.id,
			aiMessageId: aiMessage.id,
		})

		return [{ userMessage, aiResponse: aiMessage }, null]
	}

	/**
	 * Send a message and get streaming AI response
	 * @param request - Message sending request
	 * @returns Result tuple with user message and streaming response or error
	 */
	public async sendMessageStreaming(
		request: SendMessageRequest,
	): Promise<
		Result<{ userMessage: TChatMessage; streamingResponse: StreamingResponse }>
	> {
		// Validate input
		const [validatedRequest, validationError] =
			this.validateSendMessageRequest(request)
		if (validationError) {
			return [null, validationError]
		}

		// Verify chat ownership
		const [isOwner, ownershipError] = await this.verifyChatOwnership(
			validatedRequest.chatId,
			validatedRequest.userId,
		)
		if (ownershipError) {
			return [null, ownershipError]
		}

		if (!isOwner) {
			return [
				null,
				new UnauthorizedError(
					'User does not have access to this chat',
					'chatService',
				),
			]
		}

		// Save user message
		const [userMessage, userMessageError] = await this.saveMessage({
			chatId: validatedRequest.chatId,
			role: validatedRequest.role ?? 'user',
			content: validatedRequest.content,
		})

		if (userMessageError) {
			return [null, userMessageError]
		}

		// Generate embedding for the user message
		await this.vectorService.createMessageEmbedding({
			messageId: userMessage.id,
			chatId: validatedRequest.chatId,
			userId: validatedRequest.userId,
			content: validatedRequest.content,
			metadata: { role: validatedRequest.role ?? 'user' },
		})

		// Get chat history for AI context
		const [chatHistory, historyError] = await this.getChatHistory(
			validatedRequest.chatId,
		)
		if (historyError) {
			return [null, historyError]
		}

		// Generate streaming AI response
		const [streamResult, streamError] =
			await this.aiService.generateStreamingResponse(chatHistory)
		if (streamError) {
			return [null, streamError]
		}

		// Create placeholder message for the AI response
		const [aiMessage, aiMessageError] = await this.saveMessage({
			chatId: validatedRequest.chatId,
			role: 'assistant',
			content: '', // Will be updated as stream completes
		})

		if (aiMessageError) {
			return [null, aiMessageError]
		}

		// Update chat timestamp
		await this.updateChatTimestamp(validatedRequest.chatId)

		const streamingResponse: StreamingResponse = {
			messageId: aiMessage.id,
			stream: streamResult,
		}

		logger.info({
			msg: 'Streaming message exchange initiated',
			chatId: validatedRequest.chatId,
			userMessageId: userMessage.id,
			aiMessageId: aiMessage.id,
		})

		return [{ userMessage, streamingResponse }, null]
	}

	/**
	 * Update a chat (with ownership verification)
	 * @param chatId - The chat ID to update
	 * @param userId - The user ID for ownership verification
	 * @param updates - The updates to apply
	 * @param updates.title - New title for the chat (optional)
	 * @returns Result tuple with updated chat or error
	 */
	public async updateChat(
		chatId: string,
		userId: string,
		updates: { title?: string },
	): Promise<Result<TChat>> {
		// Verify ownership first
		const [isOwner, ownershipError] = await this.verifyChatOwnership(
			chatId,
			userId,
		)
		if (ownershipError) {
			return [null, ownershipError]
		}

		if (!isOwner) {
			return [
				null,
				new UnauthorizedError(
					'User does not have access to this chat',
					'chatService',
				),
			]
		}

		// Update the chat using repository
		const [updatedChat, error] = await this.chatRepository.updateChat(
			chatId,
			updates,
		)

		if (error) {
			return [null, error]
		}

		if (!updatedChat) {
			return [null, new NotFoundError('Chat not found', 'chatService')]
		}

		logger.info({
			msg: 'Chat updated successfully',
			chatId,
			userId,
			updates,
		})

		return [updatedChat, null]
	}

	/**
	 * Update a message content (used for completing streaming responses)
	 * @param messageId - The message ID to update
	 * @param content - The new content
	 * @returns Result tuple with updated message or error
	 */
	public async updateMessageContent(
		messageId: string,
		content: string,
	): Promise<Result<TChatMessage>> {
		const [updatedMessage, error] = await this.messageRepository.updateMessage(
			messageId,
			{ content },
		)
		if (error) {
			return [null, error]
		}

		if (!updatedMessage) {
			return [null, new NotFoundError('Message not found', 'chatService')]
		}

		return [updatedMessage, null]
	}

	/**
	 * Verify that a user owns a specific chat
	 * @param chatId - The ID of the chat to verify
	 * @param userId - The ID of the user to check ownership for
	 * @returns Result tuple with boolean indicating ownership or error
	 */
	public async verifyChatOwnership(
		chatId: string,
		userId: string,
	): Promise<Result<boolean>> {
		return await this.chatRepository.verifyChatOwnership(chatId, userId)
	}

	/**
	 * Get chat history formatted for AI service
	 */
	private async getChatHistory(
		chatId: string,
	): Promise<Result<ChatMessageWithRole[]>> {
		return await this.messageRepository.getChatHistory(chatId)
	}

	/**
	 * Save a message to the database
	 */
	private async saveMessage(messageData: {
		chatId: string
		role: MessageRole
		content: string
	}): Promise<Result<TChatMessage>> {
		return await this.messageRepository.createMessage({
			chatId: messageData.chatId,
			role: messageData.role,
			content: messageData.content,
			metadata: {},
		})
	}

	/**
	 * Update chat timestamp
	 */
	private async updateChatTimestamp(chatId: string): Promise<Result<void>> {
		return await this.chatRepository.updateChatTimestamp(chatId)
	}

	/**
	 * Validate create chat request
	 */
	// eslint-disable-next-line class-methods-use-this
	private validateCreateChatRequest(request: {
		userId: string
		title: string
	}): Result<{ userId: string; title: string }> {
		return tryCatchSync(() => {
			if (!request.userId || typeof request.userId !== 'string') {
				throw new ValidationError(
					'Valid userId is required',
					undefined,
					'chatService',
				)
			}

			if (
				!request.title ||
				typeof request.title !== 'string' ||
				request.title.trim().length === 0
			) {
				throw new ValidationError(
					'Valid title is required',
					undefined,
					'chatService',
				)
			}

			if (request.title.length > 255) {
				throw new ValidationError(
					'Title must be 255 characters or less',
					undefined,
					'chatService',
				)
			}

			return {
				userId: request.userId,
				title: request.title.trim(),
			}
		}, 'chatService - validateCreateChatRequest')
	}

	/**
	 * Validate send message request
	 */
	// eslint-disable-next-line class-methods-use-this
	private validateSendMessageRequest(
		request: SendMessageRequest,
	): Result<SendMessageRequest> {
		return tryCatchSync(() => {
			if (!request.chatId || typeof request.chatId !== 'string') {
				throw new ValidationError(
					'Valid chatId is required',
					undefined,
					'chatService',
				)
			}

			if (!request.userId || typeof request.userId !== 'string') {
				throw new ValidationError(
					'Valid userId is required',
					undefined,
					'chatService',
				)
			}

			if (
				!request.content ||
				typeof request.content !== 'string' ||
				request.content.trim().length === 0
			) {
				throw new ValidationError(
					'Valid content is required',
					undefined,
					'chatService',
				)
			}

			if (request.content.length > 10000) {
				throw new ValidationError(
					'Content must be 10000 characters or less',
					undefined,
					'chatService',
				)
			}

			const validRoles: readonly MessageRole[] = ['user', 'assistant', 'system']
			if (request.role && !validRoles.includes(request.role)) {
				throw new ValidationError(
					'Invalid role specified',
					undefined,
					'chatService',
				)
			}

			return {
				...request,
				content: request.content.trim(),
			}
		}, 'chatService - validateSendMessageRequest')
	}
}

// Create and export singleton instance
// Import dependencies here to avoid circular dependency
import { aiService } from './ai.service.ts'
import { chatRepository } from './chat.data-access.ts'
import { messageRepository } from './message.data-access.ts'
import { vectorService } from './vector.service.ts'

export const chatService = new ChatService(
	aiService,
	vectorService,
	chatRepository,
	messageRepository,
)

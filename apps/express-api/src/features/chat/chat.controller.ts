import type { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { tryCatch, tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { pino } from '../../utils/logger.ts'

import {
	CreateChatRequest,
	SendMessageRequest,
	UpdateChatRequest,
} from './chat.schemas.ts'
import { chatService } from './chat.service.ts'
import type { IChatController, PaginationOptions } from './chat.types.ts'

const { logger } = pino

/**
 * ChatController handles HTTP requests for chat operations
 * Follows established patterns from auth.controller.ts and user.controller.ts
 * Uses Go-style error handling and proper response formatting
 */
export class ChatController implements IChatController {
	/**
	 * Get all chats for the authenticated user with pagination
	 * GET /api/chats
	 */
	public getChats = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const userId = req.userId // Set by auth middleware

		if (!userId) {
			res.status(StatusCodes.UNAUTHORIZED).json({
				success: false,
				error: 'Authentication required',
			})
			return
		}

		// Validate and sanitize pagination parameters
		const pageNum = Number(req.query.page)
		const limitNum = Number(req.query.limit)

		const page = pageNum > 0 ? pageNum : 1 // Default to 1 for invalid/negative/zero values
		const limit = Math.min(limitNum > 0 ? limitNum : 20, 100) // Default to 20, max 100

		const paginationOptions: PaginationOptions = { page, limit }

		const [result, error] = await tryCatch(
			chatService.getUserChats(userId, paginationOptions),
			'chatController - getChats',
		)

		if (error) {
			logger.error({
				msg: '[chatController - getChats]: Error retrieving user chats',
				error: error.message,
				userId,
				page,
				limit,
			})
			next(error)
			return
		}

		const [chatsData, serviceError] = result
		if (serviceError) {
			next(serviceError)
			return
		}

		logger.info({
			msg: '[chatController - getChats]: Successfully retrieved user chats',
			userId,
			chatCount: chatsData.chats.length,
			page,
			limit,
		})

		res.status(StatusCodes.OK).json({
			success: true,
			data: chatsData.chats,
			meta: {
				page,
				limit,
				total: chatsData.total,
			},
		})
	}

	/**
	 * Create a new chat for the authenticated user
	 * POST /api/chats
	 */
	public createChat = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const userId = req.userId // Set by auth middleware

		if (!userId) {
			res.status(StatusCodes.UNAUTHORIZED).json({
				success: false,
				error: 'Authentication required',
			})
			return
		}

		const { title } = req.body as CreateChatRequest

		const [result, error] = await tryCatch(
			chatService.createChat({ userId, title }),
			'chatController - createChat',
		)

		if (error) {
			logger.error({
				msg: '[chatController - createChat]: Error creating chat',
				error: error.message,
				userId,
				title,
			})
			next(error)
			return
		}

		const [chat, serviceError] = result
		if (serviceError) {
			next(serviceError)
			return
		}

		logger.info({
			msg: '[chatController - createChat]: Chat created successfully',
			chatId: chat.id,
			userId,
			title,
		})

		res.status(StatusCodes.CREATED).json({
			success: true,
			data: chat,
		})
	}

	/**
	 * Get a specific chat with its messages (with ownership verification)
	 * GET /api/chats/:id
	 */
	public getChatById = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const userId = req.userId // Set by auth middleware
		const chatId = req.params.id

		if (!userId) {
			res.status(StatusCodes.UNAUTHORIZED).json({
				success: false,
				error: 'Authentication required',
			})
			return
		}

		if (!chatId) {
			res.status(StatusCodes.BAD_REQUEST).json({
				success: false,
				error: 'Chat ID is required',
			})
			return
		}

		const [result, error] = await tryCatch(
			chatService.getChatWithMessages(chatId, userId),
			'chatController - getChatById',
		)

		if (error) {
			logger.error({
				msg: '[chatController - getChatById]: Error retrieving chat',
				error: error.message,
				userId,
				chatId,
			})
			next(error)
			return
		}

		const [chatWithMessages, serviceError] = result
		if (serviceError) {
			next(serviceError)
			return
		}

		logger.info({
			msg: '[chatController - getChatById]: Successfully retrieved chat',
			chatId,
			userId,
			messageCount: chatWithMessages.messages.length,
		})

		res.status(StatusCodes.OK).json({
			success: true,
			data: chatWithMessages,
		})
	}

	/**
	 * Update a chat title (with ownership verification)
	 * PUT /api/chats/:id
	 */
	public updateChat = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const userId = req.userId // Set by auth middleware
		const chatId = req.params.id
		const { title } = req.body as UpdateChatRequest

		if (!userId) {
			res.status(StatusCodes.UNAUTHORIZED).json({
				success: false,
				error: 'Authentication required',
			})
			return
		}

		if (!chatId) {
			res.status(StatusCodes.BAD_REQUEST).json({
				success: false,
				error: 'Chat ID is required',
			})
			return
		}

		// First verify ownership
		const [ownershipResult, ownershipError] = await tryCatch(
			chatService.verifyChatOwnership(chatId, userId),
			'chatController - updateChat - ownership',
		)

		if (ownershipError) {
			logger.error({
				msg: '[chatController - updateChat]: Error verifying chat ownership',
				error: ownershipError.message,
				userId,
				chatId,
			})
			next(ownershipError)
			return
		}

		const [isOwner, verifyError] = ownershipResult
		if (verifyError) {
			next(verifyError)
			return
		}

		if (!isOwner) {
			// Return 404 instead of 403 to avoid revealing chat existence
			res.status(StatusCodes.NOT_FOUND).json({
				success: false,
				error: 'Chat not found',
			})
			return
		}

		// Update the chat
		const [updateResult, updateError] = await tryCatch(
			chatService.updateChat(chatId, { title }),
			'chatController - updateChat',
		)

		if (updateError) {
			logger.error({
				msg: '[chatController - updateChat]: Error updating chat',
				error: updateError.message,
				userId,
				chatId,
				title,
			})
			next(updateError)
			return
		}

		const [updatedChat, serviceError] = updateResult
		if (serviceError) {
			next(serviceError)
			return
		}

		logger.info({
			msg: '[chatController - updateChat]: Chat updated successfully',
			chatId,
			userId,
			title,
		})

		res.status(StatusCodes.OK).json({
			success: true,
			data: updatedChat,
		})
	}

	/**
	 * Delete a chat and all its messages (with ownership verification)
	 * DELETE /api/chats/:id
	 */
	public deleteChat = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const userId = req.userId // Set by auth middleware
		const chatId = req.params.id

		if (!userId) {
			res.status(StatusCodes.UNAUTHORIZED).json({
				success: false,
				error: 'Authentication required',
			})
			return
		}

		if (!chatId) {
			res.status(StatusCodes.BAD_REQUEST).json({
				success: false,
				error: 'Chat ID is required',
			})
			return
		}

		const [result, error] = await tryCatch(
			chatService.deleteChat(chatId, userId),
			'chatController - deleteChat',
		)

		if (error) {
			logger.error({
				msg: '[chatController - deleteChat]: Error deleting chat',
				error: error.message,
				userId,
				chatId,
			})
			next(error)
			return
		}

		const [, serviceError] = result
		if (serviceError) {
			next(serviceError)
			return
		}

		logger.info({
			msg: '[chatController - deleteChat]: Chat deleted successfully',
			chatId,
			userId,
		})

		res.status(StatusCodes.OK).json({
			success: true,
			message: 'Chat deleted successfully',
		})
	}

	/**
	 * Stream chat message response using Server-Sent Events (SSE)
	 * POST /api/chats/:id/stream
	 */
	public streamChatMessage = async (
		req: Request,
		res: Response,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		next: NextFunction,
	): Promise<void> => {
		const userId = req.userId // Set by auth middleware
		const chatId = req.params.id
		const requestBody = req.body as SendMessageRequest

		// Validate messages array
		if (requestBody.messages.length === 0) {
			res.status(StatusCodes.BAD_REQUEST).json({
				success: false,
				error: 'Messages array must not be empty',
			})
			return
		}

		// Extract the latest user message from the messages array
		const latestMessage = requestBody.messages[requestBody.messages.length - 1]
		if (!latestMessage || latestMessage.role !== 'user') {
			res.status(StatusCodes.BAD_REQUEST).json({
				success: false,
				error: 'Latest message must be from user',
			})
			return
		}

		const content = latestMessage.content
		const role = latestMessage.role

		if (!userId) {
			res.status(StatusCodes.UNAUTHORIZED).json({
				success: false,
				error: 'Authentication required',
			})
			return
		}

		if (!chatId) {
			res.status(StatusCodes.BAD_REQUEST).json({
				success: false,
				error: 'Chat ID is required',
			})
			return
		}

		// Set SSE headers for streaming
		res.writeHead(StatusCodes.OK, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			// CORS headers are handled by the main CORS middleware
			// Removing manual CORS headers to avoid conflicts with credentials
		})

		// Helper function to send SSE data with Go-style error handling
		const sendSSEData = (data: object): void => {
			const [, writeError] = tryCatchSync(
				() => res.write(`data: ${JSON.stringify(data)}\n\n`),
				'streamChatMessage - sendSSEData',
			)

			if (writeError) {
				logger.error({
					msg: '[streamChatMessage]: Error writing SSE data',
					error: writeError.message,
					userId,
					chatId,
				})
			}
		}

		// Send initial connection confirmation
		sendSSEData({ type: 'connected', message: 'Stream connected' })

		try {
			// Initiate streaming message exchange
			const [result, error] = await tryCatch(
				chatService.sendMessageStreaming({
					chatId,
					userId,
					content,
					role,
				}),
				'streamChatMessage - sendMessageStreaming',
			)

			if (error) {
				logger.error({
					msg: '[streamChatMessage]: Error initiating streaming',
					error: error.message,
					userId,
					chatId,
				})
				sendSSEData({ type: 'error', error: 'Failed to process message' })
				res.end()
				return
			}

			const [streamingResult, serviceError] = result
			if (serviceError) {
				logger.error({
					msg: '[streamChatMessage]: Service error during streaming',
					error: serviceError.message,
					userId,
					chatId,
				})
				sendSSEData({ type: 'error', error: serviceError.message })
				res.end()
				return
			}

			// Send user message confirmation
			sendSSEData({
				type: 'user_message',
				message: streamingResult.userMessage,
			})

			// Stream AI response
			let fullResponse = ''
			const { messageId, stream } = streamingResult.streamingResponse

			// Send streaming start event
			sendSSEData({
				type: 'stream_start',
				messageId,
			})

			// Process streaming chunks
			const [, streamingError] = await tryCatch(
				(async () => {
					for await (const chunk of stream) {
						fullResponse += chunk
						sendSSEData({
							type: 'chunk',
							content: chunk,
							messageId,
						})
					}
				})(),
				'streamChatMessage - streaming',
			)

			if (streamingError) {
				logger.error({
					msg: '[streamChatMessage]: Error during streaming',
					error: streamingError.message,
					userId,
					chatId,
					messageId,
				})
				sendSSEData({ type: 'error', error: 'Streaming interrupted' })
				res.end()
				return
			}

			// Update the AI message with the complete response
			const [, updateError] = await tryCatch(
				chatService.updateMessageContent(messageId, fullResponse),
				'streamChatMessage - updateMessageContent',
			)

			if (updateError) {
				logger.warn({
					msg: '[streamChatMessage]: Error updating message content',
					error: updateError.message,
					userId,
					chatId,
					messageId,
				})
				// Continue anyway as the response was already streamed
			}

			// Send completion signal
			sendSSEData({
				type: 'stream_complete',
				messageId,
				fullContent: fullResponse,
			})

			logger.info({
				msg: '[streamChatMessage]: Streaming completed successfully',
				chatId,
				userId,
				messageId,
				responseLength: fullResponse.length,
			})
		} catch (unexpectedError) {
			logger.error({
				msg: '[streamChatMessage]: Unexpected error during streaming',
				error:
					unexpectedError instanceof Error
						? unexpectedError.message
						: String(unexpectedError),
				userId,
				chatId,
			})
			sendSSEData({ type: 'error', error: 'Unexpected error occurred' })
		} finally {
			// Always end the response
			res.end()
		}
	}
}

// Create and export singleton instance
export const chatController = new ChatController()

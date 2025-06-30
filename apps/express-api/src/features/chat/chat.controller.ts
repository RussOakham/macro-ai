import type { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { pino } from '../../utils/logger.ts'

import { CreateChatRequest, UpdateChatRequest } from './chat.schemas.ts'
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

		const page = Number(req.query.page) || 1
		const limit = Math.min(Number(req.query.limit) || 20, 100) // Max 100 chats per request

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
}

// Create and export singleton instance
export const chatController = new ChatController()

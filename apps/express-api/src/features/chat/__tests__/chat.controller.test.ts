/* eslint-disable @typescript-eslint/unbound-method */
import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	InternalError,
	NotFoundError,
	UnauthorizedError,
} from '../../../utils/errors.ts'
import { mockChatService } from '../../../utils/test-helpers/chat-service.mock.ts'
import { mockExpress } from '../../../utils/test-helpers/express-mocks.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { chatController } from '../chat.controller.ts'
import { chatService } from '../chat.service.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the chat service using the reusable helper
vi.mock('../chat.service.ts', () => mockChatService.createModule())

describe('ChatController', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction
	let mockedChatService: ReturnType<typeof vi.mocked<typeof chatService>>

	const mockUserId = '123e4567-e89b-12d3-a456-426614174000'
	const mockChatId = '987fcdeb-51a2-43d1-9f12-123456789abc'

	// Use mock helper to create test data
	const mockChat = mockChatService.createChat({
		id: mockChatId,
		userId: mockUserId,
		title: 'Test Chat',
	})

	const mockMessage = mockChatService.createMessage({
		id: 'msg-123',
		chatId: mockChatId,
		role: 'user',
		content: 'Hello, world!',
	})

	const mockChatWithMessages = mockChatService.createChatWithMessages({
		id: mockChatId,
		userId: mockUserId,
		title: 'Test Chat',
		messages: [mockMessage],
	})

	beforeEach(() => {
		const mocks = mockExpress.setup()
		mockRequest = mocks.req
		mockResponse = mocks.res
		mockNext = mocks.next
		mockedChatService = vi.mocked(chatService)

		// Set default authenticated user
		mockRequest.userId = mockUserId
	})

	describe('getChats', () => {
		it('should return user chats with pagination', async () => {
			// Arrange
			const mockChatsData = mockChatService.createChatsPagination({
				chats: [mockChat],
				total: 1,
			})
			mockRequest.query = { page: '1', limit: '20' }
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 1,
				limit: 20,
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: [mockChat],
				meta: {
					page: 1,
					limit: 20,
					total: 1,
				},
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle service errors', async () => {
			// Arrange
			const error = new InternalError('Database error')
			vi.mocked(chatService).getUserChats.mockResolvedValue([null, error])

			// Act
			await chatController.getChats(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})

		it('should limit pagination to maximum 100', async () => {
			// Arrange
			mockRequest.query = { page: '1', limit: '150' }
			const mockChatsData = mockChatService.createChatsPagination({
				chats: [],
				total: 0,
			})
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 1,
				limit: 100, // Should be capped at 100
			})
		})
	})

	describe('createChat', () => {
		it('should create a new chat successfully', async () => {
			// Arrange
			mockRequest.body = { title: 'New Chat' }
			vi.mocked(chatService).createChat.mockResolvedValue([mockChat, null])

			// Act
			await chatController.createChat(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockedChatService.createChat).toHaveBeenCalledWith({
				userId: mockUserId,
				title: 'New Chat',
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: mockChat,
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle service errors', async () => {
			// Arrange
			mockRequest.body = { title: 'New Chat' }
			const error = new InternalError('Database error')
			vi.mocked(chatService).createChat.mockResolvedValue([null, error])

			// Act
			await chatController.createChat(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})
	})

	describe('getChatById', () => {
		it('should return chat with messages when user owns the chat', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			vi.mocked(chatService).getChatWithMessages.mockResolvedValue([
				mockChatWithMessages,
				null,
			])

			// Act
			await chatController.getChatById(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockedChatService.getChatWithMessages).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: mockChatWithMessages,
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle unauthorized access', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			const error = new UnauthorizedError('Access denied')
			vi.mocked(chatService).getChatWithMessages.mockResolvedValue([
				null,
				error,
			])

			// Act
			await chatController.getChatById(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})

		it('should handle not found errors', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			const error = new NotFoundError('Chat not found')
			vi.mocked(chatService).getChatWithMessages.mockResolvedValue([
				null,
				error,
			])

			// Act
			await chatController.getChatById(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})
	})

	describe('updateChat', () => {
		it('should update chat successfully when user owns the chat', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }
			const updatedChat = mockChatService.createChat({
				...mockChat,
				title: 'Updated Chat Title',
			})

			vi.mocked(chatService).verifyChatOwnership.mockResolvedValue([true, null])
			vi.mocked(chatService).updateChat.mockResolvedValue([updatedChat, null])

			// Act
			await chatController.updateChat(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockedChatService.verifyChatOwnership).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
			)
			expect(mockedChatService.updateChat).toHaveBeenCalledWith(mockChatId, {
				title: 'Updated Chat Title',
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: updatedChat,
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return 404 when user does not own the chat', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }

			vi.mocked(chatService).verifyChatOwnership.mockResolvedValue([
				false,
				null,
			])

			// Act
			await chatController.updateChat(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Chat not found',
			})
			expect(mockedChatService.updateChat).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle ownership verification errors', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }
			const error = new InternalError('Database error')

			vi.mocked(chatService).verifyChatOwnership.mockResolvedValue([
				null,
				error,
			])

			// Act
			await chatController.updateChat(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
			expect(mockedChatService.updateChat).not.toHaveBeenCalled()
		})
	})

	describe('deleteChat', () => {
		it('should delete chat successfully when user owns the chat', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			vi.mocked(chatService).deleteChat.mockResolvedValue([undefined, null])

			// Act
			await chatController.deleteChat(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockedChatService.deleteChat).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				message: 'Chat deleted successfully',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle service errors', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			const error = new UnauthorizedError('Access denied')
			vi.mocked(chatService).deleteChat.mockResolvedValue([null, error])

			// Act
			await chatController.deleteChat(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})
	})
})

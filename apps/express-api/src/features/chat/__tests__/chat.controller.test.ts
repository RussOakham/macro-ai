/* eslint-disable @typescript-eslint/unbound-method */
import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	InternalError,
	NotFoundError,
	UnauthorizedError,
} from '../../../utils/errors.ts'
import { MockDataFactory } from '../../../utils/test-helpers/advanced-mocking.ts'
import { createMockExpressObjects } from '../../../utils/test-helpers/enhanced-mocks.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { chatController } from '../chat.controller.ts'
import { chatService } from '../chat.service.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the chat service
vi.mock('../chat.service.ts', () => ({
	chatService: {
		getUserChats: vi.fn(),
		createChat: vi.fn(),
		getChatWithMessages: vi.fn(),
		updateChat: vi.fn(),
		deleteChat: vi.fn(),
		sendMessageStreaming: vi.fn(),
		updateMessageContent: vi.fn(),
		verifyChatOwnership: vi.fn(),
	},
}))

describe('ChatController', () => {
	let mockRequest: Request
	let mockResponse: Response
	let mockNext: NextFunction
	let mockedChatService: ReturnType<typeof vi.mocked<typeof chatService>>

	const mockUserId = MockDataFactory.uuid()
	const mockChatId = MockDataFactory.uuid()

	// Use MockDataFactory to create test data
	const mockChat = MockDataFactory.createChat({
		id: mockChatId,
		userId: mockUserId,
		title: 'Test Chat',
	})

	const mockMessage = MockDataFactory.createMessage({
		id: 'msg-123',
		chatId: mockChatId,
		role: 'user',
		content: 'Hello, world!',
	})

	const mockChatWithMessages = {
		...mockChat,
		messages: [mockMessage],
	}

	beforeEach(() => {
		// Clear all mocks
		vi.clearAllMocks()

		const { req, res, next } = createMockExpressObjects()
		mockRequest = req
		mockResponse = res
		mockNext = next
		mockedChatService = vi.mocked(chatService)

		// Set default authenticated user
		mockRequest.userId = mockUserId
	})

	describe('getChats', () => {
		it('should return user chats with pagination', async () => {
			// Arrange
			const mockChatsData = {
				chats: [mockChat],
				total: 1,
			}
			mockRequest.query = { page: '1', limit: '20' }
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

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

		it('should return 401 when userId is missing', async () => {
			// Arrange
			mockRequest.userId = undefined

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Authentication required',
			})
			expect(mockedChatService.getUserChats).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle service errors', async () => {
			// Arrange
			const error = new InternalError('Database error')
			vi.mocked(chatService).getUserChats.mockResolvedValue([null, error])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})

		it('should use default pagination values when not provided', async () => {
			// Arrange
			mockRequest.query = {} // No pagination params
			const mockChatsData = {
				chats: [],
				total: 0,
			}
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 1, // Default page
				limit: 20, // Default limit
			})
		})

		it('should limit pagination to maximum 100', async () => {
			// Arrange
			mockRequest.query = { page: '1', limit: '150' }
			const mockChatsData = {
				chats: [],
				total: 0,
			}
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 1,
				limit: 100, // Should be capped at 100
			})
		})

		it('should handle invalid pagination parameters gracefully', async () => {
			// Arrange
			mockRequest.query = { page: 'invalid', limit: 'invalid' }
			const mockChatsData = {
				chats: [],
				total: 0,
			}
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 1, // Default when invalid
				limit: 20, // Default when invalid
			})
		})

		it('should sanitize negative pagination values to defaults', async () => {
			// Arrange
			mockRequest.query = { page: '-1', limit: '-5' }
			const mockChatsData = {
				chats: [],
				total: 0,
			}
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 1, // Negative values should be sanitized to default
				limit: 20, // Negative values should be sanitized to default
			})
		})

		it('should sanitize zero pagination values to defaults', async () => {
			// Arrange
			mockRequest.query = { page: '0', limit: '0' }
			const mockChatsData = {
				chats: [],
				total: 0,
			}
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 1, // Zero values should be sanitized to default
				limit: 20, // Zero values should be sanitized to default
			})
		})

		it('should convert decimal pagination values to integers', async () => {
			// Arrange
			mockRequest.query = { page: '2.7', limit: '15.9' }
			const mockChatsData = {
				chats: [],
				total: 0,
			}
			vi.mocked(chatService).getUserChats.mockResolvedValue([
				mockChatsData,
				null,
			])

			// Act
			await chatController.getChats(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.getUserChats).toHaveBeenCalledWith(mockUserId, {
				page: 2, // Math.floor(2.7) = 2 - decimal values converted to integers
				limit: 15, // Math.floor(15.9) = 15 - decimal values converted to integers
			})
		})
	})

	describe('createChat', () => {
		it('should create a new chat successfully', async () => {
			// Arrange
			mockRequest.body = { title: 'New Chat' }
			vi.mocked(chatService).createChat.mockResolvedValue([mockChat, null])

			// Act
			await chatController.createChat(mockRequest, mockResponse, mockNext)

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

		it('should return 401 when userId is missing', async () => {
			// Arrange
			mockRequest.userId = undefined
			mockRequest.body = { title: 'New Chat' }

			// Act
			await chatController.createChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Authentication required',
			})
			expect(mockedChatService.createChat).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle service errors', async () => {
			// Arrange
			mockRequest.body = { title: 'New Chat' }
			const error = new InternalError('Database error')
			vi.mocked(chatService).createChat.mockResolvedValue([null, error])

			// Act
			await chatController.createChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})

		it('should handle valid minimum title length', async () => {
			// Arrange
			mockRequest.body = { title: 'A' } // Minimum valid title (1 character)
			vi.mocked(chatService).createChat.mockResolvedValue([mockChat, null])

			// Act
			await chatController.createChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.createChat).toHaveBeenCalledWith({
				userId: mockUserId,
				title: 'A',
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED)
		})

		it('should handle valid maximum title length', async () => {
			// Arrange
			const maxTitle = 'A'.repeat(255) // Maximum valid title (255 characters)
			mockRequest.body = { title: maxTitle }
			vi.mocked(chatService).createChat.mockResolvedValue([mockChat, null])

			// Act
			await chatController.createChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.createChat).toHaveBeenCalledWith({
				userId: mockUserId,
				title: maxTitle,
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED)
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
			await chatController.getChatById(mockRequest, mockResponse, mockNext)

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

		it('should return 401 when userId is missing', async () => {
			// Arrange
			mockRequest.userId = undefined
			mockRequest.params = { id: mockChatId }

			// Act
			await chatController.getChatById(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Authentication required',
			})
			expect(mockedChatService.getChatWithMessages).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return 400 when chatId is missing', async () => {
			// Arrange
			mockRequest.params = {} // No id parameter

			// Act
			await chatController.getChatById(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Chat ID is required',
			})
			expect(mockedChatService.getChatWithMessages).not.toHaveBeenCalled()
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
			await chatController.getChatById(mockRequest, mockResponse, mockNext)

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
			await chatController.getChatById(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})

		it('should handle empty chatId parameter', async () => {
			// Arrange
			mockRequest.params = { id: '' } // Empty string

			// Act
			await chatController.getChatById(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Chat ID is required',
			})
			expect(mockedChatService.getChatWithMessages).not.toHaveBeenCalled()
		})

		it('should handle undefined chatId parameter', async () => {
			// Arrange
			delete mockRequest.params.id // Remove id property

			// Act
			await chatController.getChatById(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Chat ID is required',
			})
			expect(mockedChatService.getChatWithMessages).not.toHaveBeenCalled()
		})
	})

	describe('updateChat', () => {
		it('should update chat successfully when user owns the chat', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }
			const updatedChat = MockDataFactory.createChat({
				...mockChat,
				title: 'Updated Chat Title',
			})

			vi.mocked(chatService).updateChat.mockResolvedValue([updatedChat, null])

			// Act
			await chatController.updateChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.updateChat).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
				{
					title: 'Updated Chat Title',
				},
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: updatedChat,
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return 401 when userId is missing', async () => {
			// Arrange
			mockRequest.userId = undefined
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }

			// Act
			await chatController.updateChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Authentication required',
			})
			expect(mockedChatService.verifyChatOwnership).not.toHaveBeenCalled()
			expect(mockedChatService.updateChat).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return 400 when chatId is missing', async () => {
			// Arrange
			mockRequest.params = {} // No id parameter
			mockRequest.body = { title: 'Updated Chat Title' }

			// Act
			await chatController.updateChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Chat ID is required',
			})
			expect(mockedChatService.verifyChatOwnership).not.toHaveBeenCalled()
			expect(mockedChatService.updateChat).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle authorization error when user does not own the chat', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }
			const authError = new UnauthorizedError(
				'User does not have access to this chat',
				'chatService',
			)

			vi.mocked(chatService).updateChat.mockResolvedValue([null, authError])

			// Act
			await chatController.updateChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.updateChat).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
				{
					title: 'Updated Chat Title',
				},
			)
			expect(mockNext).toHaveBeenCalledWith(authError)
		})

		it('should handle ownership verification errors from service', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }
			const error = new InternalError('Database error')

			vi.mocked(chatService).updateChat.mockResolvedValue([null, error])

			// Act
			await chatController.updateChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.updateChat).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
				{
					title: 'Updated Chat Title',
				},
			)
			expect(mockNext).toHaveBeenCalledWith(error)
		})

		it('should handle update service errors', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = { title: 'Updated Chat Title' }
			const error = new InternalError('Update failed')

			vi.mocked(chatService).updateChat.mockResolvedValue([null, error])

			// Act
			await chatController.updateChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockedChatService.updateChat).toHaveBeenCalledWith(
				mockChatId,
				mockUserId,
				{
					title: 'Updated Chat Title',
				},
			)
			expect(mockNext).toHaveBeenCalledWith(error)
		})
	})

	describe('deleteChat', () => {
		it('should delete chat successfully when user owns the chat', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			vi.mocked(chatService).deleteChat.mockResolvedValue([undefined, null])

			// Act
			await chatController.deleteChat(mockRequest, mockResponse, mockNext)

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

		it('should return 401 when userId is missing', async () => {
			// Arrange
			mockRequest.userId = undefined
			mockRequest.params = { id: mockChatId }

			// Act
			await chatController.deleteChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Authentication required',
			})
			expect(mockedChatService.deleteChat).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return 400 when chatId is missing', async () => {
			// Arrange
			mockRequest.params = {} // No id parameter

			// Act
			await chatController.deleteChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Chat ID is required',
			})
			expect(mockedChatService.deleteChat).not.toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle service errors', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			const error = new UnauthorizedError('Access denied')
			vi.mocked(chatService).deleteChat.mockResolvedValue([null, error])

			// Act
			await chatController.deleteChat(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
		})
	})

	describe('streamChatMessage', () => {
		const mockMessageContent = 'Hello, how can I help you?'

		// Helper to create a mock stream that can be consumed
		const createMockStream = (chunks: string[]): AsyncIterable<string> => {
			return {
				// eslint-disable-next-line @typescript-eslint/require-await
				[Symbol.asyncIterator]: async function* () {
					for (const chunk of chunks) {
						yield chunk
					}
				},
			}
		}

		const mockStreamingResponse = {
			userMessage: mockMessage,
			streamingResponse: {
				messageId: 'ai-msg-123',
				stream: createMockStream(['Hello', ', how', ' can I', ' help you?']),
			},
		}

		beforeEach(() => {
			// Mock writeHead and write methods for SSE
			mockResponse.writeHead = vi.fn()
			mockResponse.write = vi.fn()
			mockResponse.end = vi.fn()
			mockResponse.flush = vi.fn()
		})

		it('should successfully stream chat message response', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			}
			vi.mocked(chatService).sendMessageStreaming.mockResolvedValue([
				mockStreamingResponse,
				null,
			])
			vi.mocked(chatService).updateMessageContent.mockResolvedValue([
				mockMessage,
				null,
			])

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(mockResponse.writeHead).toHaveBeenCalledWith(StatusCodes.OK, {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'Transfer-Encoding': 'chunked',
				'X-Accel-Buffering': 'no',
			})

			expect(mockedChatService.sendMessageStreaming).toHaveBeenCalledWith({
				chatId: mockChatId,
				userId: mockUserId,
				content: mockMessageContent,
				role: 'user',
			})

			// Verify text chunks were sent directly
			expect(mockResponse.write).toHaveBeenCalledWith('Hello')
			expect(mockResponse.write).toHaveBeenCalledWith(', how')
			expect(mockResponse.write).toHaveBeenCalledWith(' can I')
			expect(mockResponse.write).toHaveBeenCalledWith(' help you?')

			// Verify response is properly ended
			expect(mockResponse.end).toHaveBeenCalled()
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return 401 when userId is missing', async () => {
			// Arrange
			mockRequest.userId = undefined
			mockRequest.params = { id: mockChatId }
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			}

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Authentication required',
			})
			expect(mockedChatService.sendMessageStreaming).not.toHaveBeenCalled()
		})

		it('should return 400 when chatId is missing', async () => {
			// Arrange
			mockRequest.params = {} // No chatId
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			}

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: false,
				error: 'Chat ID is required',
			})
			expect(mockedChatService.sendMessageStreaming).not.toHaveBeenCalled()
		})

		it('should handle service errors during streaming initiation', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			}
			const error = new UnauthorizedError('Chat not found')
			vi.mocked(chatService).sendMessageStreaming.mockResolvedValue([
				null,
				error,
			])

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(mockResponse.writeHead).toHaveBeenCalled()
			expect(mockResponse.end).toHaveBeenCalled()
			// With text streaming, no error messages are sent to the stream
			expect(mockResponse.write).not.toHaveBeenCalled()
			expect(mockResponse.end).toHaveBeenCalled()
		})

		it('should handle streaming errors during chunk processing', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			}

			const errorStream = {
				// eslint-disable-next-line @typescript-eslint/require-await
				[Symbol.asyncIterator]: async function* () {
					yield 'Hello'
					throw new Error('Streaming error')
				},
			}

			const streamingResponseWithError = {
				userMessage: mockMessage,
				streamingResponse: {
					messageId: 'ai-msg-123',
					stream: errorStream,
				},
			}

			vi.mocked(chatService).sendMessageStreaming.mockResolvedValue([
				streamingResponseWithError,
				null,
			])

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert - should handle streaming error gracefully
			expect(mockResponse.writeHead).toHaveBeenCalled()
			// With text streaming, chunks are sent directly
			expect(mockResponse.write).toHaveBeenCalledWith('Hello')
			expect(mockResponse.end).toHaveBeenCalled()
		})

		it('should handle message update errors gracefully', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			}
			vi.mocked(chatService).sendMessageStreaming.mockResolvedValue([
				mockStreamingResponse,
				null,
			])
			const updateError = new InternalError('Database error')
			vi.mocked(chatService).updateMessageContent.mockResolvedValue([
				null,
				updateError,
			])

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert - should continue despite update error
			expect(mockResponse.writeHead).toHaveBeenCalled()
			expect(mockResponse.end).toHaveBeenCalled()
		})

		it('should handle unexpected errors during streaming', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			}
			vi.mocked(chatService).sendMessageStreaming.mockRejectedValue(
				new Error('Unexpected error'),
			)

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(mockResponse.writeHead).toHaveBeenCalled()
			expect(mockResponse.end).toHaveBeenCalled()
		})

		it('should handle user role messages correctly', async () => {
			// Arrange
			mockRequest.params = { id: mockChatId }
			mockRequest.body = {
				messages: [{ content: mockMessageContent, role: 'user' }],
			} // Role specified
			vi.mocked(chatService).sendMessageStreaming.mockResolvedValue([
				mockStreamingResponse,
				null,
			])

			// Act
			await chatController.streamChatMessage(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(mockedChatService.sendMessageStreaming).toHaveBeenCalledWith({
				chatId: mockChatId,
				userId: mockUserId,
				content: mockMessageContent,
				role: 'user', // Default role
			})
		})
	})
})

/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	InternalError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from '../../errors.ts'
import { mockChatService } from '../chat-service.mock.ts'

// Mock the chat service using the reusable helper
vi.mock('../../../features/chat/chat.service.ts', () =>
	mockChatService.createModule(),
)

// Import after mocking
import { chatService } from '../../../features/chat/chat.service.ts'

/**
 * Example test demonstrating how to use the mockChatService helper
 * This shows the recommended patterns for testing with ChatService
 */
describe('mockChatService Example Usage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Service Method Mocking', () => {
		describe('getUserChats', () => {
			it('should mock getUserChats successfully', async () => {
				// Arrange - Create mock data using the helper
				const mockChat = mockChatService.createChat({
					id: 'custom-chat-id',
					title: 'Custom Chat Title',
				})
				const mockPagination = mockChatService.createChatsPagination({
					chats: [mockChat],
					total: 1,
				})

				// Mock the service method
				vi.mocked(chatService.getUserChats).mockResolvedValue([
					mockPagination,
					null,
				])

				// Act
				const [result, error] = await chatService.getUserChats('user-123', {
					page: 1,
					limit: 20,
				})

				// Assert
				expect(chatService.getUserChats).toHaveBeenCalledWith('user-123', {
					page: 1,
					limit: 20,
				})
				expect(result).toEqual(mockPagination)
				expect(error).toBeNull()
				expect(result?.chats).toHaveLength(1)
				if (!result?.chats[0]) {
					throw new Error(
						'should mock getUserChats successfully - No chat found',
					)
				}

				expect(result.chats[0].id).toBe('custom-chat-id')
				expect(result.chats[0].title).toBe('Custom Chat Title')
				expect(result.total).toBe(1)
			})

			it('should mock getUserChats with error', async () => {
				// Arrange
				const mockError = new InternalError('Database error', 'chatService')

				// Mock the service method to return error
				vi.mocked(chatService.getUserChats).mockResolvedValue([null, mockError])

				// Act
				const [result, error] = await chatService.getUserChats('user-123')

				// Assert
				expect(chatService.getUserChats).toHaveBeenCalledWith('user-123')
				expect(result).toBeNull()
				expect(error).toEqual(mockError)
			})

			it('should mock getUserChats with empty results', async () => {
				// Arrange - Create empty pagination result
				const emptyPagination = mockChatService.createChatsPagination({
					chats: [],
					total: 0,
				})

				// Mock the service method
				vi.mocked(chatService.getUserChats).mockResolvedValue([
					emptyPagination,
					null,
				])

				// Act
				const [result, error] = await chatService.getUserChats('user-123')

				// Assert
				expect(result).toEqual(emptyPagination)
				expect(error).toBeNull()
				expect(result?.chats).toHaveLength(0)
				expect(result?.total).toBe(0)
			})
		})

		describe('createChat', () => {
			it('should mock createChat successfully', async () => {
				// Arrange - Create mock data using the helper
				const mockChat = mockChatService.createChat({
					id: 'new-chat-id',
					userId: 'user-123',
					title: 'New Chat',
				})

				// Mock the service method
				vi.mocked(chatService.createChat).mockResolvedValue([mockChat, null])

				// Act
				const [result, error] = await chatService.createChat({
					userId: 'user-123',
					title: 'New Chat',
				})

				// Assert
				expect(chatService.createChat).toHaveBeenCalledWith({
					userId: 'user-123',
					title: 'New Chat',
				})
				expect(result).toEqual(mockChat)
				expect(error).toBeNull()
				expect(result?.id).toBe('new-chat-id')
				expect(result?.title).toBe('New Chat')
			})

			it('should mock createChat with validation error', async () => {
				// Arrange
				const mockError = new ValidationError(
					'Title is required',
					undefined,
					'chatService',
				)

				// Mock the service method to return error
				vi.mocked(chatService.createChat).mockResolvedValue([null, mockError])

				// Act
				const [result, error] = await chatService.createChat({
					userId: 'user-123',
					title: '',
				})

				// Assert
				expect(chatService.createChat).toHaveBeenCalledWith({
					userId: 'user-123',
					title: '',
				})
				expect(result).toBeNull()
				expect(error).toEqual(mockError)
			})
		})

		describe('getChatWithMessages', () => {
			it('should mock getChatWithMessages successfully', async () => {
				// Arrange - Create mock data using the helper
				const mockMessage = mockChatService.createMessage({
					id: 'msg-1',
					role: 'user',
					content: 'Hello, AI!',
				})
				const mockChatWithMessages = mockChatService.createChatWithMessages({
					id: 'chat-123',
					title: 'Test Chat',
					messages: [mockMessage],
				})

				// Mock the service method
				vi.mocked(chatService.getChatWithMessages).mockResolvedValue([
					mockChatWithMessages,
					null,
				])

				// Act
				const [result, error] = await chatService.getChatWithMessages(
					'chat-123',
					'user-123',
				)

				// Assert
				expect(chatService.getChatWithMessages).toHaveBeenCalledWith(
					'chat-123',
					'user-123',
				)
				expect(result).toEqual(mockChatWithMessages)
				expect(error).toBeNull()
				expect(result?.messages).toHaveLength(1)
				if (!result?.messages[0]) {
					throw new Error(
						'should mock getChatWithMessages successfully - No message found',
					)
				}
				expect(result.messages[0].content).toBe('Hello, AI!')
			})

			it('should mock getChatWithMessages with unauthorized error', async () => {
				// Arrange
				const mockError = new UnauthorizedError(
					'User does not have access to this chat',
					'chatService',
				)

				// Mock the service method to return error
				vi.mocked(chatService.getChatWithMessages).mockResolvedValue([
					null,
					mockError,
				])

				// Act
				const [result, error] = await chatService.getChatWithMessages(
					'chat-123',
					'other-user',
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toEqual(mockError)
			})
		})

		describe('verifyChatOwnership', () => {
			it('should mock verifyChatOwnership successfully', async () => {
				// Arrange
				vi.mocked(chatService.verifyChatOwnership).mockResolvedValue([
					true,
					null,
				])

				// Act
				const [result, error] = await chatService.verifyChatOwnership(
					'chat-123',
					'user-123',
				)

				// Assert
				expect(chatService.verifyChatOwnership).toHaveBeenCalledWith(
					'chat-123',
					'user-123',
				)
				expect(result).toBe(true)
				expect(error).toBeNull()
			})

			it('should mock verifyChatOwnership with false result', async () => {
				// Arrange
				vi.mocked(chatService.verifyChatOwnership).mockResolvedValue([
					false,
					null,
				])

				// Act
				const [result, error] = await chatService.verifyChatOwnership(
					'chat-123',
					'other-user',
				)

				// Assert
				expect(result).toBe(false)
				expect(error).toBeNull()
			})
		})

		describe('updateChat', () => {
			it('should mock updateChat successfully', async () => {
				// Arrange - Create updated mock chat
				const updatedChat = mockChatService.createChat({
					id: 'chat-123',
					title: 'Updated Title',
				})

				// Mock the service method
				vi.mocked(chatService.updateChat).mockResolvedValue([updatedChat, null])

				// Act
				const [result, error] = await chatService.updateChat(
					'chat-123',
					'user-123',
					{
						title: 'Updated Title',
					},
				)

				// Assert
				expect(chatService.updateChat).toHaveBeenCalledWith(
					'chat-123',
					'user-123',
					{
						title: 'Updated Title',
					},
				)
				expect(result).toEqual(updatedChat)
				expect(error).toBeNull()
				expect(result?.title).toBe('Updated Title')
			})

			it('should mock updateChat with not found error', async () => {
				// Arrange
				const mockError = new NotFoundError('Chat not found', 'chatService')

				// Mock the service method to return error
				vi.mocked(chatService.updateChat).mockResolvedValue([null, mockError])

				// Act
				const [result, error] = await chatService.updateChat(
					'nonexistent',
					'user-123',
					{
						title: 'New Title',
					},
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toEqual(mockError)
			})
		})

		describe('deleteChat', () => {
			it('should mock deleteChat successfully', async () => {
				// Arrange
				vi.mocked(chatService.deleteChat).mockResolvedValue([undefined, null])

				// Act
				const [result, error] = await chatService.deleteChat(
					'chat-123',
					'user-123',
				)

				// Assert
				expect(chatService.deleteChat).toHaveBeenCalledWith(
					'chat-123',
					'user-123',
				)
				expect(result).toBeUndefined()
				expect(error).toBeNull()
			})

			it('should mock deleteChat with unauthorized error', async () => {
				// Arrange
				const mockError = new UnauthorizedError(
					'User does not have access to this chat',
					'chatService',
				)

				// Mock the service method to return error
				vi.mocked(chatService.deleteChat).mockResolvedValue([null, mockError])

				// Act
				const [result, error] = await chatService.deleteChat(
					'chat-123',
					'other-user',
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toEqual(mockError)
			})
		})

		describe('sendMessage', () => {
			it('should mock sendMessage successfully', async () => {
				// Arrange - Create mock messages
				const userMessage = mockChatService.createMessage({
					id: 'user-msg-1',
					role: 'user',
					content: 'Hello, AI!',
				})
				const aiMessage = mockChatService.createMessage({
					id: 'ai-msg-1',
					role: 'assistant',
					content: 'Hello! How can I help you?',
				})

				// Mock the service method
				vi.mocked(chatService.sendMessage).mockResolvedValue([
					{ userMessage, aiResponse: aiMessage },
					null,
				])

				// Act
				const [result, error] = await chatService.sendMessage({
					chatId: 'chat-123',
					userId: 'user-123',
					content: 'Hello, AI!',
				})

				// Assert
				expect(chatService.sendMessage).toHaveBeenCalledWith({
					chatId: 'chat-123',
					userId: 'user-123',
					content: 'Hello, AI!',
				})
				expect(result).toEqual({ userMessage, aiResponse: aiMessage })
				expect(error).toBeNull()
				expect(result?.userMessage.content).toBe('Hello, AI!')
				expect(result?.aiResponse.content).toBe('Hello! How can I help you?')
			})

			it('should mock sendMessage with validation error', async () => {
				// Arrange
				const mockError = new ValidationError(
					'Content is required',
					undefined,
					'chatService',
				)

				// Mock the service method to return error
				vi.mocked(chatService.sendMessage).mockResolvedValue([null, mockError])

				// Act
				const [result, error] = await chatService.sendMessage({
					chatId: 'chat-123',
					userId: 'user-123',
					content: '',
				})

				// Assert
				expect(result).toBeNull()
				expect(error).toEqual(mockError)
			})
		})

		describe('sendMessageStreaming', () => {
			it('should mock sendMessageStreaming successfully', async () => {
				// Arrange - Create mock streaming response
				const userMessage = mockChatService.createMessage({
					id: 'user-msg-1',
					role: 'user',
					content: 'Tell me a story',
				})

				// Create a simple async iterable for testing
				const mockStream = {
					// eslint-disable-next-line @typescript-eslint/require-await
					async *[Symbol.asyncIterator]() {
						yield 'Once upon a time...'
						yield ' there was a helpful AI...'
						yield ' that loved to tell stories.'
					},
				}

				const streamingResponse = {
					messageId: 'ai-msg-streaming',
					stream: mockStream,
				}

				// Mock the service method
				vi.mocked(chatService.sendMessageStreaming).mockResolvedValue([
					{ userMessage, streamingResponse },
					null,
				])

				// Act
				const [result, error] = await chatService.sendMessageStreaming({
					chatId: 'chat-123',
					userId: 'user-123',
					content: 'Tell me a story',
				})

				// Assert
				expect(chatService.sendMessageStreaming).toHaveBeenCalledWith({
					chatId: 'chat-123',
					userId: 'user-123',
					content: 'Tell me a story',
				})
				expect(result).toEqual({ userMessage, streamingResponse })
				expect(error).toBeNull()
				expect(result?.streamingResponse.messageId).toBe('ai-msg-streaming')
			})
		})

		describe('semanticSearch', () => {
			it('should mock semanticSearch successfully', async () => {
				// Arrange - Create mock search results
				const searchResult = mockChatService.createSemanticSearchResult({
					chatId: 'chat-123',
					messageId: 'msg-1',
					content: 'Relevant message content',
					similarity: 0.95,
				})

				// Mock the service method
				vi.mocked(chatService.semanticSearch).mockResolvedValue([
					[searchResult],
					null,
				])

				// Act
				const [result, error] = await chatService.semanticSearch({
					query: 'search query',
					userId: 'user-123',
					limit: 10,
					threshold: 0.7,
				})

				// Assert
				expect(chatService.semanticSearch).toHaveBeenCalledWith({
					query: 'search query',
					userId: 'user-123',
					limit: 10,
					threshold: 0.7,
				})
				expect(result).toEqual([searchResult])
				expect(error).toBeNull()
				if (!result?.[0]) {
					throw new Error(
						'should mock semanticSearch successfully - No result found',
					)
				}
				expect(result[0].similarity).toBe(0.95)
				expect(result[0].content).toBe('Relevant message content')
			})

			it('should mock semanticSearch with empty results', async () => {
				// Arrange
				vi.mocked(chatService.semanticSearch).mockResolvedValue([[], null])

				// Act
				const [result, error] = await chatService.semanticSearch({
					query: 'no matches',
					userId: 'user-123',
				})

				// Assert
				expect(result).toEqual([])
				expect(error).toBeNull()
			})
		})

		describe('updateMessageContent', () => {
			it('should mock updateMessageContent successfully', async () => {
				// Arrange - Create updated message
				const updatedMessage = mockChatService.createMessage({
					id: 'msg-123',
					content: 'Updated content',
				})

				// Mock the service method
				vi.mocked(chatService.updateMessageContent).mockResolvedValue([
					updatedMessage,
					null,
				])

				// Act
				const [result, error] = await chatService.updateMessageContent(
					'msg-123',
					'Updated content',
				)

				// Assert
				expect(chatService.updateMessageContent).toHaveBeenCalledWith(
					'msg-123',
					'Updated content',
				)
				expect(result).toEqual(updatedMessage)
				expect(error).toBeNull()
				expect(result?.content).toBe('Updated content')
			})
		})
	})
})

describe('Mock Data Creation', () => {
	describe('createChat', () => {
		it('should create chat with defaults', () => {
			// Act
			const chat = mockChatService.createChat()

			// Assert
			expect(chat).toEqual({
				id: '987fcdeb-51a2-43d1-9f12-123456789abc',
				userId: '123e4567-e89b-12d3-a456-426614174000',
				title: 'Test Chat',
				createdAt: new Date('2024-01-01T00:00:00Z'),
				updatedAt: new Date('2024-01-01T00:00:00Z'),
			})
		})

		it('should create chat with overrides', () => {
			// Act
			const chat = mockChatService.createChat({
				id: 'custom-chat-id',
				title: 'Custom Chat Title',
				userId: 'custom-user-id',
			})

			// Assert
			expect(chat.id).toBe('custom-chat-id')
			expect(chat.title).toBe('Custom Chat Title')
			expect(chat.userId).toBe('custom-user-id')
			// Other properties should keep defaults
			expect(chat.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'))
			expect(chat.updatedAt).toEqual(new Date('2024-01-01T00:00:00Z'))
		})

		it('should create chat with partial overrides', () => {
			// Act
			const chat = mockChatService.createChat({
				title: 'Partial Override',
			})

			// Assert
			expect(chat.title).toBe('Partial Override')
			// Other properties should keep defaults
			expect(chat.id).toBe('987fcdeb-51a2-43d1-9f12-123456789abc')
			expect(chat.userId).toBe('123e4567-e89b-12d3-a456-426614174000')
		})
	})

	describe('createMessage', () => {
		it('should create message with defaults', () => {
			// Act
			const message = mockChatService.createMessage()

			// Assert
			expect(message).toEqual({
				id: 'msg-123',
				chatId: '987fcdeb-51a2-43d1-9f12-123456789abc',
				role: 'user',
				content: 'Hello, world!',
				metadata: {},
				embedding: null,
				createdAt: new Date('2024-01-01T00:00:00Z'),
			})
		})

		it('should create message with overrides', () => {
			// Act
			const message = mockChatService.createMessage({
				id: 'custom-msg-id',
				role: 'assistant',
				content: 'Custom message content',
				metadata: { source: 'test' },
			})

			// Assert
			expect(message.id).toBe('custom-msg-id')
			expect(message.role).toBe('assistant')
			expect(message.content).toBe('Custom message content')
			expect(message.metadata).toEqual({ source: 'test' })
			// Other properties should keep defaults
			expect(message.chatId).toBe('987fcdeb-51a2-43d1-9f12-123456789abc')
			expect(message.embedding).toBeNull()
		})

		it('should create message with different roles', () => {
			// Test all valid roles
			const userMessage = mockChatService.createMessage({ role: 'user' })
			const assistantMessage = mockChatService.createMessage({
				role: 'assistant',
			})
			const systemMessage = mockChatService.createMessage({ role: 'system' })

			expect(userMessage.role).toBe('user')
			expect(assistantMessage.role).toBe('assistant')
			expect(systemMessage.role).toBe('system')
		})

		it('should create message with embedding', () => {
			// Act
			const message = mockChatService.createMessage({
				embedding: [0.1, 0.2, 0.3],
			})

			// Assert
			expect(message.embedding).toEqual([0.1, 0.2, 0.3])
		})
	})

	describe('createChatWithMessages', () => {
		it('should create chat with messages using defaults', () => {
			// Act
			const chatWithMessages = mockChatService.createChatWithMessages()

			// Assert
			expect(chatWithMessages.id).toBe('987fcdeb-51a2-43d1-9f12-123456789abc')
			expect(chatWithMessages.title).toBe('Test Chat')
			expect(chatWithMessages.messages).toHaveLength(1)
			if (!chatWithMessages.messages[0]) {
				throw new Error(
					'should create chat with messages using defaults - No message found',
				)
			}
			expect(chatWithMessages.messages[0].chatId).toBe(chatWithMessages.id)
			expect(chatWithMessages.messages[0].content).toBe('Hello, world!')
		})

		it('should create chat with custom messages', () => {
			// Arrange
			const customMessages = [
				mockChatService.createMessage({
					id: 'msg-1',
					role: 'user',
					content: 'First message',
				}),
				mockChatService.createMessage({
					id: 'msg-2',
					role: 'assistant',
					content: 'Second message',
				}),
			]

			// Act
			const chatWithMessages = mockChatService.createChatWithMessages({
				title: 'Custom Chat',
				messages: customMessages,
			})

			// Assert
			expect(chatWithMessages.title).toBe('Custom Chat')
			expect(chatWithMessages.messages).toHaveLength(2)
			if (!chatWithMessages.messages[0] || !chatWithMessages.messages[1]) {
				throw new Error(
					'should create chat with custom messages - No messages found',
				)
			}
			expect(chatWithMessages.messages[0].content).toBe('First message')
			expect(chatWithMessages.messages[1].content).toBe('Second message')
		})

		it('should create chat with empty messages', () => {
			// Act
			const chatWithMessages = mockChatService.createChatWithMessages({
				messages: [],
			})

			// Assert
			expect(chatWithMessages.messages).toHaveLength(0)
		})
	})

	describe('createInsertChat', () => {
		it(`should create insert chat with defaults`, () => {
			// Act
			const insertChat = mockChatService.createInsertChat()

			// Assert
			expect(insertChat).toEqual({
				id: '987fcdeb-51a2-43d1-9f12-123456789abc',
				userId: '123e4567-e89b-12d3-a456-426614174000',
				title: 'Test Chat',
			})
		})

		it('should create insert chat with overrides', () => {
			// Act
			const insertChat = mockChatService.createInsertChat({
				userId: 'custom-user-id',
				title: 'Custom Insert Chat',
			})

			// Assert
			expect(insertChat.userId).toBe('custom-user-id')
			expect(insertChat.title).toBe('Custom Insert Chat')
			// ID should keep default
			expect(insertChat.id).toBe('987fcdeb-51a2-43d1-9f12-123456789abc')
		})

		it('should create insert chat without id when not provided', () => {
			// Act
			const insertChat = mockChatService.createInsertChat({
				id: undefined,
			})

			// Assert
			expect(insertChat.id).toBeUndefined()
		})
	})

	describe('createChatsPagination', () => {
		it('should create pagination with defaults', () => {
			// Act
			const pagination = mockChatService.createChatsPagination()

			// Assert
			expect(pagination.chats).toHaveLength(1)
			expect(pagination.total).toBe(1)
			expect(pagination.chats[0]).toEqual(
				expect.objectContaining({
					id: '987fcdeb-51a2-43d1-9f12-123456789abc',
					title: 'Test Chat',
				}),
			)
		})

		it('should create pagination with custom chats', () => {
			// Arrange
			const customChats = [
				mockChatService.createChat({ id: 'chat-1', title: 'Chat 1' }),
				mockChatService.createChat({ id: 'chat-2', title: 'Chat 2' }),
			]

			// Act
			const pagination = mockChatService.createChatsPagination({
				chats: customChats,
				total: 2,
			})

			// Assert
			expect(pagination.chats).toHaveLength(2)
			expect(pagination.total).toBe(2)
			if (!pagination.chats[0] || !pagination.chats[1]) {
				throw new Error(
					'should create pagination with custom chats - No chats found',
				)
			}
			expect(pagination.chats[0].title).toBe('Chat 1')
			expect(pagination.chats[1].title).toBe('Chat 2')
		})

		it('should create empty pagination', () => {
			// Act
			const pagination = mockChatService.createChatsPagination({
				chats: [],
				total: 0,
			})

			// Assert
			expect(pagination.chats).toHaveLength(0)
			expect(pagination.total).toBe(0)
		})
	})

	describe('createSemanticSearchResult', () => {
		it('should create search result with defaults', () => {
			// Act
			const result = mockChatService.createSemanticSearchResult()

			// Assert
			expect(result).toEqual({
				chatId: '987fcdeb-51a2-43d1-9f12-123456789abc',
				messageId: 'msg-123',
				content: 'Hello, world!',
				similarity: 0.95,
				metadata: {},
				createdAt: new Date('2024-01-01T00:00:00Z'),
			})
		})

		it('should create search result with overrides', () => {
			// Act
			const result = mockChatService.createSemanticSearchResult({
				chatId: 'custom-chat-id',
				messageId: 'custom-msg-id',
				content: 'Custom search result content',
				similarity: 0.85,
				metadata: { source: 'search' },
			})

			// Assert
			expect(result.chatId).toBe('custom-chat-id')
			expect(result.messageId).toBe('custom-msg-id')
			expect(result.content).toBe('Custom search result content')
			expect(result.similarity).toBe(0.85)
			expect(result.metadata).toEqual({ source: 'search' })
			// Other properties should keep defaults
			expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'))
		})

		it('should create search result with different similarity scores', () => {
			// Test various similarity scores
			const highSimilarity = mockChatService.createSemanticSearchResult({
				similarity: 0.99,
			})
			const mediumSimilarity = mockChatService.createSemanticSearchResult({
				similarity: 0.75,
			})
			const lowSimilarity = mockChatService.createSemanticSearchResult({
				similarity: 0.5,
			})

			expect(highSimilarity.similarity).toBe(0.99)
			expect(mediumSimilarity.similarity).toBe(0.75)
			expect(lowSimilarity.similarity).toBe(0.5)
		})
	})

	describe('Mock Module Creation', () => {
		describe('createModule', () => {
			it('should create module with all required methods', () => {
				// Act
				const module = mockChatService.createModule()

				// Assert
				expect(module).toHaveProperty('chatService')
				expect(typeof module.chatService).toBe('object')

				// Verify all expected methods exist and are functions
				const expectedMethods = [
					'getUserChats',
					'createChat',
					'getChatWithMessages',
					'verifyChatOwnership',
					'updateChat',
					'deleteChat',
					'sendMessage',
					'sendMessageStreaming',
					'updateMessageContent',
					'semanticSearch',
				] as const

				expectedMethods.forEach((method) => {
					expect(module.chatService).toHaveProperty(method)
					expect(typeof module.chatService[method]).toBe('function')
				})
			})

			it('should create module with mockable methods', () => {
				// Act
				const module = mockChatService.createModule()

				// Assert - All methods should be Vitest mock functions
				expect(vi.isMockFunction(module.chatService.getUserChats)).toBe(true)
				expect(vi.isMockFunction(module.chatService.createChat)).toBe(true)
				expect(vi.isMockFunction(module.chatService.getChatWithMessages)).toBe(
					true,
				)
				expect(vi.isMockFunction(module.chatService.verifyChatOwnership)).toBe(
					true,
				)
				expect(vi.isMockFunction(module.chatService.updateChat)).toBe(true)
				expect(vi.isMockFunction(module.chatService.deleteChat)).toBe(true)
				expect(vi.isMockFunction(module.chatService.sendMessage)).toBe(true)
				expect(vi.isMockFunction(module.chatService.sendMessageStreaming)).toBe(
					true,
				)
				expect(vi.isMockFunction(module.chatService.updateMessageContent)).toBe(
					true,
				)
				expect(vi.isMockFunction(module.chatService.semanticSearch)).toBe(true)
			})
		})

		describe('setup', () => {
			it('should return mock service with cleared mocks', () => {
				// Arrange - Create a mock and call it
				const initialMock = mockChatService.setup()
				initialMock.getUserChats.mockResolvedValue([
					mockChatService.createChatsPagination(),
					null,
				])

				// Act - Setup again (should clear previous mocks)
				const freshMock = mockChatService.setup()

				// Assert
				expect(vi.isMockFunction(freshMock.getUserChats)).toBe(true)
				expect(freshMock.getUserChats).not.toHaveBeenCalled()
			})

			it('should return all required methods', () => {
				// Act
				const mock = mockChatService.setup()

				// Assert
				const expectedMethods = [
					'getUserChats',
					'createChat',
					'getChatWithMessages',
					'verifyChatOwnership',
					'updateChat',
					'deleteChat',
					'sendMessage',
					'sendMessageStreaming',
					'updateMessageContent',
					'semanticSearch',
				] as const

				expectedMethods.forEach((method) => {
					expect(mock).toHaveProperty(method)
					expect(typeof mock[method]).toBe('function')
					expect(vi.isMockFunction(mock[method])).toBe(true)
				})
			})
		})
	})

	describe('Type Safety and Result Format', () => {
		it('should maintain proper Result tuple format for success cases', async () => {
			// Arrange
			const mockChat = mockChatService.createChat()
			vi.mocked(chatService.createChat).mockResolvedValue([mockChat, null])

			// Act
			const [result, error] = await chatService.createChat({
				userId: 'user-123',
				title: 'Test',
			})

			// Assert - Verify Result<T> tuple format
			expect(Array.isArray([result, error])).toBe(true)
			expect(result).not.toBeNull()
			expect(error).toBeNull()
			expect(typeof result).toBe('object')
		})

		it('should maintain proper Result tuple format for error cases', async () => {
			// Arrange
			const mockError = new ValidationError('Test error', undefined, 'test')
			vi.mocked(chatService.createChat).mockResolvedValue([null, mockError])

			// Act
			const [result, error] = await chatService.createChat({
				userId: '',
				title: '',
			})

			// Assert - Verify Result<T> tuple format
			expect(Array.isArray([result, error])).toBe(true)
			expect(result).toBeNull()
			expect(error).not.toBeNull()
			expect(error).toBeInstanceOf(Error)
		})

		it('should generate data that conforms to chat type interfaces', () => {
			// Act
			const chat = mockChatService.createChat()
			const message = mockChatService.createMessage()
			const chatWithMessages = mockChatService.createChatWithMessages()
			const pagination = mockChatService.createChatsPagination()
			const searchResult = mockChatService.createSemanticSearchResult()

			// Assert - Verify required properties exist and have correct types
			// TChat interface
			expect(typeof chat.id).toBe('string')
			expect(typeof chat.userId).toBe('string')
			expect(typeof chat.title).toBe('string')
			expect(chat.createdAt).toBeInstanceOf(Date)
			expect(chat.updatedAt).toBeInstanceOf(Date)

			// TChatMessage interface
			expect(typeof message.id).toBe('string')
			expect(typeof message.chatId).toBe('string')
			expect(['user', 'assistant', 'system']).toContain(message.role)
			expect(typeof message.content).toBe('string')
			expect(typeof message.metadata).toBe('object')
			expect(message.createdAt).toBeInstanceOf(Date)

			// ChatWithMessages interface
			expect(typeof chatWithMessages.id).toBe('string')
			expect(Array.isArray(chatWithMessages.messages)).toBe(true)

			// Pagination interface
			expect(Array.isArray(pagination.chats)).toBe(true)
			expect(typeof pagination.total).toBe('number')

			// SemanticSearchResult interface
			expect(typeof searchResult.chatId).toBe('string')
			expect(typeof searchResult.messageId).toBe('string')
			expect(typeof searchResult.content).toBe('string')
			expect(typeof searchResult.similarity).toBe('number')
			expect(typeof searchResult.metadata).toBe('object')
			expect(searchResult.createdAt).toBeInstanceOf(Date)
		})

		it('should handle edge cases and null values properly', () => {
			// Test null/undefined handling
			const messageWithNullEmbedding = mockChatService.createMessage({
				embedding: null,
			})
			const messageWithEmbedding = mockChatService.createMessage({
				embedding: [0.1, 0.2, 0.3],
			})
			const emptyPagination = mockChatService.createChatsPagination({
				chats: [],
				total: 0,
			})

			// Assert
			expect(messageWithNullEmbedding.embedding).toBeNull()
			expect(Array.isArray(messageWithEmbedding.embedding)).toBe(true)
			expect(emptyPagination.chats).toHaveLength(0)
			expect(emptyPagination.total).toBe(0)
		})
	})
})

import express from 'express'
import { z } from 'zod'

import { type Result } from '../../utils/errors.ts'

import {
	insertChatSchema,
	insertChatVectorSchema,
	insertMessageSchema,
	selectChatSchema,
	selectChatVectorSchema,
	selectMessageSchema,
} from './chat.schemas.ts'

// Chat message role type
type ChatMessageRole = 'user' | 'assistant' | 'system'

// Pagination interface
interface PaginationOptions {
	page?: number
	limit?: number
}

// Chat with messages interface
interface ChatWithMessages extends TChat {
	messages: TChatMessage[]
}

// Semantic search options
interface SemanticSearchOptions {
	query: string
	limit?: number
	threshold?: number
	userId: string
	chatId?: string // Optional: search within specific chat
}

// Semantic search result
interface SemanticSearchResult {
	chatId: string
	messageId: string
	content: string
	similarity: number
	metadata: Record<string, unknown>
	createdAt: Date
}

// Chat repository interface
interface IChatRepository {
	findChatById: (id: string) => Promise<Result<TChat | undefined>>
	findChatsByUserId: (
		userId: string,
		options?: PaginationOptions,
	) => Promise<Result<{ chats: TChat[]; total: number }>>
	createChat: (chatData: TInsertChat) => Promise<Result<TChat>>
	updateChat: (
		id: string,
		chatData: Partial<TInsertChat>,
	) => Promise<Result<TChat | undefined>>
	deleteChat: (id: string) => Promise<Result<void>>
	verifyChatOwnership: (
		chatId: string,
		userId: string,
	) => Promise<Result<boolean>>
	updateChatTimestamp: (chatId: string) => Promise<Result<void>>
}

// Message repository interface
interface IMessageRepository {
	findMessageById: (id: string) => Promise<Result<TChatMessage | undefined>>
	findMessagesByChatId: (chatId: string) => Promise<Result<TChatMessage[]>>
	createMessage: (
		messageData: TInsertChatMessage,
	) => Promise<Result<TChatMessage>>
	updateMessage: (
		id: string,
		messageData: Partial<TInsertChatMessage>,
	) => Promise<Result<TChatMessage | undefined>>
	deleteMessage: (id: string) => Promise<Result<void>>
	getChatHistory: (chatId: string) => Promise<
		Result<
			{
				role: ChatMessageRole
				content: string
			}[]
		>
	>
}

// Vector repository interface
interface IVectorRepository {
	createVector: (vectorData: TInsertChatVector) => Promise<Result<TChatVector>>
	findVectorsByUserId: (userId: string) => Promise<Result<TChatVector[]>>
	findVectorsByChatId: (chatId: string) => Promise<Result<TChatVector[]>>
	semanticSearch: (
		options: SemanticSearchOptions,
	) => Promise<Result<SemanticSearchResult[]>>
	deleteVectorsByMessageId: (messageId: string) => Promise<Result<void>>
	deleteVectorsByChatId: (chatId: string) => Promise<Result<void>>
}

// Chat service interface
interface IChatService {
	createChat: (request: {
		userId: string
		title: string
	}) => Promise<Result<TChat>>

	getUserChats: (
		userId: string,
		options?: PaginationOptions,
	) => Promise<Result<{ chats: TChat[]; total: number }>>

	getChatWithMessages: (
		chatId: string,
		userId: string,
	) => Promise<Result<ChatWithMessages>>

	sendMessage: (request: {
		chatId: string
		userId: string
		content: string
		role?: ChatMessageRole
	}) => Promise<Result<{ userMessage: TChatMessage; aiResponse: TChatMessage }>>

	sendMessageStreaming: (request: {
		chatId: string
		userId: string
		content: string
		role?: ChatMessageRole
	}) => Promise<
		Result<{
			userMessage: TChatMessage
			streamingResponse: {
				messageId: string
				stream: AsyncIterable<string>
			}
		}>
	>

	updateMessageContent: (
		messageId: string,
		content: string,
	) => Promise<Result<TChatMessage>>

	updateChat: (
		chatId: string,
		updates: { title?: string },
	) => Promise<Result<TChat>>

	deleteChat: (chatId: string, userId: string) => Promise<Result<void>>

	semanticSearch: (
		options: SemanticSearchOptions,
	) => Promise<Result<SemanticSearchResult[]>>

	verifyChatOwnership: (
		chatId: string,
		userId: string,
	) => Promise<Result<boolean>>
}

// Chat controller interface
interface IChatController {
	getChats: express.Handler
	createChat: express.Handler
	getChatById: express.Handler
	updateChat: express.Handler
	deleteChat: express.Handler
	streamChatMessage: express.Handler
}

// Define types using Zod schemas
type TInsertChat = z.infer<typeof insertChatSchema>
type TChat = z.infer<typeof selectChatSchema>
type TInsertChatMessage = z.infer<typeof insertMessageSchema>
type TChatMessage = z.infer<typeof selectMessageSchema>
type TInsertChatVector = z.infer<typeof insertChatVectorSchema>
type TChatVector = z.infer<typeof selectChatVectorSchema>

export type {
	ChatMessageRole,
	ChatWithMessages,
	IChatController,
	IChatRepository,
	IChatService,
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
}

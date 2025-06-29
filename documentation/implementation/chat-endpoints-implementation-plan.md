# Chat Endpoints Implementation Plan

## Overview

This document outlines the implementation plan for ChatGPT functionality in the Macro AI application, featuring streaming responses, database persistence, and user authentication integration using Vercel's @ai-sdk package.

## Current State Analysis

### ✅ **Existing Infrastructure**

- **Authentication System**: Complete Cognito-based auth with middleware
- **Database**: PostgreSQL with Drizzle ORM, pgvector support ready
- **API Architecture**: Express.js with OpenAPI documentation, Go-style error handling
- **Client Integration**: Auto-generated TypeScript client with interceptors
- **Frontend**: React with Zustand store, basic chat UI components

### ⚠️ **Missing Components**

- Chat database schema and data access layer
- AI SDK integration and streaming endpoints
- Real-time communication infrastructure
- Chat persistence and retrieval services

## Implementation Architecture

### 1. Database Schema Design

#### 1.1 Chat Tables ✅ **IMPLEMENTED**

```sql
-- Chats table for conversation metadata
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages table for individual chat messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

#### 1.2 Vector Storage Integration

- Leverage existing `chat_vectors` table for embeddings
- Link vectors to chat messages for semantic search
- Support for 1536-dimension OpenAI embeddings

### 2. AI SDK Integration

#### 2.1 Dependencies

```json
{
	"@ai-sdk/openai": "^0.0.66",
	"@ai-sdk/core": "^0.0.48",
	"ai": "^3.4.32"
}
```

#### 2.2 Configuration

- Environment variables for OpenAI API key
- Model configuration (GPT-4, GPT-3.5-turbo)
- Streaming response settings
- Rate limiting and usage tracking

### 3. API Endpoints Design

#### 3.1 Chat Management Endpoints

```typescript
// GET /api/chats - List user's chats
// POST /api/chats - Create new chat
// GET /api/chats/:id - Get chat with messages
// PUT /api/chats/:id - Update chat title
// DELETE /api/chats/:id - Delete chat
```

#### 3.2 Streaming Chat Endpoint

```typescript
// POST /api/chats/:id/messages - Send message and stream response
// Uses Server-Sent Events (SSE) for real-time streaming
// Supports partial message updates and typing indicators
```

### 4. Service Layer Architecture

#### 4.1 Chat Service

- Chat CRUD operations with user authorization
- Message persistence and retrieval
- Integration with vector storage for embeddings

#### 4.2 AI Service

- OpenAI API integration using @ai-sdk
- Streaming response handling
- Token usage tracking and rate limiting
- Error handling for AI service failures

### 5. Frontend Integration

#### 5.1 API Client Updates

- Streaming response handling in TypeScript client
- EventSource integration for SSE
- Real-time message updates in Zustand store

#### 5.2 UI Components Enhancement

- Streaming message display with typing animation
- Real-time chat updates
- Error handling and retry mechanisms

## Implementation Phases

### Phase 1: Database Foundation (Priority: High)

**Estimated Time: 1-2 days**

1. **Database Schema Implementation** ✅ **COMPLETED**

   - ✅ Create chat and chat_messages tables
   - ✅ Add Drizzle ORM schemas with Zod validation
   - ✅ Generate and apply migrations
   - ✅ Update schema barrel exports

2. **Data Access Layer**
   - Implement ChatRepository with Go-style error handling
   - Create MessageRepository for message operations
   - Add vector storage integration for embeddings
   - Comprehensive unit tests for data access

### Phase 2: AI SDK Integration (Priority: High) ✅ **COMPLETED**

**Estimated Time: 2-3 days**

1. **AI Service Setup** ✅ **COMPLETED**

   - ✅ Install and configure @ai-sdk packages
   - ✅ Create AIService with OpenAI integration
   - ✅ Implement streaming response handling
   - ✅ Add configuration management and error handling

2. **Core Chat Service**
   - Implement ChatService with business logic
   - Message processing and persistence
   - User authorization and validation
   - Integration with AI service for responses

### Phase 3: API Endpoints (Priority: High)

**Estimated Time: 2-3 days**

1. **Chat Management APIs**

   - CRUD endpoints for chat operations
   - OpenAPI documentation and validation
   - Authentication middleware integration
   - Comprehensive error handling

2. **Streaming Chat Endpoint**
   - Server-Sent Events implementation
   - Real-time message streaming
   - Partial response handling
   - Connection management and cleanup

### Phase 4: Frontend Integration (Priority: Medium)

**Estimated Time: 2-3 days**

1. **API Client Enhancement**

   - Update generated client for streaming
   - EventSource integration
   - Real-time state management
   - Error handling and reconnection logic

2. **UI Component Updates**
   - Streaming message display
   - Real-time chat synchronization
   - Enhanced user experience features
   - Loading states and error handling

### Phase 5: Advanced Features (Priority: Low)

**Estimated Time: 3-4 days**

1. **Vector Search Integration**

   - Semantic search across chat history
   - Embedding generation and storage
   - Context-aware responses
   - Search API endpoints

2. **Performance Optimization**
   - Message pagination and lazy loading
   - Connection pooling optimization
   - Caching strategies
   - Rate limiting enhancements

## Technical Considerations

### 1. Streaming Implementation

- **Server-Sent Events (SSE)** for real-time communication
- **Chunked Transfer Encoding** for progressive responses
- **Connection Management** with proper cleanup
- **Error Recovery** and reconnection strategies

### 2. Security & Authentication

- **User Authorization** for all chat operations
- **Rate Limiting** to prevent abuse
- **Input Validation** and sanitization
- **API Key Management** for OpenAI integration

### 3. Performance & Scalability

- **Database Indexing** for efficient queries
- **Connection Pooling** for database operations
- **Caching Strategies** for frequently accessed data
- **Horizontal Scaling** considerations

### 4. Error Handling

- **Go-Style Error Propagation** throughout the stack
- **Graceful Degradation** for AI service failures
- **User-Friendly Error Messages** in the frontend
- **Comprehensive Logging** for debugging

## Success Metrics

### 1. Functional Requirements

- ✅ Users can create and manage chat conversations
- ✅ Real-time streaming responses from ChatGPT
- ✅ Persistent chat history linked to user accounts
- ✅ Seamless integration with existing authentication

### 2. Performance Requirements

- ✅ Sub-second response time for chat operations
- ✅ Smooth streaming with minimal latency
- ✅ Efficient database queries with proper indexing
- ✅ Scalable architecture for concurrent users

### 3. Quality Requirements

- ✅ Comprehensive test coverage (>80%)
- ✅ Type-safe implementation throughout
- ✅ Consistent error handling patterns
- ✅ Complete API documentation

## Next Steps

1. **Review and Approval** of this implementation plan
2. **Environment Setup** with OpenAI API credentials
3. **Phase 1 Implementation** starting with database schema
4. **Iterative Development** with regular testing and feedback
5. **Integration Testing** across the full stack
6. **Performance Testing** and optimization
7. **Production Deployment** with monitoring

## Technical Implementation Details

### 1. Database Schema Implementation ✅ **COMPLETED**

#### Drizzle Schema Definition ✅ **IMPLEMENTED**

```typescript
// apps/express-api/src/features/chat/chat.schemas.ts
import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	text,
	jsonb,
	index,
	vector,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { usersTable } from '../user/user.schemas.ts'

export const chatsTable = pgTable(
	'chats',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		title: varchar('title', { length: 255 }).notNull(),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(table) => [
		index('idx_chats_user_id').on(table.userId),
		index('idx_chats_updated_at').on(table.updatedAt),
	],
)

export const chatMessagesTable = pgTable(
	'chat_messages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		chatId: uuid('chat_id')
			.notNull()
			.references(() => chatsTable.id, { onDelete: 'cascade' }),
		role: varchar('role', { length: 20 }).notNull(),
		content: text('content').notNull(),
		metadata: jsonb('metadata').default('{}'),
		embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embedding dimensions
		createdAt: timestamp('created_at').defaultNow(),
	},
	(table) => [
		index('idx_chat_messages_chat_id').on(table.chatId),
		index('idx_chat_messages_created_at').on(table.createdAt),
		// pgvector index for similarity search
		index('idx_chat_messages_embedding').using(
			'hnsw',
			table.embedding.op('vector_cosine_ops'),
		),
	],
)

// Enhanced chat vectors table for semantic search across conversations
export const chatVectorsTable = pgTable(
	'chat_vectors',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		chatId: uuid('chat_id').references(() => chatsTable.id, {
			onDelete: 'cascade',
		}),
		messageId: uuid('message_id').references(() => chatMessagesTable.id, {
			onDelete: 'cascade',
		}),
		content: text('content').notNull(), // Searchable content
		embedding: vector('embedding', { dimensions: 1536 }),
		metadata: jsonb('metadata').default('{}'),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(table) => [
		index('idx_chat_vectors_user_id').on(table.userId),
		index('idx_chat_vectors_chat_id').on(table.chatId),
		// pgvector HNSW index for fast similarity search
		index('idx_chat_vectors_embedding').using(
			'hnsw',
			table.embedding.op('vector_cosine_ops'),
		),
	],
)

// Zod schemas for validation
export const insertChatSchema = createInsertSchema(chatsTable)
export const selectChatSchema = createSelectSchema(chatsTable)
export const insertMessageSchema = createInsertSchema(chatMessagesTable)
export const selectMessageSchema = createSelectSchema(chatMessagesTable)
export const insertChatVectorSchema = createInsertSchema(chatVectorsTable)
export const selectChatVectorSchema = createSelectSchema(chatVectorsTable)

// API request/response schemas
export const createChatRequestSchema = z.object({
	title: z.string().min(1).max(255),
})

export const sendMessageRequestSchema = z.object({
	content: z.string().min(1).max(10000),
	role: z.enum(['user', 'assistant', 'system']).default('user'),
})

export const searchChatRequestSchema = z.object({
	query: z.string().min(1).max(1000),
	limit: z.number().min(1).max(50).default(10),
	threshold: z.number().min(0).max(1).default(0.7), // Similarity threshold
})

// Type definitions for pgvector operations
export type ChatVector = typeof chatVectorsTable.$inferSelect
export type NewChatVector = typeof chatVectorsTable.$inferInsert
export type ChatMessage = typeof chatMessagesTable.$inferSelect
export type NewChatMessage = typeof chatMessagesTable.$inferInsert
```

### 2. AI SDK Service Implementation

#### AI Service with Streaming

```typescript
// apps/express-api/src/features/chat/ai.service.ts
import { openai } from '@ai-sdk/openai'
import { streamText, generateText, embed } from 'ai'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import type { Result } from '../../utils/error-handling/types.ts'

export class AIService {
	private chatModel = openai('gpt-4-turbo-preview')
	private embeddingModel = openai('text-embedding-3-small')

	/**
	 * Generate streaming response from OpenAI with Go-style error handling
	 */
	public async generateStreamingResponse(
		messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
	): Promise<Result<AsyncIterable<string>>> {
		const [streamResult, error] = await tryCatch(
			streamText({
				model: this.chatModel,
				messages,
				maxTokens: 1000,
				temperature: 0.7,
			}),
			'aiService - generateStreamingResponse',
		)

		if (error) {
			return [null, error]
		}

		return [streamResult.textStream, null]
	}

	/**
	 * Generate non-streaming response from OpenAI with Go-style error handling
	 */
	public async generateResponse(
		messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
	): Promise<Result<string>> {
		const [result, error] = await tryCatch(
			generateText({
				model: this.chatModel,
				messages,
				maxTokens: 1000,
				temperature: 0.7,
			}),
			'aiService - generateResponse',
		)

		if (error) {
			return [null, error]
		}

		return [result.text, null]
	}

	/**
	 * Generate embeddings for text content using OpenAI embeddings
	 * Returns 1536-dimensional vector for pgvector storage
	 */
	public async generateEmbedding(text: string): Promise<Result<number[]>> {
		const [result, error] = await tryCatch(
			embed({
				model: this.embeddingModel,
				value: text,
			}),
			'aiService - generateEmbedding',
		)

		if (error) {
			return [null, error]
		}

		return [result.embedding, null]
	}

	/**
	 * Generate embeddings for multiple texts in batch
	 */
	public async generateEmbeddings(
		texts: string[],
	): Promise<Result<number[][]>> {
		const embeddings: number[][] = []

		for (const text of texts) {
			const [embedding, error] = await this.generateEmbedding(text)

			if (error) {
				return [null, error]
			}

			embeddings.push(embedding)
		}

		return [embeddings, null]
	}
}

export const aiService = new AIService()
```

### 3. Streaming Endpoint Implementation

#### Server-Sent Events Controller

```typescript
// apps/express-api/src/features/chat/chat.controllers.ts
import { Request, Response } from 'express'
import { chatService } from './chat.service.ts'
import { aiService } from './ai.service.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { pino } from '../../utils/logger.ts'

const { logger } = pino

export const streamChatResponse = async (req: Request, res: Response) => {
	const { chatId } = req.params
	const { content } = req.body
	const userId = req.userId

	// Set SSE headers for streaming
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Cache-Control',
	})

	// Helper function to send SSE data with Go-style error handling
	const sendSSEData = (data: object): void => {
		const [, writeError] = tryCatchSync(
			() => res.write(`data: ${JSON.stringify(data)}\n\n`),
			'streamChatResponse - sendSSEData',
		)

		if (writeError) {
			logger.error({
				msg: '[streamChatResponse]: Error writing SSE data',
				error: writeError.message,
				userId,
				chatId,
			})
		}
	}

	// Save user message with Go-style error handling
	const [userMessage, userMessageError] = await chatService.addMessage(
		chatId,
		userId,
		{ role: 'user', content },
	)

	if (userMessageError) {
		logger.error({
			msg: '[streamChatResponse]: Error saving user message',
			error: userMessageError.message,
			userId,
			chatId,
		})
		sendSSEData({ error: userMessageError.message })
		res.end()
		return
	}

	// Get chat history for context with Go-style error handling
	const [messages, messagesError] = await chatService.getChatMessages(
		chatId,
		userId,
	)

	if (messagesError) {
		logger.error({
			msg: '[streamChatResponse]: Error retrieving chat messages',
			error: messagesError.message,
			userId,
			chatId,
		})
		sendSSEData({ error: messagesError.message })
		res.end()
		return
	}

	// Generate streaming response with Go-style error handling
	const [stream, streamError] =
		await aiService.generateStreamingResponse(messages)

	if (streamError) {
		logger.error({
			msg: '[streamChatResponse]: Error generating AI response',
			error: streamError.message,
			userId,
			chatId,
		})
		sendSSEData({ error: streamError.message })
		res.end()
		return
	}

	let fullResponse = ''

	// Stream the response with Go-style error handling
	const [, streamingError] = await tryCatch(async () => {
		for await (const chunk of stream) {
			fullResponse += chunk
			sendSSEData({ content: chunk, type: 'chunk' })
		}
	}, 'streamChatResponse - streaming')

	if (streamingError) {
		logger.error({
			msg: '[streamChatResponse]: Error during streaming',
			error: streamingError.message,
			userId,
			chatId,
		})
		sendSSEData({ error: 'Streaming error occurred' })
		res.end()
		return
	}

	// Save assistant message with Go-style error handling
	const [, saveError] = await chatService.addMessage(chatId, userId, {
		role: 'assistant',
		content: fullResponse,
	})

	if (saveError) {
		logger.error({
			msg: '[streamChatResponse]: Error saving assistant message',
			error: saveError.message,
			userId,
			chatId,
		})
		// Continue anyway as the response was already streamed
	}

	// Generate and save embedding for semantic search
	const [, embeddingError] = await chatService.generateAndSaveEmbedding(
		chatId,
		userId,
		fullResponse,
	)

	if (embeddingError) {
		logger.warn({
			msg: '[streamChatResponse]: Error generating embedding',
			error: embeddingError.message,
			userId,
			chatId,
		})
		// Continue anyway as this is not critical for the response
	}

	// Send completion signal
	sendSSEData({ type: 'complete' })
	res.end()
}
```

### 4. Frontend Streaming Integration

#### Recommended NPM Packages

```json
{
	"dependencies": {
		"@ai-sdk/openai": "^0.0.66",
		"@ai-sdk/core": "^0.0.48",
		"ai": "^3.4.32",
		"eventsource-polyfill": "^0.9.6",
		"readable-stream": "^4.5.2",
		"stream-browserify": "^3.0.0"
	},
	"devDependencies": {
		"@types/eventsource": "^1.1.15"
	}
}
```

**Package Purposes:**

- **@ai-sdk/openai**: Official Vercel AI SDK for OpenAI integration
- **ai**: Core AI SDK with streaming utilities and React hooks
- **eventsource-polyfill**: EventSource polyfill for older browsers
- **readable-stream**: Node.js streams in the browser for advanced stream handling
- **stream-browserify**: Browser-compatible stream utilities

#### EventSource Client Implementation

```typescript
// apps/client-ui/src/services/chat/streaming.service.ts
import { logger } from '@/lib/logger/logger'

export interface StreamingResult {
	success: boolean
	error?: string
}

export interface StreamingCallbacks {
	onChunk: (chunk: string) => void
	onComplete: () => void
	onError: (error: string) => void
}

export class StreamingChatService {
	private eventSource: EventSource | null = null
	private abortController: AbortController | null = null

	/**
	 * Send message and handle streaming response with proper error handling
	 */
	public async sendMessage(
		chatId: string,
		content: string,
		callbacks: StreamingCallbacks,
	): Promise<StreamingResult> {
		const { onChunk, onComplete, onError } = callbacks

		// Create abort controller for request cancellation
		this.abortController = new AbortController()

		// Send message via fetch API with proper error handling
		const sendResult = await this.sendMessageRequest(chatId, content)

		if (!sendResult.success) {
			onError(sendResult.error || 'Failed to send message')
			return { success: false, error: sendResult.error }
		}

		// Setup EventSource for streaming response
		const streamResult = this.setupEventSource(chatId, callbacks)

		if (!streamResult.success) {
			onError(streamResult.error || 'Failed to setup streaming')
			return { success: false, error: streamResult.error }
		}

		return { success: true }
	}

	/**
	 * Send message request with Go-style error handling pattern
	 */
	private async sendMessageRequest(
		chatId: string,
		content: string,
	): Promise<StreamingResult> {
		const apiKey = import.meta.env.VITE_API_KEY

		if (!apiKey) {
			logger.error('[StreamingChatService]: Missing API key')
			return { success: false, error: 'Configuration error' }
		}

		const requestOptions: RequestInit = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-KEY': apiKey,
			},
			credentials: 'include',
			body: JSON.stringify({ content }),
			signal: this.abortController?.signal,
		}

		const response = await fetch(
			`/api/chats/${chatId}/stream`,
			requestOptions,
		).catch((error) => {
			logger.error({
				msg: '[StreamingChatService]: Fetch error',
				error: error.message,
				chatId,
			})
			return null
		})

		if (!response) {
			return { success: false, error: 'Network error' }
		}

		if (!response.ok) {
			logger.error({
				msg: '[StreamingChatService]: HTTP error',
				status: response.status,
				chatId,
			})
			return { success: false, error: `HTTP ${response.status}` }
		}

		return { success: true }
	}

	/**
	 * Setup EventSource with proper error handling and cleanup
	 */
	private setupEventSource(
		chatId: string,
		callbacks: StreamingCallbacks,
	): StreamingResult {
		const { onChunk, onComplete, onError } = callbacks

		const eventSourceUrl = `/api/chats/${chatId}/stream`

		this.eventSource = new EventSource(eventSourceUrl)

		this.eventSource.onmessage = (event) => {
			const parseResult = this.parseEventData(event.data)

			if (!parseResult.success) {
				onError(parseResult.error || 'Failed to parse response')
				this.cleanup()
				return
			}

			const data = parseResult.data

			if (data.type === 'chunk') {
				onChunk(data.content)
			} else if (data.type === 'complete') {
				onComplete()
				this.cleanup()
			} else if (data.error) {
				onError(data.error)
				this.cleanup()
			}
		}

		this.eventSource.onerror = (event) => {
			logger.error({
				msg: '[StreamingChatService]: EventSource error',
				event,
				chatId,
			})
			onError('Connection error')
			this.cleanup()
		}

		return { success: true }
	}

	/**
	 * Parse event data with Go-style error handling
	 */
	private parseEventData(data: string): {
		success: boolean
		data?: any
		error?: string
	} {
		if (!data || data.trim() === '') {
			return { success: false, error: 'Empty data' }
		}

		const parsed = JSON.parse(data).catch((error) => {
			logger.error({
				msg: '[StreamingChatService]: JSON parse error',
				error: error.message,
				data,
			})
			return null
		})

		if (!parsed) {
			return { success: false, error: 'Invalid JSON' }
		}

		return { success: true, data: parsed }
	}

	/**
	 * Cleanup resources with proper error handling
	 */
	private cleanup(): void {
		if (this.eventSource) {
			this.eventSource.close()
			this.eventSource = null
		}

		if (this.abortController) {
			this.abortController.abort()
			this.abortController = null
		}
	}

	/**
	 * Public method to disconnect and cleanup
	 */
	public disconnect(): void {
		this.cleanup()
	}
}
```

### 5. pgvector Integration for Semantic Search

#### Vector Service Implementation

```typescript
// apps/express-api/src/features/chat/vector.service.ts
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '../../data-access/db.ts'
import { chatVectorsTable } from './chat.schemas.ts'
import { aiService } from './ai.service.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import type { Result } from '../../utils/error-handling/types.ts'

export class VectorService {
	/**
	 * Generate and store embedding for chat content
	 */
	public async storeEmbedding(
		userId: string,
		chatId: string,
		messageId: string,
		content: string,
	): Promise<Result<string>> {
		// Generate embedding using AI service
		const [embedding, embeddingError] =
			await aiService.generateEmbedding(content)

		if (embeddingError) {
			return [null, embeddingError]
		}

		// Store in database with Go-style error handling
		const [result, storeError] = await tryCatch(
			db
				.insert(chatVectorsTable)
				.values({
					userId,
					chatId,
					messageId,
					content,
					embedding,
					metadata: {
						contentLength: content.length,
						timestamp: new Date().toISOString(),
					},
				})
				.returning({ id: chatVectorsTable.id }),
			'vectorService - storeEmbedding',
		)

		if (storeError) {
			return [null, storeError]
		}

		return [result[0].id, null]
	}

	/**
	 * Perform semantic search across user's chat history
	 */
	public async semanticSearch(
		userId: string,
		query: string,
		limit: number = 10,
		threshold: number = 0.7,
	): Promise<
		Result<Array<{ content: string; chatId: string; similarity: number }>>
	> {
		// Generate embedding for search query
		const [queryEmbedding, embeddingError] =
			await aiService.generateEmbedding(query)

		if (embeddingError) {
			return [null, embeddingError]
		}

		// Perform vector similarity search using pgvector
		const [results, searchError] = await tryCatch(
			db
				.select({
					content: chatVectorsTable.content,
					chatId: chatVectorsTable.chatId,
					similarity: sql<number>`1 - (${chatVectorsTable.embedding} <=> ${queryEmbedding}::vector)`,
				})
				.from(chatVectorsTable)
				.where(eq(chatVectorsTable.userId, userId))
				.having(
					sql`1 - (${chatVectorsTable.embedding} <=> ${queryEmbedding}::vector) > ${threshold}`,
				)
				.orderBy(
					desc(
						sql`1 - (${chatVectorsTable.embedding} <=> ${queryEmbedding}::vector)`,
					),
				)
				.limit(limit),
			'vectorService - semanticSearch',
		)

		if (searchError) {
			return [null, searchError]
		}

		return [results, null]
	}

	/**
	 * Find similar messages within a specific chat
	 */
	public async findSimilarInChat(
		userId: string,
		chatId: string,
		query: string,
		limit: number = 5,
	): Promise<Result<Array<{ content: string; similarity: number }>>> {
		const [queryEmbedding, embeddingError] =
			await aiService.generateEmbedding(query)

		if (embeddingError) {
			return [null, embeddingError]
		}

		const [results, searchError] = await tryCatch(
			db
				.select({
					content: chatVectorsTable.content,
					similarity: sql<number>`1 - (${chatVectorsTable.embedding} <=> ${queryEmbedding}::vector)`,
				})
				.from(chatVectorsTable)
				.where(
					sql`${chatVectorsTable.userId} = ${userId} AND ${chatVectorsTable.chatId} = ${chatId}`,
				)
				.orderBy(
					desc(
						sql`1 - (${chatVectorsTable.embedding} <=> ${queryEmbedding}::vector)`,
					),
				)
				.limit(limit),
			'vectorService - findSimilarInChat',
		)

		if (searchError) {
			return [null, searchError]
		}

		return [results, null]
	}
}

export const vectorService = new VectorService()
```

#### Complete Chat Routes with Authentication & Authorization

```typescript
// apps/express-api/src/features/chat/chat.routes.ts
import { Router } from 'express'
import { verifyAuth } from '../../middleware/auth.middleware.ts'
import { validateRequest } from '../../middleware/validation.middleware.ts'
import {
	createChatRequestSchema,
	sendMessageRequestSchema,
	searchChatRequestSchema,
} from './chat.schemas.ts'
import { chatService } from './chat.service.ts'
import { vectorService } from './vector.service.ts'
import { streamChatResponse } from './chat.controllers.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { pino } from '../../utils/logger.ts'

const { logger } = pino
const router = Router()

// All chat routes require authentication
router.use(verifyAuth)

// GET /api/chats - List user's chats with pagination
router.get('/', async (req, res) => {
	const userId = req.userId
	const page = Number(req.query.page) || 1
	const limit = Math.min(Number(req.query.limit) || 20, 100) // Max 100 chats per request

	const [chats, error] = await chatService.getUserChats(userId, page, limit)

	if (error) {
		logger.error({
			msg: '[chatRoutes]: Error retrieving user chats',
			error: error.message,
			userId,
		})
		return res.status(500).json({
			success: false,
			error: 'Failed to retrieve chats',
		})
	}

	res.json({
		success: true,
		data: chats,
		meta: {
			page,
			limit,
			total: chats.length,
		},
	})
})

// POST /api/chats - Create new chat (user can only create for themselves)
router.post('/', validateRequest(createChatRequestSchema), async (req, res) => {
	const userId = req.userId
	const { title } = req.body

	const [chat, error] = await chatService.createChat(userId, title)

	if (error) {
		logger.error({
			msg: '[chatRoutes]: Error creating chat',
			error: error.message,
			userId,
		})
		return res.status(500).json({
			success: false,
			error: 'Failed to create chat',
		})
	}

	logger.info({
		msg: '[chatRoutes]: Chat created successfully',
		chatId: chat.id,
		userId,
	})

	res.status(201).json({
		success: true,
		data: chat,
	})
})

// GET /api/chats/:id - Get specific chat with messages (with ownership verification)
router.get('/:id', async (req, res) => {
	const userId = req.userId
	const chatId = req.params.id

	// Verify chat ownership and get chat with messages
	const [chat, error] = await chatService.getChatWithMessages(chatId, userId)

	if (error) {
		logger.error({
			msg: '[chatRoutes]: Error retrieving chat',
			error: error.message,
			userId,
			chatId,
		})

		// Return 404 for both non-existent and unauthorized access
		return res.status(404).json({
			success: false,
			error: 'Chat not found',
		})
	}

	res.json({
		success: true,
		data: chat,
	})
})

// PUT /api/chats/:id - Update chat title (with ownership verification)
router.put(
	'/:id',
	validateRequest(createChatRequestSchema),
	async (req, res) => {
		const userId = req.userId
		const chatId = req.params.id
		const { title } = req.body

		const [updatedChat, error] = await chatService.updateChat(chatId, userId, {
			title,
		})

		if (error) {
			logger.error({
				msg: '[chatRoutes]: Error updating chat',
				error: error.message,
				userId,
				chatId,
			})

			return res.status(404).json({
				success: false,
				error: 'Chat not found',
			})
		}

		res.json({
			success: true,
			data: updatedChat,
		})
	},
)

// DELETE /api/chats/:id - Delete chat (with ownership verification)
router.delete('/:id', async (req, res) => {
	const userId = req.userId
	const chatId = req.params.id

	const [, error] = await chatService.deleteChat(chatId, userId)

	if (error) {
		logger.error({
			msg: '[chatRoutes]: Error deleting chat',
			error: error.message,
			userId,
			chatId,
		})

		return res.status(404).json({
			success: false,
			error: 'Chat not found',
		})
	}

	logger.info({
		msg: '[chatRoutes]: Chat deleted successfully',
		chatId,
		userId,
	})

	res.json({
		success: true,
		message: 'Chat deleted successfully',
	})
})

// POST /api/chats/:id/messages - Send message and stream response (with ownership verification)
router.post(
	'/:id/messages',
	validateRequest(sendMessageRequestSchema),
	async (req, res) => {
		const userId = req.userId
		const chatId = req.params.id

		// Verify chat ownership before processing message
		const [chatExists, verifyError] = await chatService.verifyChatOwnership(
			chatId,
			userId,
		)

		if (verifyError || !chatExists) {
			logger.warn({
				msg: '[chatRoutes]: Unauthorized chat access attempt',
				userId,
				chatId,
				error: verifyError?.message,
			})

			return res.status(404).json({
				success: false,
				error: 'Chat not found',
			})
		}

		// Delegate to streaming controller
		return streamChatResponse(req, res)
	},
)

// GET /api/chats/search - Semantic search across user's chats only
router.get(
	'/search',
	validateRequest(searchChatRequestSchema),
	async (req, res) => {
		const { query, limit, threshold } = req.query
		const userId = req.userId

		const [results, error] = await vectorService.semanticSearch(
			userId, // Only search within user's own chats
			query as string,
			Number(limit) || 10,
			Number(threshold) || 0.7,
		)

		if (error) {
			logger.error({
				msg: '[chatRoutes]: Error performing semantic search',
				error: error.message,
				userId,
			})

			return res.status(500).json({
				success: false,
				error: 'Search failed',
			})
		}

		res.json({
			success: true,
			data: results,
			meta: {
				query,
				resultCount: results.length,
				threshold: Number(threshold) || 0.7,
			},
		})
	},
)

export { router as chatRouter }
```

### Chat Service with Authorization Checks

```typescript
// apps/express-api/src/features/chat/chat.service.ts
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../data-access/db.ts'
import { chatsTable, chatMessagesTable } from './chat.schemas.ts'
import { aiService } from './ai.service.ts'
import { vectorService } from './vector.service.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { UnauthorizedError, NotFoundError } from '../../utils/errors.ts'
import type { Result } from '../../utils/error-handling/types.ts'

export class ChatService {
	/**
	 * Verify that a user owns a specific chat
	 */
	public async verifyChatOwnership(
		chatId: string,
		userId: string,
	): Promise<Result<boolean>> {
		const [chat, error] = await tryCatch(
			db
				.select({ id: chatsTable.id })
				.from(chatsTable)
				.where(and(eq(chatsTable.id, chatId), eq(chatsTable.userId, userId)))
				.limit(1),
			'chatService - verifyChatOwnership',
		)

		if (error) {
			return [null, error]
		}

		return [chat.length > 0, null]
	}

	/**
	 * Get user's chats with pagination (only their own chats)
	 */
	public async getUserChats(
		userId: string,
		page: number = 1,
		limit: number = 20,
	): Promise<Result<Array<any>>> {
		const offset = (page - 1) * limit

		const [chats, error] = await tryCatch(
			db
				.select()
				.from(chatsTable)
				.where(eq(chatsTable.userId, userId))
				.orderBy(desc(chatsTable.updatedAt))
				.limit(limit)
				.offset(offset),
			'chatService - getUserChats',
		)

		if (error) {
			return [null, error]
		}

		return [chats, null]
	}

	/**
	 * Create new chat for authenticated user
	 */
	public async createChat(userId: string, title: string): Promise<Result<any>> {
		const [chat, error] = await tryCatch(
			db
				.insert(chatsTable)
				.values({
					userId,
					title,
				})
				.returning(),
			'chatService - createChat',
		)

		if (error) {
			return [null, error]
		}

		return [chat[0], null]
	}

	/**
	 * Get chat with messages (with ownership verification)
	 */
	public async getChatWithMessages(
		chatId: string,
		userId: string,
	): Promise<Result<any>> {
		// First verify ownership
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
				new UnauthorizedError('Access denied to chat', 'chatService'),
			]
		}

		// Get chat with messages
		const [chat, chatError] = await tryCatch(
			db.select().from(chatsTable).where(eq(chatsTable.id, chatId)),
			'chatService - getChatWithMessages',
		)

		if (chatError) {
			return [null, chatError]
		}

		if (chat.length === 0) {
			return [null, new NotFoundError('Chat not found', 'chatService')]
		}

		const [messages, messagesError] = await tryCatch(
			db
				.select()
				.from(chatMessagesTable)
				.where(eq(chatMessagesTable.chatId, chatId))
				.orderBy(chatMessagesTable.createdAt),
			'chatService - getChatMessages',
		)

		if (messagesError) {
			return [null, messagesError]
		}

		return [{ ...chat[0], messages }, null]
	}

	/**
	 * Update chat (with ownership verification)
	 */
	public async updateChat(
		chatId: string,
		userId: string,
		updates: { title?: string },
	): Promise<Result<any>> {
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
				new UnauthorizedError('Access denied to chat', 'chatService'),
			]
		}

		const [updatedChat, error] = await tryCatch(
			db
				.update(chatsTable)
				.set({ ...updates, updatedAt: new Date() })
				.where(eq(chatsTable.id, chatId))
				.returning(),
			'chatService - updateChat',
		)

		if (error) {
			return [null, error]
		}

		return [updatedChat[0], null]
	}

	/**
	 * Delete chat (with ownership verification)
	 */
	public async deleteChat(
		chatId: string,
		userId: string,
	): Promise<Result<boolean>> {
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
				new UnauthorizedError('Access denied to chat', 'chatService'),
			]
		}

		// Delete chat (messages will be cascade deleted)
		const [, error] = await tryCatch(
			db.delete(chatsTable).where(eq(chatsTable.id, chatId)),
			'chatService - deleteChat',
		)

		if (error) {
			return [null, error]
		}

		return [true, null]
	}

	/**
	 * Add message to chat (with ownership verification)
	 */
	public async addMessage(
		chatId: string,
		userId: string,
		message: { role: string; content: string },
	): Promise<Result<any>> {
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
				new UnauthorizedError('Access denied to chat', 'chatService'),
			]
		}

		const [savedMessage, error] = await tryCatch(
			db
				.insert(chatMessagesTable)
				.values({
					chatId,
					role: message.role,
					content: message.content,
				})
				.returning(),
			'chatService - addMessage',
		)

		if (error) {
			return [null, error]
		}

		return [savedMessage[0], null]
	}

	/**
	 * Generate and save embedding for message (with ownership verification)
	 */
	public async generateAndSaveEmbedding(
		chatId: string,
		userId: string,
		content: string,
	): Promise<Result<string>> {
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
				new UnauthorizedError('Access denied to chat', 'chatService'),
			]
		}

		// Generate and store embedding
		return await vectorService.storeEmbedding(userId, chatId, '', content)
	}
}

export const chatService = new ChatService()
```

## Authorization & Security Considerations

### 1. Authentication Requirements

**All chat endpoints require valid Cognito authentication:**

- Uses existing `verifyAuth` middleware
- Extracts `userId` from verified JWT token
- Rejects requests without valid authentication

### 2. Authorization Patterns

**Ownership-Based Access Control:**

```typescript
// Every chat operation verifies user ownership
const [isOwner, error] = await chatService.verifyChatOwnership(chatId, userId)
if (!isOwner) {
	return res.status(404).json({ error: 'Chat not found' }) // Don't reveal existence
}
```

**Key Authorization Principles:**

- **Implicit Ownership**: Users can only access their own chats
- **Resource Isolation**: Database queries always filter by `userId`
- **Information Hiding**: Return 404 instead of 403 to avoid revealing chat existence
- **Fail-Safe Defaults**: Deny access by default, grant only when verified

### 3. Security Measures

**Input Validation & Sanitization:**

```typescript
// Validate all user inputs
router.post('/', validateRequest(createChatRequestSchema), async (req, res) => {
	// Schema validation ensures safe input
})

// Sanitize chat content before AI processing
const sanitizedContent = content.trim().slice(0, 10000) // Max length limit
```

**Rate Limiting Considerations:**

```typescript
// Per-user rate limiting for chat operations
const chatRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // 100 chat operations per window
	keyGenerator: (req) => req.userId,
	message: 'Too many chat requests',
})

// Stricter limits for AI streaming
const aiStreamingLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 10, // 10 AI requests per minute
	keyGenerator: (req) => req.userId,
})
```

**Data Access Patterns:**

- **Always filter by userId**: Every database query includes user ID filter
- **Parameterized queries**: Use Drizzle ORM to prevent SQL injection
- **Minimal data exposure**: Only return necessary fields in API responses

### 4. Additional Authorization Considerations

**Chat Sharing (Future Enhancement):**

```typescript
// If implementing chat sharing, add explicit permissions
interface ChatPermission {
	chatId: string
	userId: string
	permission: 'read' | 'write' | 'admin'
	grantedBy: string
	expiresAt?: Date
}
```

**Admin Access (Future Enhancement):**

```typescript
// Admin middleware for support/moderation
const requireAdmin = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const userRole = await getUserRole(req.userId)
	if (userRole !== 'admin') {
		return res.status(403).json({ error: 'Admin access required' })
	}
	next()
}
```

**Audit Logging:**

```typescript
// Log all chat access for security monitoring
logger.info({
	msg: 'Chat access',
	userId,
	chatId,
	action: 'read|write|delete',
	ip: req.ip,
	userAgent: req.get('User-Agent'),
})
```

**Content Moderation:**

```typescript
// Optional: Content filtering before AI processing
const moderateContent = async (content: string): Promise<boolean> => {
	// Check for inappropriate content
	// Return false if content should be blocked
}
```

## Additional Dependencies and Packages

### Backend Dependencies (Express API)

```json
{
	"dependencies": {
		"@ai-sdk/openai": "^0.0.66",
		"@ai-sdk/core": "^0.0.48",
		"ai": "^3.4.32",
		"drizzle-orm": "^0.33.0",
		"pg": "^8.12.0",
		"pgvector": "^0.2.0"
	},
	"devDependencies": {
		"@types/pg": "^8.11.10"
	}
}
```

**Key Packages:**

- **@ai-sdk/openai**: Official Vercel AI SDK for OpenAI integration with streaming
- **ai**: Core AI SDK with utilities for text generation and embeddings
- **pgvector**: PostgreSQL extension client for vector operations
- **drizzle-orm**: Type-safe ORM with pgvector support

### Frontend Dependencies (Client UI)

```json
{
	"dependencies": {
		"eventsource-polyfill": "^0.9.6",
		"readable-stream": "^4.5.2",
		"stream-browserify": "^3.0.0",
		"web-streams-polyfill": "^4.0.0",
		"abort-controller": "^3.0.0"
	},
	"devDependencies": {
		"@types/eventsource": "^1.1.15",
		"@types/readable-stream": "^4.0.15"
	}
}
```

**Key Packages:**

- **eventsource-polyfill**: EventSource support for older browsers
- **readable-stream**: Node.js streams in browser for advanced stream handling
- **stream-browserify**: Browser-compatible stream utilities
- **web-streams-polyfill**: Web Streams API polyfill for broader compatibility
- **abort-controller**: AbortController polyfill for request cancellation

### Stream Handling Utilities

```typescript
// apps/client-ui/src/utils/stream-helpers.ts
import { ReadableStream } from 'readable-stream'

/**
 * Convert EventSource to ReadableStream for advanced processing
 */
export function eventSourceToStream(
	eventSource: EventSource,
): ReadableStream<string> {
	return new ReadableStream({
		start(controller) {
			eventSource.onmessage = (event) => {
				controller.enqueue(event.data)
			}

			eventSource.onerror = () => {
				controller.error(new Error('EventSource error'))
			}

			eventSource.addEventListener('close', () => {
				controller.close()
			})
		},

		cancel() {
			eventSource.close()
		},
	})
}

/**
 * Transform stream chunks with backpressure handling
 */
export function createTransformStream<T, U>(
	transform: (chunk: T) => U,
): TransformStream<T, U> {
	return new TransformStream({
		transform(chunk, controller) {
			controller.enqueue(transform(chunk))
		},
	})
}
```

## Dependencies and Risks

### External Dependencies

- **OpenAI API** availability and rate limits
- **@ai-sdk** package stability and updates
- **Database Performance** under concurrent load
- **pgvector Extension** compatibility and performance
- **Browser EventSource** support and limitations

### Technical Risks

- **Streaming Complexity** in browser environments
- **Connection Management** for long-running streams
- **Token Usage Costs** with OpenAI API
- **Rate Limiting** impact on user experience
- **Vector Search Performance** at scale
- **Memory Usage** with large embedding datasets

### Mitigation Strategies

- **Fallback Mechanisms** for AI service failures
- **Cost Monitoring** and usage alerts for OpenAI API
- **Progressive Enhancement** for streaming features
- **Connection Pooling** for database operations
- **Embedding Batch Processing** to reduce API calls
- **Vector Index Optimization** with HNSW parameters
- **Comprehensive Testing** before production deployment
- **Memory Management** for large chat histories

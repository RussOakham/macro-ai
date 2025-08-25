import { createOpenAI } from '@ai-sdk/openai'
import {
	embed,
	EmbeddingModel,
	generateText,
	LanguageModelV1,
	streamText,
} from 'ai'

import { assertConfig } from '../../config/simple-config.js'
import { tryCatch, tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { AppError, type Result, ValidationError } from '../../utils/errors.ts'

// Interface for chat messages to avoid repetition
interface ChatMessage {
	role: 'user' | 'assistant' | 'system'
	content: string
}

/**
 * AI Service for OpenAI integration with streaming support and embeddings
 * Provides Go-style error handling for all AI operations
 */
class AIService {
	private readonly openai: ReturnType<typeof createOpenAI>
	private readonly chatModel: LanguageModelV1
	private readonly embeddingModel: EmbeddingModel<string>

	constructor() {
		const config = assertConfig(false)
		this.openai = createOpenAI({
			apiKey: config.openaiApiKey,
		})
		this.chatModel = this.openai('gpt-3.5-turbo')
		this.embeddingModel = this.openai.embedding('text-embedding-3-small')
	}

	/**
	 * Generate streaming response from OpenAI with Go-style error handling
	 * @param messages - Array of chat messages with role and content
	 * @returns Result tuple with AsyncIterable<string> for streaming or error
	 */
	public generateStreamingResponse(
		messages: ChatMessage[],
	): Result<AsyncIterable<string>> {
		const [streamResult, error] = tryCatchSync(() => {
			return streamText({
				model: this.chatModel,
				messages,
				maxTokens: 1000,
				temperature: 0.7,
			})
		}, 'aiService - generateStreamingResponse')

		if (error) {
			return [null, error]
		}

		return [streamResult.textStream, null]
	}

	/**
	 * Generate non-streaming response from OpenAI with Go-style error handling
	 * @param messages - Array of chat messages with role and content
	 * @returns Result tuple with string response or error
	 */
	public async generateResponse(
		messages: ChatMessage[],
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
	 * @param text - Text content to generate embeddings for
	 * @returns Result tuple with number array (embedding vector) or error
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
	 * @param texts - Array of text strings to generate embeddings for
	 * @returns Result tuple with array of embedding vectors or error
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

	/**
	 * Generate embeddings for multiple texts in parallel batch processing
	 * More efficient than sequential processing for large batches
	 * @param texts - Array of text strings to generate embeddings for
	 * @param batchSize - Number of embeddings to process in parallel (default: 5)
	 * @returns Result tuple with array of embedding vectors or error
	 */
	public async generateEmbeddingsBatch(
		texts: string[],
		batchSize = 5,
	): Promise<Result<number[][]>> {
		const embeddings: number[][] = []

		// Process texts in batches to avoid rate limiting
		for (let i = 0; i < texts.length; i += batchSize) {
			const batch = texts.slice(i, i + batchSize)

			// Execute batch processing with proper error handling
			let batchResults: Result<number[]>[]
			try {
				// Process all embeddings in parallel
				batchResults = await Promise.all(
					batch.map((text) => this.generateEmbedding(text)),
				)
			} catch (batchError) {
				// Handle system-level failures (out of memory, etc.)
				const appError = AppError.from(
					batchError,
					'aiService - generateEmbeddingsBatch',
				)
				return [null, appError]
			}

			// Check each individual Result tuple for errors
			for (const [embedding, error] of batchResults) {
				if (error) {
					return [null, error]
				}
				embeddings.push(embedding)
			}
		}

		return [embeddings, null]
	}

	/**
	 * Validate message format for AI processing
	 * @param messages - Messages to validate
	 * @returns Result tuple with validated messages or error
	 */
	public validateMessages(
		messages: { role: string; content: string }[],
	): Result<ChatMessage[]> {
		type ValidRoles = ChatMessage['role']

		const validRoles = ['user', 'assistant', 'system'] as const

		for (const message of messages) {
			if (!validRoles.includes(message.role as ValidRoles)) {
				return [
					null,
					new ValidationError(
						`Invalid message role: ${message.role}`,
						undefined,
						'aiService',
					),
				]
			}

			if (!message.content || message.content.trim().length === 0) {
				return [
					null,
					new ValidationError(
						'Message content cannot be empty',
						undefined,
						'aiService',
					),
				]
			}
		}

		return [messages as ChatMessage[], null]
	}

	/**
	 * Get model configuration for different use cases
	 * @param useCase - The use case for model selection
	 * @returns Model configuration object
	 */
	public getModelConfig(useCase: 'chat' | 'embedding' = 'chat'): {
		model: LanguageModelV1 | EmbeddingModel<string>
		maxTokens?: number
		temperature?: number
		dimensions?: number
	} {
		switch (useCase) {
			case 'chat':
				return {
					model: this.chatModel,
					maxTokens: 1000,
					temperature: 0.7,
				}
			case 'embedding':
				return {
					model: this.embeddingModel,
					dimensions: 1536,
				}
		}
	}
}

// Export singleton instance
const aiService = new AIService()

export { AIService, aiService }

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../../../utils/errors.ts'
import { MockDataFactory } from '../../../utils/test-helpers/advanced-mocking.ts'
import { mockConfig } from '../../../utils/test-helpers/config.mock.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'

// Mock external dependencies BEFORE any imports
vi.mock('../../../utils/load-config.ts', () => mockConfig.createModule())
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Mock @ai-sdk packages with proper setup
const mockCreateOpenAI = vi.fn()
const mockGenerateText = vi.fn()
const mockStreamText = vi.fn()
const mockEmbed = vi.fn()

vi.mock('@ai-sdk/openai', () => ({
	createOpenAI: mockCreateOpenAI,
}))

vi.mock('ai', () => ({
	generateText: mockGenerateText,
	streamText: mockStreamText,
	embed: mockEmbed,
}))

// Import after mocking
import { tryCatch } from '../../../utils/error-handling/try-catch.ts'
// Type imports for proper typing
import type { AIService as AIServiceType } from '../ai.service.ts'

// Type for the OpenAI provider mock to match the actual interface
interface MockOpenAIProvider {
	(model: string): ReturnType<typeof vi.fn>
	embedding: (model: string) => ReturnType<typeof vi.fn>
}

describe('AIService', () => {
	let AIService: typeof AIServiceType
	let aiService: AIServiceType
	let mockOpenAIInstance: MockOpenAIProvider
	let mockChatModel: ReturnType<typeof vi.fn>
	let mockEmbeddingModel: ReturnType<typeof vi.fn>

	// Mock data using enhanced factory
	const mockMessages = MockDataFactory.aiMessages([
		{ role: 'user', content: 'Hello, AI!' },
		{ role: 'assistant', content: 'Hello, human!' },
	])

	const mockEmbedding = MockDataFactory.embedding()
	const mockResponseText = 'This is a mock AI response'

	beforeEach(async () => {
		vi.resetModules() // Clear module cache to ensure mocks are used

		// Re-apply the config mock after module reset
		vi.doMock('../../../utils/load-config.ts', () => mockConfig.createModule())

		// Setup config mock (includes vi.clearAllMocks())
		mockConfig.setup()

		// Setup mock OpenAI instance
		mockChatModel = vi.fn()
		mockEmbeddingModel = vi.fn()

		// Create a proper mock that satisfies the MockOpenAIProvider interface
		const mockFunction = vi.fn().mockReturnValue(mockChatModel)
		const mockEmbeddingFunction = vi.fn().mockReturnValue(mockEmbeddingModel)

		mockOpenAIInstance = Object.assign(mockFunction, {
			embedding: mockEmbeddingFunction,
		}) as MockOpenAIProvider

		mockCreateOpenAI.mockReturnValue(mockOpenAIInstance)

		// Import AIService after mocks are set up and modules are reset
		const aiServiceModule = await import('../ai.service.ts')
		// oxlint-disable-next-line prefer-destructuring
		AIService = aiServiceModule.AIService

		// Create fresh service instance
		aiService = new AIService()
	})

	describe('constructor', () => {
		it('should initialize OpenAI client with correct configuration', async () => {
			// Wait for initialization to complete by calling a public method that triggers initialization
			await aiService.getModelConfig()

			// Assert - Should create OpenAI client with a valid API key
			// Note: Due to class property initialization timing, the actual env value is used
			// In CI builds, this may be 'build-time-not-required' since OpenAI isn't needed during build
			expect(mockCreateOpenAI).toHaveBeenCalledWith({
				apiKey: expect.stringMatching(
					/^(sk-|build-time-not-required)/,
				) as string,
			})
			expect(mockOpenAIInstance).toHaveBeenCalledWith('gpt-3.5-turbo')
			expect(mockOpenAIInstance.embedding).toHaveBeenCalledWith(
				'text-embedding-3-small',
			)

			// Verify the service was created successfully
			expect(aiService).toBeDefined()
			expect(typeof aiService.generateResponse).toBe('function')
			expect(typeof aiService.generateEmbedding).toBe('function')
		})
	})

	describe('generateResponse', () => {
		it('should generate response successfully', async () => {
			// Arrange
			const mockResult = { text: mockResponseText }
			mockGenerateText.mockResolvedValue(mockResult) // Make generateText return a Promise
			vi.mocked(tryCatch).mockResolvedValue([mockResult, null])

			// Act
			const [result, error] = await aiService.generateResponse(mockMessages)

			// Assert
			expect(tryCatch).toHaveBeenCalledWith(
				expect.any(Promise),
				'aiService - generateResponse',
			)
			expect(mockGenerateText).toHaveBeenCalledWith({
				model: mockChatModel,
				messages: mockMessages,
				maxTokens: 1000,
				temperature: 0.7,
			})
			expect(result).toBe(mockResponseText)
			expect(error).toBeNull()
		})

		it('should return error when generateText fails', async () => {
			// Arrange
			const mockError = AppError.from(new Error('OpenAI API error'), 'test')
			vi.mocked(tryCatch).mockResolvedValue([null, mockError])

			// Act
			const [result, error] = await aiService.generateResponse(mockMessages)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(mockError)
		})

		it('should handle empty messages array', async () => {
			// Arrange
			const emptyMessages: {
				role: 'assistant' | 'system' | 'user'
				content: string
			}[] = []
			const mockResult = { text: 'Empty response' }
			vi.mocked(tryCatch).mockResolvedValue([mockResult, null])

			// Act
			const [result, error] = await aiService.generateResponse(emptyMessages)

			// Assert
			expect(mockGenerateText).toHaveBeenCalledWith({
				model: mockChatModel,
				messages: emptyMessages,
				maxTokens: 1000,
				temperature: 0.7,
			})
			expect(result).toBe('Empty response')
			expect(error).toBeNull()
		})
	})

	describe('generateStreamingResponse', () => {
		it('should generate streaming response successfully', async () => {
			// Arrange
			const mockTextStream = (function* () {
				yield 'Hello'
				yield ' '
				yield 'world'
			})()
			const mockStreamResult = { textStream: mockTextStream }
			vi.mocked(tryCatch).mockImplementation(async (fn) => {
				const result = await (fn as () => Promise<unknown>)()
				return [result, null]
			})
			mockStreamText.mockReturnValue(mockStreamResult)

			// Act
			const [result, error] =
				await aiService.generateStreamingResponse(mockMessages)

			// Assert
			expect(tryCatch).toHaveBeenCalledWith(
				expect.any(Function),
				'aiService - generateStreamingResponse',
			)
			expect(result).toBe(mockTextStream)
			expect(error).toBeNull()
		})

		it('should return error when streamText fails', async () => {
			// Arrange
			const mockError = AppError.from(new Error('Streaming error'), 'test')
			vi.mocked(tryCatch).mockResolvedValue([null, mockError])

			// Act
			const [result, error] =
				await aiService.generateStreamingResponse(mockMessages)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(mockError)
		})

		it('should call streamText with correct parameters', async () => {
			// Arrange
			const mockTextStream = (function* () {
				yield 'test'
			})()
			const mockStreamResult = { textStream: mockTextStream }
			mockStreamText.mockReturnValue(mockStreamResult) // Make streamText return object with textStream

			vi.mocked(tryCatch).mockImplementation(async (fn) => {
				const result = await (fn as () => Promise<unknown>)()
				return [result, null]
			})

			// Act
			await aiService.generateStreamingResponse(mockMessages)

			// Assert
			expect(mockStreamText).toHaveBeenCalledWith({
				model: mockChatModel,
				messages: mockMessages,
				maxTokens: 1000,
				temperature: 0.7,
			})
		})
	})

	describe('generateEmbedding', () => {
		it('should generate embedding successfully', async () => {
			// Arrange
			const mockText = 'Test text for embedding'
			const mockResult = { embedding: mockEmbedding }
			mockEmbed.mockResolvedValue(mockResult) // Make embed return a Promise
			vi.mocked(tryCatch).mockResolvedValue([mockResult, null])

			// Act
			const [result, error] = await aiService.generateEmbedding(mockText)

			// Assert
			expect(tryCatch).toHaveBeenCalledWith(
				expect.any(Promise),
				'aiService - generateEmbedding',
			)
			expect(mockEmbed).toHaveBeenCalledWith({
				model: mockEmbeddingModel,
				value: mockText,
			})
			expect(result).toEqual(mockEmbedding)
			expect(error).toBeNull()
		})

		it('should return error when embed fails', async () => {
			// Arrange
			const mockText = 'Test text'
			const mockError = AppError.from(new Error('Embedding API error'), 'test')
			vi.mocked(tryCatch).mockResolvedValue([null, mockError])

			// Act
			const [result, error] = await aiService.generateEmbedding(mockText)

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(mockError)
		})

		it('should handle empty text', async () => {
			// Arrange
			const emptyText = ''
			const mockResult = { embedding: [] }
			vi.mocked(tryCatch).mockResolvedValue([mockResult, null])

			// Act
			const [result, error] = await aiService.generateEmbedding(emptyText)

			// Assert
			expect(mockEmbed).toHaveBeenCalledWith({
				model: mockEmbeddingModel,
				value: emptyText,
			})
			expect(result).toEqual([])
			expect(error).toBeNull()
		})
	})

	describe('generateEmbeddings', () => {
		it('should generate embeddings for multiple texts successfully', async () => {
			// Arrange
			const mockTexts = ['Text 1', 'Text 2', 'Text 3']
			const mockEmbeddings = MockDataFactory.embeddings(3)

			// Mock generateEmbedding to return different embeddings for each call
			const generateEmbeddingSpy = vi
				.spyOn(aiService, 'generateEmbedding')
				.mockResolvedValueOnce([mockEmbeddings[0] ?? [], null])
				.mockResolvedValueOnce([mockEmbeddings[1] ?? [], null])
				.mockResolvedValueOnce([mockEmbeddings[2] ?? [], null])

			// Act
			const [result, error] = await aiService.generateEmbeddings(mockTexts)

			// Assert
			expect(generateEmbeddingSpy).toHaveBeenCalledTimes(3)
			expect(generateEmbeddingSpy).toHaveBeenNthCalledWith(1, 'Text 1')
			expect(generateEmbeddingSpy).toHaveBeenNthCalledWith(2, 'Text 2')
			expect(generateEmbeddingSpy).toHaveBeenNthCalledWith(3, 'Text 3')
			expect(result).toEqual(mockEmbeddings)
			expect(error).toBeNull()
		})

		it('should return error when any embedding fails', async () => {
			// Arrange
			const mockTexts = ['Text 1', 'Text 2']
			const mockError = AppError.from(new Error('Embedding failed'), 'test')

			const generateEmbeddingSpy = vi
				.spyOn(aiService, 'generateEmbedding')
				.mockResolvedValueOnce([[0.1, 0.2], null])
				.mockResolvedValueOnce([null, mockError])

			// Act
			const [result, error] = await aiService.generateEmbeddings(mockTexts)

			// Assert
			expect(generateEmbeddingSpy).toHaveBeenCalledTimes(2)
			expect(result).toBeNull()
			expect(error).toBe(mockError)
		})

		it('should handle empty texts array', async () => {
			// Arrange
			const emptyTexts: string[] = []

			// Act
			const [result, error] = await aiService.generateEmbeddings(emptyTexts)

			// Assert
			expect(result).toEqual([])
			expect(error).toBeNull()
		})

		it('should handle single text in array', async () => {
			// Arrange
			const singleText = ['Single text']
			const mockEmbedding = [0.1, 0.2, 0.3]

			const generateEmbeddingSpy = vi
				.spyOn(aiService, 'generateEmbedding')
				.mockResolvedValueOnce([mockEmbedding, null])

			// Act
			const [result, error] = await aiService.generateEmbeddings(singleText)

			// Assert
			expect(generateEmbeddingSpy).toHaveBeenCalledTimes(1)
			expect(generateEmbeddingSpy).toHaveBeenCalledWith('Single text')
			expect(result).toEqual([mockEmbedding])
			expect(error).toBeNull()
		})
	})

	describe('generateEmbeddingsBatch', () => {
		it('should generate embeddings in batches successfully', async () => {
			// Arrange
			const mockTexts = [
				'Text 1',
				'Text 2',
				'Text 3',
				'Text 4',
				'Text 5',
				'Text 6',
			]
			const mockEmbeddings = [
				[0.1, 0.2],
				[0.3, 0.4],
				[0.5, 0.6],
				[0.7, 0.8],
				[0.9, 1],
				[1.1, 1.2],
			]

			// Mock generateEmbedding for each text
			const generateEmbeddingSpy = vi.spyOn(aiService, 'generateEmbedding')
			mockEmbeddings.forEach((embedding) => {
				generateEmbeddingSpy.mockResolvedValueOnce([embedding, null])
			})

			// Act
			const [result, error] = await aiService.generateEmbeddingsBatch(
				mockTexts,
				5,
			)

			// Assert - Should process in two batches (5 + 1)
			expect(generateEmbeddingSpy).toHaveBeenCalledTimes(6) // All 6 texts
			expect(result).toEqual(mockEmbeddings)
			expect(error).toBeNull()
		})

		it('should return error when batch processing fails', async () => {
			// Arrange
			const mockTexts = ['Text 1', 'Text 2']
			const mockError = AppError.from(
				new Error('Batch processing failed'),
				'test',
			)

			// Mock generateEmbedding to throw an error, which will cause Promise.all to fail
			vi.spyOn(aiService, 'generateEmbedding').mockRejectedValue(mockError)

			// Act
			const [result, error] = await aiService.generateEmbeddingsBatch(mockTexts)

			// Assert - This should trigger the batchError path (lines 154-155)
			expect(result).toBeNull()
			expect(error).toBeTruthy()
		})

		it('should return error when individual embedding in batch fails', async () => {
			// Arrange
			const mockTexts = ['Text 1', 'Text 2']
			const mockError = AppError.from(
				new Error('Individual embedding failed'),
				'test',
			)

			// Mock generateEmbedding to return mixed results (success, then failure)
			vi.spyOn(aiService, 'generateEmbedding')
				.mockResolvedValueOnce([[0.1, 0.2], null]) // First embedding succeeds
				.mockResolvedValueOnce([null, mockError]) // Second embedding fails

			// Act
			const [result, error] = await aiService.generateEmbeddingsBatch(mockTexts)

			// Assert - This should trigger the individual error check (lines 160-161)
			expect(result).toBeNull()
			expect(error).toBe(mockError)
		})

		it('should use default batch size when not specified', async () => {
			// Arrange
			const mockTexts = ['Text 1', 'Text 2', 'Text 3']
			const mockEmbedding1: number[] = [0.1, 0.2]
			const mockEmbedding2: number[] = [0.3, 0.4]
			const mockEmbedding3: number[] = [0.5, 0.6]
			const mockEmbeddings: number[][] = [
				mockEmbedding1,
				mockEmbedding2,
				mockEmbedding3,
			]

			// Mock generateEmbedding to return successful results for all texts
			vi.spyOn(aiService, 'generateEmbedding')
				.mockResolvedValueOnce([mockEmbedding1, null])
				.mockResolvedValueOnce([mockEmbedding2, null])
				.mockResolvedValueOnce([mockEmbedding3, null])

			// Act - Don't specify batch size to test default
			const [result, error] = await aiService.generateEmbeddingsBatch(mockTexts)

			// Assert - Should process all texts successfully
			expect(result).toEqual(mockEmbeddings)
			expect(error).toBeNull()
		})

		it('should handle empty texts array', async () => {
			// Arrange
			const emptyTexts: string[] = []

			// Act
			const [result, error] =
				await aiService.generateEmbeddingsBatch(emptyTexts)

			// Assert
			expect(result).toEqual([])
			expect(error).toBeNull()
			expect(tryCatch).not.toHaveBeenCalled()
		})
	})

	describe('validateMessages', () => {
		describe.each([
			['user', 'Hello', 'valid user message'],
			['assistant', 'Hi there!', 'valid assistant message'],
			['system', 'You are a helpful assistant', 'valid system message'],
		])('Message validation: %s', (role, content, description) => {
			it(`should validate ${description}`, () => {
				// Arrange
				const validMessages = [{ role, content }]

				// Act
				const [result, error] = aiService.validateMessages(validMessages)

				// Assert
				expect(result).toEqual(validMessages)
				expect(error).toBeNull()
			})
		})

		describe.each([
			['invalid_role', 'Invalid message role: invalid_role'],
			['bot', 'Invalid message role: bot'],
			['admin', 'Invalid message role: admin'],
		])('Invalid role validation: %s', (invalidRole, expectedMessage) => {
			it(`should return error for invalid role: ${invalidRole}`, () => {
				// Arrange
				const invalidMessages = [
					{ role: 'user', content: 'Hello' },
					{ role: invalidRole, content: 'Invalid message' },
				]

				// Act
				const [result, error] = aiService.validateMessages(invalidMessages)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeTruthy()
				expect(error?.name).toBe('ValidationError')
				expect(error?.message).toBe(expectedMessage)
				expect(error?.service).toBe('aiService')
			})
		})

		it('should return error for empty content', () => {
			// Arrange
			const messagesWithEmptyContent = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: '' },
			]

			// Act
			const [result, error] = aiService.validateMessages(
				messagesWithEmptyContent,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeTruthy()
			expect(error?.name).toBe('ValidationError')
			expect(error?.message).toBe('Message content cannot be empty')
			expect(error?.service).toBe('aiService')
		})

		it('should return error for whitespace-only content', () => {
			// Arrange
			const messagesWithWhitespaceContent = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: '   \t\n  ' },
			]

			// Act
			const [result, error] = aiService.validateMessages(
				messagesWithWhitespaceContent,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeTruthy()
			expect(error?.name).toBe('ValidationError')
			expect(error?.message).toBe('Message content cannot be empty')
			expect(error?.service).toBe('aiService')
		})

		it('should handle empty messages array', () => {
			// Arrange
			const emptyMessages: { role: string; content: string }[] = []

			// Act
			const [result, error] = aiService.validateMessages(emptyMessages)

			// Assert
			expect(result).toEqual([])
			expect(error).toBeNull()
		})

		it('should validate single message', () => {
			// Arrange
			const singleMessage = [{ role: 'user', content: 'Single message' }]

			// Act
			const [result, error] = aiService.validateMessages(singleMessage)

			// Assert
			expect(result).toEqual(singleMessage)
			expect(error).toBeNull()
		})

		it('should handle mixed valid and invalid roles in sequence', () => {
			// Arrange
			const mixedMessages = [
				{ role: 'user', content: 'Valid message' },
				{ role: 'bot', content: 'Invalid role message' }, // Invalid role
			]

			// Act
			const [result, error] = aiService.validateMessages(mixedMessages)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeTruthy()
			expect(error?.name).toBe('ValidationError')
			expect(error?.message).toBe('Invalid message role: bot')
		})

		it('should validate messages with special characters in content', () => {
			// Arrange
			const messagesWithSpecialChars = [
				{ role: 'user', content: 'Hello! @#$%^&*()_+{}|:"<>?[]\\;\',./' },
				{
					role: 'assistant',
					content: 'Response with emojis 🚀 and ñ characters',
				},
			]

			// Act
			const [result, error] = aiService.validateMessages(
				messagesWithSpecialChars,
			)

			// Assert
			expect(result).toEqual(messagesWithSpecialChars)
			expect(error).toBeNull()
		})
	})

	describe('getModelConfig', () => {
		it('should return chat model configuration by default', async () => {
			// Act
			const config = await aiService.getModelConfig()

			// Assert
			expect(config).toEqual({
				model: mockChatModel,
				maxTokens: 1000,
				temperature: 0.7,
			})
		})

		it('should return chat model configuration when explicitly requested', async () => {
			// Act
			const config = await aiService.getModelConfig('chat')

			// Assert
			expect(config).toEqual({
				model: mockChatModel,
				maxTokens: 1000,
				temperature: 0.7,
			})
		})

		it('should return embedding model configuration when requested', async () => {
			// Act
			const config = await aiService.getModelConfig('embedding')

			// Assert
			expect(config).toEqual({
				model: mockEmbeddingModel,
				dimensions: 1536,
			})
		})

		it('should handle different use cases correctly', async () => {
			// Act & Assert
			const chatConfig = await aiService.getModelConfig('chat')
			const embeddingConfig = await aiService.getModelConfig('embedding')

			// Chat config should have maxTokens and temperature
			expect(chatConfig).toHaveProperty('maxTokens', 1000)
			expect(chatConfig).toHaveProperty('temperature', 0.7)
			expect(chatConfig).not.toHaveProperty('dimensions')

			// Embedding config should have dimensions
			expect(embeddingConfig).toHaveProperty('dimensions', 1536)
			expect(embeddingConfig).not.toHaveProperty('maxTokens')
			expect(embeddingConfig).not.toHaveProperty('temperature')
		})

		it('should return consistent model references', async () => {
			// Act
			const config1 = await aiService.getModelConfig('chat')
			const config2 = await aiService.getModelConfig('chat')

			// Assert - Should return the same model instance
			expect(config1.model).toBe(config2.model)
			expect(config1.model).toBe(mockChatModel)
		})

		it('should return different models for different use cases', async () => {
			// Act
			const chatConfig = await aiService.getModelConfig('chat')
			const embeddingConfig = await aiService.getModelConfig('embedding')

			// Assert - Should return different model instances
			expect(chatConfig.model).toBe(mockChatModel)
			expect(embeddingConfig.model).toBe(mockEmbeddingModel)
			expect(chatConfig.model).not.toBe(embeddingConfig.model)
		})
	})

	describe('Edge Cases and Error Scenarios', () => {
		it('should handle concurrent generateResponse calls', async () => {
			// Arrange
			const mockResult1 = { text: 'Response 1' }
			const mockResult2 = { text: 'Response 2' }
			vi.mocked(tryCatch)
				.mockResolvedValueOnce([mockResult1, null])
				.mockResolvedValueOnce([mockResult2, null])

			// Act
			const [result1Promise, result2Promise] = await Promise.all([
				aiService.generateResponse([{ role: 'user', content: 'Message 1' }]),
				aiService.generateResponse([{ role: 'user', content: 'Message 2' }]),
			])

			// Assert
			expect(result1Promise[0]).toBe('Response 1')
			expect(result2Promise[0]).toBe('Response 2')
			expect(tryCatch).toHaveBeenCalledTimes(2)
		})

		it('should handle concurrent generateEmbedding calls', async () => {
			// Arrange
			const mockEmbedding1 = [0.1, 0.2, 0.3]
			const mockEmbedding2 = [0.4, 0.5, 0.6]
			vi.mocked(tryCatch)
				.mockResolvedValueOnce([{ embedding: mockEmbedding1 }, null])
				.mockResolvedValueOnce([{ embedding: mockEmbedding2 }, null])

			// Act
			const [result1Promise, result2Promise] = await Promise.all([
				aiService.generateEmbedding('Text 1'),
				aiService.generateEmbedding('Text 2'),
			])

			// Assert
			expect(result1Promise[0]).toEqual(mockEmbedding1)
			expect(result2Promise[0]).toEqual(mockEmbedding2)
			expect(tryCatch).toHaveBeenCalledTimes(2)
		})

		it('should handle very long message content in validation', () => {
			// Arrange
			const longContent = 'A'.repeat(10000) // Very long content
			const messagesWithLongContent = [{ role: 'user', content: longContent }]

			// Act
			const [result, error] = aiService.validateMessages(
				messagesWithLongContent,
			)

			// Assert
			expect(result).toEqual(messagesWithLongContent)
			expect(error).toBeNull()
		})

		it('should handle null or undefined in message validation gracefully', () => {
			// Arrange
			const messagesWithNullContent = [
				{ role: 'user' as const, content: null as unknown as string },
			]

			// Act
			const [result, error] = aiService.validateMessages(
				messagesWithNullContent,
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeTruthy()
			expect(error?.name).toBe('ValidationError')
			expect(error?.message).toBe('Message content cannot be empty')
		})
	})
})

/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Tests for Lambda Configuration Service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadConfig } from '../../utils/load-config.js'
import { mockParameterStoreService } from '../../utils/test-helpers/parameter-store.mock.js'
import { LambdaConfigService } from '../lambda-config.service.js'
import type { ParameterStoreService } from '../parameter-store.service.js'

// Type for validated parameters from Parameter Store (matching the service's internal type)
interface ValidatedParameterStoreData {
	'macro-ai-database-url': string
	'macro-ai-redis-url': string
	'macro-ai-openai-key': string
	'macro-ai-cognito-user-pool-id': string
	'macro-ai-cognito-user-pool-client-id': string
}

// Mock Parameter Store service using the new aws-sdk-client-mock pattern
vi.mock('../parameter-store.service.js', () =>
	mockParameterStoreService.createModule(),
)

// Mock the load-config utility
vi.mock('../../utils/load-config.js', () => ({
	loadConfig: vi.fn(),
}))

// Helper function to create valid mock parameters
const createValidMockParameters = (): ValidatedParameterStoreData => ({
	'macro-ai-database-url': 'postgresql://user:pass@localhost:5432/testdb',
	'macro-ai-redis-url': 'redis://localhost:6379',
	'macro-ai-openai-key': 'sk-test-openai-key-1234567890',
	'macro-ai-cognito-user-pool-id': 'us-east-1_ABC123DEF',
	'macro-ai-cognito-user-pool-client-id': 'abcdefghijklmnopqrstuvwxyz',
})

describe('LambdaConfigService', () => {
	let service: LambdaConfigService
	let mockParameterStore: ReturnType<typeof vi.mocked<ParameterStoreService>>
	let mockLoadConfig: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		vi.clearAllMocks()

		// Get the mocked parameterStore from the module mock
		const { parameterStore } = await import('../parameter-store.service.js')
		mockParameterStore = vi.mocked(parameterStore)

		// Get the mocked loadConfig
		mockLoadConfig = vi.mocked(loadConfig)

		// Set up default successful loadConfig mock
		mockLoadConfig.mockReturnValue([
			{
				NODE_ENV: 'test',
				AWS_REGION: 'us-east-1',
				AWS_LAMBDA_FUNCTION_NAME: 'test-lambda',
				LOG_LEVEL: 'info',
				PARAMETER_STORE_CACHE_TTL: 300,
			},
			null,
		])

		// Reset singleton instance
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
		;(LambdaConfigService as any).instance = null
		service = LambdaConfigService.getInstance()

		// Set up environment variables
		process.env.NODE_ENV = 'test'
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
	})

	afterEach(() => {
		service.reset()
		delete process.env.NODE_ENV
		delete process.env.AWS_REGION
		delete process.env.AWS_LAMBDA_FUNCTION_NAME
	})

	describe('getInstance', () => {
		it('should return singleton instance', () => {
			const instance1 = LambdaConfigService.getInstance()
			const instance2 = LambdaConfigService.getInstance()

			expect(instance1).toBe(instance2)
		})
	})

	describe('initialize', () => {
		it('should initialize configuration successfully', async () => {
			// Arrange
			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)

			// Act
			const config = await service.initialize(true)

			// Assert
			expect(config).toEqual({
				relationalDatabaseUrl: mockParameters['macro-ai-database-url'],
				nonRelationalDatabaseUrl: mockParameters['macro-ai-redis-url'],
				openaiApiKey: mockParameters['macro-ai-openai-key'],
				awsCognitoUserPoolId: mockParameters['macro-ai-cognito-user-pool-id'],
				awsCognitoUserPoolClientId:
					mockParameters['macro-ai-cognito-user-pool-client-id'],
				nodeEnv: 'test',
				awsRegion: 'us-east-1',
				lambdaFunctionName: 'test-lambda',
				isLambdaEnvironment: true,
				coldStart: true,
			})

			expect(service.isInitialized()).toBe(true)
		})

		it('should handle cold start flag correctly', async () => {
			// Arrange
			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)

			// Act - First initialization (cold start)
			const config1 = await service.initialize(true)
			expect(config1.coldStart).toBe(true)

			// Act - Second initialization (warm start)
			const config2 = await service.initialize(false)
			expect(config2.coldStart).toBe(false)
		})

		it('should return existing config if already initialized', async () => {
			// Arrange
			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)

			// Act - First initialization
			await service.initialize(true)
			expect(
				vi.mocked(mockParameterStore.initializeParameters),
			).toHaveBeenCalledTimes(1)

			// Act - Second initialization should not call Parameter Store again
			const config = await service.initialize(false)
			expect(
				vi.mocked(mockParameterStore.initializeParameters),
			).toHaveBeenCalledTimes(1)
			expect(config.coldStart).toBe(false) // Should update cold start flag
		})

		it('should handle Parameter Store initialization errors', async () => {
			// Arrange
			mockParameterStore.initializeParameters.mockRejectedValue(
				new Error('Parameter Store error'),
			)

			// Act & Assert
			await expect(service.initialize()).rejects.toThrow(
				'Configuration initialization failed: Parameter Store error',
			)

			expect(service.isInitialized()).toBe(false)
		})

		it('should use default environment values', async () => {
			// Arrange - Mock loadConfig to return default values
			mockLoadConfig.mockReturnValue([
				{
					NODE_ENV: 'production',
					AWS_REGION: 'us-east-1',
					AWS_LAMBDA_FUNCTION_NAME: 'macro-ai-lambda',
					LOG_LEVEL: 'info',
					PARAMETER_STORE_CACHE_TTL: 300,
				},
				null,
			])

			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)

			// Act
			const config = await service.initialize()

			// Assert
			expect(config.nodeEnv).toBe('production')
			expect(config.awsRegion).toBe('us-east-1')
			expect(config.lambdaFunctionName).toBe('macro-ai-lambda')
		})
	})

	describe('getConfig', () => {
		it('should return configuration when initialized', async () => {
			// Arrange
			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)
			await service.initialize()

			// Act
			const config = service.getConfig()

			// Assert
			expect(config.relationalDatabaseUrl).toBe(
				mockParameters['macro-ai-database-url'],
			)
		})

		it('should throw error when not initialized', () => {
			expect(() => service.getConfig()).toThrow(
				'Configuration not initialized. Call initialize() first.',
			)
		})
	})

	describe('getExpressConfig', () => {
		it('should return Express-compatible configuration', async () => {
			// Arrange
			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)
			await service.initialize(true)

			// Act
			const expressConfig = service.getExpressConfig()

			// Assert
			expect(expressConfig).toEqual({
				port: 3000,
				relationalDatabaseUrl: mockParameters['macro-ai-database-url'],
				nonRelationalDatabaseUrl: mockParameters['macro-ai-redis-url'],
				openaiApiKey: mockParameters['macro-ai-openai-key'],
				awsCognitoUserPoolId: mockParameters['macro-ai-cognito-user-pool-id'],
				awsCognitoUserPoolClientId:
					mockParameters['macro-ai-cognito-user-pool-client-id'],
				awsRegion: 'us-east-1',
				nodeEnv: 'test',
				isLambdaEnvironment: true,
				coldStart: true,
			})
		})

		it('should throw error when not initialized', () => {
			expect(() => service.getExpressConfig()).toThrow(
				'Configuration not initialized. Call initialize() first.',
			)
		})
	})

	describe('setColdStart', () => {
		it('should update cold start flag', async () => {
			// Arrange
			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)
			await service.initialize(true)

			expect(service.getConfig().coldStart).toBe(true)

			// Act
			service.setColdStart(false)

			// Assert
			expect(service.getConfig().coldStart).toBe(false)
		})

		it('should handle uninitialized state gracefully', () => {
			expect(() => {
				service.setColdStart(false)
			}).not.toThrow()
		})
	})

	describe('reset', () => {
		it('should reset configuration state', async () => {
			// Arrange
			const mockParameters = createValidMockParameters()
			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)
			await service.initialize()

			expect(service.isInitialized()).toBe(true)

			// Act
			service.reset()

			// Assert
			expect(service.isInitialized()).toBe(false)
			expect(() => service.getConfig()).toThrow()
		})
	})

	describe('getConfigSummary', () => {
		it('should return summary when not initialized', () => {
			const summary = service.getConfigSummary()
			expect(summary).toEqual({ status: 'not_initialized' })
		})

		it('should return detailed summary when initialized', async () => {
			const mockParameters = createValidMockParameters()

			mockParameterStore.initializeParameters.mockResolvedValue(mockParameters)
			await service.initialize(true)

			const summary = service.getConfigSummary()

			expect(summary).toEqual({
				status: 'initialized',
				nodeEnv: 'test',
				awsRegion: 'us-east-1',
				lambdaFunctionName: 'test-lambda',
				isLambdaEnvironment: true,
				coldStart: true,
				hasDatabase: true,
				hasRedis: true,
				hasOpenAI: true,
				hasCognito: true,
			})
		})

		it('should handle missing configuration values', async () => {
			const mockParameters = {
				'macro-ai-database-url': '',
				'macro-ai-redis-url': '',
				'macro-ai-openai-key': '',
				'macro-ai-cognito-user-pool-id': '',
				'macro-ai-cognito-user-pool-client-id': '',
			}

			mockParameterStore.initializeParameters.mockResolvedValue(
				mockParameters as ValidatedParameterStoreData,
			)

			// With layered Zod validation, empty parameters should cause initialization to fail
			await expect(service.initialize()).rejects.toThrow(
				'Configuration initialization failed: Business validation failed',
			)

			// Service should not be initialized
			expect(service.isInitialized()).toBe(false)

			// Summary should show not initialized status
			const summary = service.getConfigSummary()
			expect(summary.status).toBe('not_initialized')
		})
	})
})

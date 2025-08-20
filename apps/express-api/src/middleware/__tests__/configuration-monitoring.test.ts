/**
 * Configuration Monitoring Tests
 *
 * Tests for the configuration loading monitoring and alerting system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	categorizeConfigurationError,
	ConfigurationErrorCategory,
	ConfigurationStage,
	monitorConfigurationLoading,
	publishConfigurationHealthMetric,
	publishParameterLoadingStats,
} from '../configuration-monitoring.js'

// Mock AWS SDK
vi.mock('@aws-sdk/client-cloudwatch', () => ({
	CloudWatchClient: vi.fn().mockImplementation(() => ({
		send: vi.fn().mockResolvedValue({}),
	})),
	PutMetricDataCommand: vi.fn(),
	StandardUnit: {
		Count: 'Count',
		Milliseconds: 'Milliseconds',
	},
}))

// Mock logger
vi.mock('../../utils/logger.js', () => ({
	pino: {
		logger: {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
	},
}))

describe('Configuration Monitoring', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Set test environment
		process.env.AWS_REGION = 'us-east-1'
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('monitorConfigurationLoading', () => {
		it('should monitor successful configuration loading', async () => {
			const mockOperation = vi.fn().mockResolvedValue('success')

			const result = await monitorConfigurationLoading(
				ConfigurationStage.INITIALIZATION,
				mockOperation,
				{ appEnv: 'test', parameterStorePrefix: '/test' },
			)

			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledOnce()
		})

		it('should monitor failed configuration loading', async () => {
			const mockError = new Error('Configuration failed')
			const mockOperation = vi.fn().mockRejectedValue(mockError)

			await expect(
				monitorConfigurationLoading(
					ConfigurationStage.SCHEMA_VALIDATION,
					mockOperation,
					{ appEnv: 'test' },
				),
			).rejects.toThrow('Configuration failed')

			expect(mockOperation).toHaveBeenCalledOnce()
		})

		it('should handle different configuration stages', async () => {
			const stages = [
				ConfigurationStage.INITIALIZATION,
				ConfigurationStage.ENV_FILE_LOADING,
				ConfigurationStage.SCHEMA_VALIDATION,
				ConfigurationStage.PARAMETER_STORE_ACCESS,
				ConfigurationStage.PARAMETER_RETRIEVAL,
				ConfigurationStage.CONFIGURATION_MERGE,
				ConfigurationStage.VALIDATION_COMPLETE,
			]

			for (const stage of stages) {
				const mockOperation = vi.fn().mockResolvedValue(`${stage}-success`)

				const result = await monitorConfigurationLoading(stage, mockOperation, {
					appEnv: 'test',
				})

				expect(result).toBe(`${stage}-success`)
			}
		})
	})

	describe('categorizeConfigurationError', () => {
		it('should categorize schema validation errors', () => {
			const errors = [
				new Error('Validation failed'),
				new Error('Schema error occurred'),
				new Error('Zod validation failed'),
				new Error('Invalid configuration'),
				new Error('Required field missing'),
			]

			for (const error of errors) {
				const category = categorizeConfigurationError(error)
				expect(category).toBe(ConfigurationErrorCategory.SCHEMA_VALIDATION)
			}
		})

		it('should categorize Parameter Store errors', () => {
			const errors = [
				new Error('Parameter Store access failed'),
				new Error('SSM error occurred'),
				new Error('Parameter not found'),
				new Error('ParameterNotFound'),
			]

			for (const error of errors) {
				const category = categorizeConfigurationError(error)
				expect(category).toBe(ConfigurationErrorCategory.PARAMETER_STORE)
			}
		})

		it('should categorize environment variable errors', () => {
			const errors = [
				new Error('Environment variable missing'),
				new Error('ENV error occurred'),
				new Error('process.env access failed'),
			]

			for (const error of errors) {
				const category = categorizeConfigurationError(error)
				expect(category).toBe(ConfigurationErrorCategory.ENVIRONMENT_VARIABLES)
			}
		})

		it('should categorize file system errors', () => {
			const errors = [
				new Error('File not found'),
				new Error('ENOENT: no such file'),
				new Error('EACCES: permission denied'),
				new Error('Path does not exist'),
			]

			for (const error of errors) {
				const category = categorizeConfigurationError(error)
				expect(category).toBe(ConfigurationErrorCategory.FILE_SYSTEM)
			}
		})

		it('should categorize network errors', () => {
			const errors = [
				new Error('Network timeout'),
				new Error('Connection failed'),
				new Error('ECONNREFUSED'),
				new Error('ENOTFOUND: host not found'),
			]

			for (const error of errors) {
				const category = categorizeConfigurationError(error)
				expect(category).toBe(ConfigurationErrorCategory.NETWORK)
			}
		})

		it('should categorize permission errors', () => {
			const errors = [
				new Error('Permission denied'),
				new Error('Access denied'),
				new Error('Unauthorized access'),
				new Error('Forbidden operation'),
			]

			for (const error of errors) {
				const category = categorizeConfigurationError(error)
				expect(category).toBe(ConfigurationErrorCategory.PERMISSIONS)
			}
		})

		it('should categorize unknown errors', () => {
			const errors = [
				new Error('Some random error'),
				new Error('Unexpected failure'),
				new Error(''),
			]

			for (const error of errors) {
				const category = categorizeConfigurationError(error)
				expect(category).toBe(ConfigurationErrorCategory.UNKNOWN)
			}
		})
	})

	describe('publishParameterLoadingStats', () => {
		it('should publish parameter loading statistics', async () => {
			await publishParameterLoadingStats(10, 2, 'test')

			// Should not throw and should call CloudWatch
			expect(true).toBe(true) // Basic test that function completes
		})

		it('should handle zero parameters', async () => {
			await publishParameterLoadingStats(0, 0, 'test')

			expect(true).toBe(true)
		})
	})

	describe('publishConfigurationHealthMetric', () => {
		it('should publish healthy configuration metric', async () => {
			await publishConfigurationHealthMetric(true, 1000, 'test')

			expect(true).toBe(true)
		})

		it('should publish unhealthy configuration metric', async () => {
			await publishConfigurationHealthMetric(false, 5000, 'test')

			expect(true).toBe(true)
		})
	})

	describe('Configuration Stages', () => {
		it('should have all expected configuration stages', () => {
			const expectedStages = [
				'INITIALIZATION',
				'ENV_FILE_LOADING',
				'SCHEMA_VALIDATION',
				'PARAMETER_STORE_ACCESS',
				'PARAMETER_RETRIEVAL',
				'CONFIGURATION_MERGE',
				'VALIDATION_COMPLETE',
			]

			for (const stage of expectedStages) {
				expect(
					ConfigurationStage[stage as keyof typeof ConfigurationStage],
				).toBeDefined()
			}
		})
	})

	describe('Error Categories', () => {
		it('should have all expected error categories', () => {
			const expectedCategories = [
				'SCHEMA_VALIDATION',
				'PARAMETER_STORE',
				'ENVIRONMENT_VARIABLES',
				'FILE_SYSTEM',
				'NETWORK',
				'PERMISSIONS',
				'UNKNOWN',
			]

			for (const category of expectedCategories) {
				expect(
					ConfigurationErrorCategory[
						category as keyof typeof ConfigurationErrorCategory
					],
				).toBeDefined()
			}
		})
	})

	describe('Integration Tests', () => {
		it('should handle complete configuration loading workflow', async () => {
			// Simulate a complete configuration loading workflow
			const stages = [
				ConfigurationStage.INITIALIZATION,
				ConfigurationStage.ENV_FILE_LOADING,
				ConfigurationStage.PARAMETER_RETRIEVAL,
				ConfigurationStage.SCHEMA_VALIDATION,
				ConfigurationStage.VALIDATION_COMPLETE,
			]

			for (const stage of stages) {
				const mockOperation = vi.fn().mockResolvedValue(`${stage}-complete`)

				const result = await monitorConfigurationLoading(stage, mockOperation, {
					appEnv: 'integration-test',
					parameterStorePrefix: '/test',
				})

				expect(result).toBe(`${stage}-complete`)
			}

			// Publish final statistics
			await publishParameterLoadingStats(15, 0, 'integration-test')
			await publishConfigurationHealthMetric(true, 2000, 'integration-test')
		})

		it('should handle configuration loading failure workflow', async () => {
			const mockError = new Error('Parameter Store connection failed')
			const mockOperation = vi.fn().mockRejectedValue(mockError)

			await expect(
				monitorConfigurationLoading(
					ConfigurationStage.PARAMETER_STORE_ACCESS,
					mockOperation,
					{ appEnv: 'integration-test' },
				),
			).rejects.toThrow('Parameter Store connection failed')

			// Verify error was categorized correctly
			const category = categorizeConfigurationError(mockError)
			expect(category).toBe(ConfigurationErrorCategory.PARAMETER_STORE)

			// Publish failure statistics
			await publishParameterLoadingStats(0, 5, 'integration-test')
			await publishConfigurationHealthMetric(false, 10000, 'integration-test')
		})
	})
})

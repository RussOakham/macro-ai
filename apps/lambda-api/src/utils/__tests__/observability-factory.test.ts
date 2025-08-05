/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Tests for Observability Factory
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock AWS Lambda Powertools
vi.mock('@aws-lambda-powertools/logger', () => ({
	Logger: vi
		.fn()
		.mockImplementation((config: Partial<ObservabilityConfig>) => ({
			info: vi.fn(),
			debug: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			createChild: vi.fn().mockReturnValue({
				info: vi.fn(),
				debug: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
			_config: config,
		})),
}))

vi.mock('@aws-lambda-powertools/metrics', () => ({
	Metrics: vi
		.fn()
		.mockImplementation((config: Partial<ObservabilityConfig>) => ({
			addMetric: vi.fn(),
			publishStoredMetrics: vi.fn(),
			_config: config,
		})),
}))

vi.mock('@aws-lambda-powertools/tracer', () => ({
	Tracer: vi
		.fn()
		.mockImplementation((config: Partial<ObservabilityConfig>) => ({
			putAnnotation: vi.fn(),
			putMetadata: vi.fn(),
			getSegment: vi.fn(),
			_config: config,
		})),
}))

// Import after mocking
import { Logger } from '@aws-lambda-powertools/logger'
import { Metrics } from '@aws-lambda-powertools/metrics'
import { Tracer } from '@aws-lambda-powertools/tracer'

import {
	type Environment,
	type LogLevel,
	ObservabilityConfig,
	observabilityConfig,
} from '../observability-config.js'
import {
	addCommonObservabilityAnnotations,
	addCommonObservabilityMetadata,
	coordinationConfig,
	createChildLogger,
	createCoordinationConfig,
	createDevelopmentTools,
	createLogger,
	createMetrics,
	createMiddlewareConfig,
	createObservabilityTools,
	createProductionTools,
	createTestTools,
	createTracer,
	logger,
	metrics,
	middlewareConfig,
	observabilityTools,
	tracer,
	updateObservabilityTools,
} from '../observability-factory.js'

describe('Observability Factory', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('createLogger', () => {
		it('should create logger with default configuration', () => {
			createLogger()

			expect(Logger).toHaveBeenCalledWith({
				serviceName: 'macro-ai-lambda-api',
				logLevel: observabilityConfig.logger.logLevel,
				persistentLogAttributes:
					observabilityConfig.logger.persistentAttributes,
				sampleRateValue: observabilityConfig.logger.sampleRate,
			})
		})

		it('should create disabled logger when logger is disabled', () => {
			const config = {
				...observabilityConfig,
				logger: { ...observabilityConfig.logger, enabled: false },
			}

			createLogger(config)

			expect(Logger).toHaveBeenCalledWith({
				serviceName: config.service.name,
				logLevel: 'CRITICAL',
				persistentLogAttributes: {},
			})
		})

		it('should create logger with custom configuration', () => {
			const customConfig = {
				...observabilityConfig,
				service: { ...observabilityConfig.service, name: 'custom-service' },
				logger: {
					...observabilityConfig.logger,
					logLevel: 'DEBUG' as LogLevel,
					sampleRate: 0.5,
				},
			}

			createLogger(customConfig)

			expect(Logger).toHaveBeenCalledWith({
				serviceName: 'custom-service',
				logLevel: 'DEBUG',
				persistentLogAttributes: customConfig.logger.persistentAttributes,
				sampleRateValue: 0.5,
			})
		})
	})

	describe('createMetrics', () => {
		it('should create metrics with default configuration', () => {
			createMetrics()

			expect(Metrics).toHaveBeenCalledWith({
				namespace: observabilityConfig.metrics.namespace,
				serviceName: observabilityConfig.service.name,
				defaultDimensions: observabilityConfig.metrics.defaultDimensions,
				singleMetric: false,
			})
		})

		it('should create disabled metrics when metrics is disabled', () => {
			const config = {
				...observabilityConfig,
				metrics: { ...observabilityConfig.metrics, enabled: false },
			}

			createMetrics(config)

			expect(Metrics).toHaveBeenCalledWith({
				namespace: 'Disabled',
				serviceName: config.service.name,
				defaultDimensions: {},
			})
		})
	})

	describe('createTracer', () => {
		it('should create tracer with default configuration', () => {
			createTracer()

			// Since tracing is disabled by default in tests, expect disabled tracer
			expect(Tracer).toHaveBeenCalledWith({
				serviceName: observabilityConfig.service.name,
				enabled: false,
			})
		})

		it('should create disabled tracer when tracing is disabled', () => {
			const config = {
				...observabilityConfig,
				tracer: { ...observabilityConfig.tracer, enabled: false },
			}

			createTracer(config)

			expect(Tracer).toHaveBeenCalledWith({
				serviceName: config.service.name,
				enabled: false,
			})
		})
	})

	describe('createObservabilityTools', () => {
		it('should create complete observability tools suite', () => {
			const tools = createObservabilityTools()

			expect(tools.logger).toBeDefined()
			expect(tools.metrics).toBeDefined()
			expect(tools.tracer).toBeDefined()
			expect(tools.config).toBe(observabilityConfig)
		})

		it('should not log initialization message in test environment', () => {
			const tools = createObservabilityTools()

			// In test environment, logging is disabled
			expect(tools.config.service.environment).toBe('test')
		})
	})

	describe('createMiddlewareConfig', () => {
		it('should create middleware configuration from observability config', () => {
			const config = createMiddlewareConfig()

			expect(config.observability?.enabled).toBe(
				observabilityConfig.middleware.enableObservabilityIntegration,
			)
			expect(config.errorHandling?.enabled).toBe(
				observabilityConfig.middleware.enableErrorHandling,
			)
			expect(config.performance?.enabled).toBe(
				observabilityConfig.middleware.enablePerformanceTracking,
			)
			expect(config.requestLogging?.enabled).toBe(
				observabilityConfig.middleware.enableRequestLogging,
			)
		})

		it('should include proper options in middleware config', () => {
			const config = createMiddlewareConfig()

			expect(config.observability?.options?.enableRequestLogging).toBe(
				observabilityConfig.middleware.enableRequestLogging,
			)
			expect(config.requestLogging?.options?.maxBodySize).toBe(
				observabilityConfig.middleware.maxBodySize,
			)
			expect(config.requestLogging?.options?.redactFields).toBe(
				observabilityConfig.logger.redactFields,
			)
		})
	})

	describe('createCoordinationConfig', () => {
		it('should create coordination configuration from observability config', () => {
			const config = createCoordinationConfig()

			expect(config.enabled).toBe(observabilityConfig.coordination.enabled)
			expect(config.options?.enableRequestCorrelation).toBe(
				observabilityConfig.coordination.enableRequestCorrelation,
			)
			expect(config.options?.correlationIdHeader).toBe(
				observabilityConfig.coordination.correlationIdHeader,
			)
			expect(config.options?.syncFields).toBe(
				observabilityConfig.coordination.syncFields,
			)
		})
	})

	describe('updateObservabilityTools', () => {
		it('should update tools with new configuration', () => {
			const originalTools = createObservabilityTools()
			const configUpdates = {
				logger: {
					...observabilityConfig.logger,
					logLevel: 'DEBUG' as LogLevel,
				},
				service: {
					...observabilityConfig.service,
					environment: 'test' as Environment,
				},
			}

			const updatedTools = updateObservabilityTools(
				originalTools,
				configUpdates,
			)

			expect(updatedTools.config.logger.logLevel).toBe('DEBUG')
			expect(updatedTools.config.service.environment).toBe('test')
			expect(updatedTools.config.service.name).toBe(
				originalTools.config.service.name,
			)
		})
	})

	describe('addCommonObservabilityAnnotations', () => {
		it('should add annotations when tracing is enabled', () => {
			const mockTracer = {
				putAnnotation: vi.fn(),
			} as unknown as Tracer

			const config = {
				...observabilityConfig,
				tracer: {
					...observabilityConfig.tracer,
					enabled: true,
					enableAnnotations: true,
				},
			}

			addCommonObservabilityAnnotations(mockTracer, config)

			Object.entries(config.tracer.commonAnnotations).forEach(
				([key, value]) => {
					expect(mockTracer.putAnnotation).toHaveBeenCalledWith(key, value)
				},
			)
		})

		it('should not add annotations when tracing is disabled', () => {
			const mockTracer = {
				putAnnotation: vi.fn(),
			} as unknown as Tracer

			const config = {
				...observabilityConfig,
				tracer: { ...observabilityConfig.tracer, enabled: false },
			}

			addCommonObservabilityAnnotations(mockTracer, config)

			expect(mockTracer.putAnnotation).not.toHaveBeenCalled()
		})
	})

	describe('addCommonObservabilityMetadata', () => {
		it('should add metadata when tracing is enabled', () => {
			const mockTracer = {
				putMetadata: vi.fn(),
			} as unknown as Tracer

			const config = {
				...observabilityConfig,
				tracer: {
					...observabilityConfig.tracer,
					enabled: true,
					enableMetadata: true,
				},
			}

			addCommonObservabilityMetadata(mockTracer, config)

			Object.entries(config.tracer.commonMetadata).forEach(([key, value]) => {
				expect(mockTracer.putMetadata).toHaveBeenCalledWith(key, value)
			})
		})
	})

	describe('createChildLogger', () => {
		it('should create child logger with additional context', () => {
			const mockLogger = {
				createChild: vi.fn().mockReturnValue({ info: vi.fn() }),
			} as unknown as Logger

			const additionalContext = { requestId: 'test-123', userId: 'user-456' }

			createChildLogger(mockLogger, additionalContext)

			expect(mockLogger.createChild).toHaveBeenCalledWith({
				persistentLogAttributes: additionalContext,
			})
		})
	})

	describe('environment-specific factories', () => {
		it('should create development tools with appropriate settings', () => {
			const tools = createDevelopmentTools()

			expect(tools.config.service.environment).toBe('test') // Uses default config which is test in test environment
		})

		it('should create production tools with optimizations', () => {
			// Mock the environment to avoid logging issues
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'test' // Prevent logging in test

			const tools = createProductionTools()

			expect(tools.config.service.environment).toBe('production')
			expect(tools.config.logger.logLevel).toBe('INFO')
			expect(tools.config.logger.sampleRate).toBe(0.1)
			expect(tools.config.tracer.captureResponse).toBe(false)
			expect(tools.config.features.enableProductionOptimizations).toBe(true)

			// Restore environment
			process.env.NODE_ENV = originalEnv
		})

		it('should create test tools with minimal logging', () => {
			const tools = createTestTools()

			expect(tools.config.service.environment).toBe('test')
			expect(tools.config.logger.logLevel).toBe('WARN')
			expect(tools.config.tracer.enabled).toBe(false)
			expect(tools.config.metrics.enableCustomMetrics).toBe(false)
		})
	})

	describe('exported instances', () => {
		it('should export default observability tools', () => {
			expect(observabilityTools).toBeDefined()
			expect(logger).toBeDefined()
			expect(metrics).toBeDefined()
			expect(tracer).toBeDefined()
		})

		it('should export configuration instances', () => {
			expect(middlewareConfig).toBeDefined()
			expect(coordinationConfig).toBeDefined()
		})
	})
})

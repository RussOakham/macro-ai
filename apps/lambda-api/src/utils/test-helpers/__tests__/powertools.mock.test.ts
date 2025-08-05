/**
 * Tests for Powertools Test Helpers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createErrorLoggingModuleMock,
	createLoggerModuleMock,
	createMetricsModuleMock,
	createMockLogger,
	createMockMetrics,
	createMockTracer,
	createPowertoolsMockSuite,
	createTracerModuleMock,
	MockLogger,
	powertoolsAssertions,
	powertoolsTestScenarios,
} from '../powertools.mock.js'

describe('Powertools Test Helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('createMockLogger', () => {
		it('should create mock logger with all methods', () => {
			const logger = createMockLogger()

			expect(logger.debug).toBeDefined()
			expect(logger.info).toBeDefined()
			expect(logger.warn).toBeDefined()
			expect(logger.error).toBeDefined()
			expect(logger.createChild).toBeDefined()
		})

		it('should create child logger when createChild is called', () => {
			const logger = createMockLogger()

			const childLogger = logger.createChild() as unknown as MockLogger

			expect(logger.createChild).toHaveBeenCalled()
			expect(childLogger).toBeDefined()
			expect(childLogger.info).toBeDefined()
		})

		it('should track method calls', () => {
			const logger = createMockLogger()

			logger.info('test message', { key: 'value' })
			logger.error('error message')

			expect(logger.info).toHaveBeenCalledWith('test message', { key: 'value' })
			expect(logger.error).toHaveBeenCalledWith('error message')
		})
	})

	describe('createMockMetrics', () => {
		it('should create mock metrics with all methods', () => {
			const metrics = createMockMetrics()

			expect(metrics.addMetric).toBeDefined()
			expect(metrics.publishStoredMetrics).toBeDefined()
			expect(metrics.clearMetrics).toBeDefined()
			expect(metrics.setDefaultDimensions).toBeDefined()
		})

		it('should track metric calls', () => {
			const metrics = createMockMetrics()

			metrics.addMetric('TestMetric', 'Count', 1)
			metrics.setDefaultDimensions({ Service: 'test' })

			expect(metrics.addMetric).toHaveBeenCalledWith('TestMetric', 'Count', 1)
			expect(metrics.setDefaultDimensions).toHaveBeenCalledWith({
				Service: 'test',
			})
		})

		it('should resolve publishStoredMetrics', async () => {
			const metrics = createMockMetrics()

			await expect(metrics.publishStoredMetrics()).resolves.toBeUndefined()
		})
	})

	describe('createMockTracer', () => {
		it('should create mock tracer with all methods', () => {
			const tracer = createMockTracer()

			expect(tracer.putAnnotation).toBeDefined()
			expect(tracer.putMetadata).toBeDefined()
			expect(tracer.getSegment).toBeDefined()
			expect(tracer.addErrorAsMetadata).toBeDefined()
			expect(tracer.captureAWS).toBeDefined()
			expect(tracer.captureHTTPsGlobal).toBeDefined()
		})

		it('should track tracer calls', () => {
			const tracer = createMockTracer()

			tracer.putAnnotation('key', 'value')
			tracer.putMetadata('metadata', { data: 'test' })

			expect(tracer.putAnnotation).toHaveBeenCalledWith('key', 'value')
			expect(tracer.putMetadata).toHaveBeenCalledWith('metadata', {
				data: 'test',
			})
		})

		it('should return segment from getSegment', () => {
			const tracer = createMockTracer()

			const segment = tracer.getSegment() as unknown as Record<string, unknown>

			expect(segment).toBeDefined()
			expect(typeof segment).toBe('object')
		})
	})

	describe('createPowertoolsMockSuite', () => {
		it('should create complete mock suite', () => {
			const suite = createPowertoolsMockSuite()

			expect(suite.logger).toBeDefined()
			expect(suite.metrics).toBeDefined()
			expect(suite.tracer).toBeDefined()
			expect(suite.config).toBeDefined()
		})

		it('should apply configuration overrides', () => {
			const suite = createPowertoolsMockSuite({
				logger: {
					logLevel: 'DEBUG',
					enabled: false,
					sampleRate: 0,
					persistentAttributes: { test: 'value' },
					enableCorrelationIds: false,
					enableStructuredLogging: false,
					enableSensitiveDataRedaction: false,
					redactFields: [],
				},
				service: {
					environment: 'development',
					name: '',
					version: '',
					functionName: '',
					region: '',
					architecture: '',
					runtime: '',
				},
			})

			expect(suite.config.logger.logLevel).toBe('DEBUG')
			expect(suite.config.service.environment).toBe('development')
		})

		it('should use test configuration by default', () => {
			const suite = createPowertoolsMockSuite()

			expect(suite.config.service.environment).toBe('test')
			expect(suite.config.tracer.enabled).toBe(false)
		})
	})

	describe('createLoggerModuleMock', () => {
		it('should create logger module mock', () => {
			const moduleMock = createLoggerModuleMock()

			expect(moduleMock.logger).toBeDefined()
			expect(moduleMock.createChildLogger).toBeDefined()
		})

		it('should use provided logger', () => {
			const customLogger = createMockLogger()
			const moduleMock = createLoggerModuleMock(customLogger)

			expect(moduleMock.logger).toBe(customLogger)
		})

		it('should return logger from createChildLogger', () => {
			const moduleMock = createLoggerModuleMock()

			const childLogger =
				moduleMock.createChildLogger() as unknown as MockLogger

			expect(moduleMock.createChildLogger).toHaveBeenCalled()
			expect(childLogger).toBe(moduleMock.logger)
		})
	})

	describe('createMetricsModuleMock', () => {
		it('should create metrics module mock', () => {
			const moduleMock = createMetricsModuleMock()

			expect(moduleMock.metrics).toBeDefined()
			expect(moduleMock.addMetric).toBeDefined()
			expect(moduleMock.measureAndRecordExecutionTime).toBeDefined()
			expect(moduleMock.MetricName).toBeDefined()
			expect(moduleMock.MetricUnit).toBeDefined()
		})

		it('should include metric constants', () => {
			const moduleMock = createMetricsModuleMock()

			expect(moduleMock.MetricName.ExecutionTime).toBe('ExecutionTime')
			expect(moduleMock.MetricUnit.Count).toBe('Count')
			expect(moduleMock.MetricUnit.Milliseconds).toBe('Milliseconds')
		})
	})

	describe('createTracerModuleMock', () => {
		it('should create tracer module mock', () => {
			const moduleMock = createTracerModuleMock()

			expect(moduleMock.tracer).toBeDefined()
			expect(moduleMock.addCommonAnnotations).toBeDefined()
			expect(moduleMock.withSubsegment).toBeDefined()
			expect(moduleMock.subsegmentNames).toBeDefined()
			expect(moduleMock.traceErrorTypes).toBeDefined()
		})

		it('should include tracer constants', () => {
			const moduleMock = createTracerModuleMock()

			expect(moduleMock.subsegmentNames.EXPRESS_ROUTES).toBe('express-routes')
			expect(moduleMock.traceErrorTypes.DEPENDENCY_ERROR).toBe(
				'DependencyError',
			)
		})

		it('should execute operation in withSubsegment', async () => {
			const moduleMock = createTracerModuleMock()
			const operation = vi.fn().mockResolvedValue('result')

			const result = await moduleMock.withSubsegment('test-segment', operation)

			expect(operation).toHaveBeenCalled()
			expect(result).toBe('result')
		})
	})

	describe('createErrorLoggingModuleMock', () => {
		it('should create error logging module mock', () => {
			const moduleMock = createErrorLoggingModuleMock()

			expect(moduleMock.logErrorWithFullObservability).toBeDefined()
		})

		it('should track error logging calls', () => {
			const moduleMock = createErrorLoggingModuleMock()
			const error = new Error('test error')

			moduleMock.logErrorWithFullObservability(error, 'test-operation', {
				key: 'value',
			})

			expect(moduleMock.logErrorWithFullObservability).toHaveBeenCalledWith(
				error,
				'test-operation',
				{ key: 'value' },
			)
		})
	})

	describe('powertoolsAssertions', () => {
		it('should assert logger calls correctly', () => {
			const logger = createMockLogger()
			logger.info('test message', { key: 'value' })

			expect(() => {
				powertoolsAssertions.expectLoggerCalled(
					logger,
					'info',
					'test message',
					{ key: 'value' },
				)
			}).not.toThrow()
		})

		it('should assert metric calls correctly', () => {
			const metrics = createMockMetrics()
			metrics.addMetric('TestMetric', 'Count', 1, { Service: 'test' })

			expect(() => {
				powertoolsAssertions.expectMetricAdded(
					metrics,
					'TestMetric',
					'Count',
					1,
					{ Service: 'test' },
				)
			}).not.toThrow()
		})

		it('should assert tracer annotation calls correctly', () => {
			const tracer = createMockTracer()
			tracer.putAnnotation('key', 'value')

			expect(() => {
				powertoolsAssertions.expectAnnotationAdded(tracer, 'key', 'value')
			}).not.toThrow()
		})

		it('should assert tracer metadata calls correctly', () => {
			const tracer = createMockTracer()
			tracer.putMetadata('key', { data: 'test' })

			expect(() => {
				powertoolsAssertions.expectMetadataAdded(tracer, 'key', {
					data: 'test',
				})
			}).not.toThrow()
		})

		it('should assert error logging calls correctly', () => {
			const errorLogging = createErrorLoggingModuleMock()
			const error = new Error('test error')
			errorLogging.logErrorWithFullObservability(error, 'test-operation', {
				key: 'value',
			})

			expect(() => {
				powertoolsAssertions.expectErrorLogged(
					errorLogging,
					error,
					'test-operation',
					{ key: 'value' },
				)
			}).not.toThrow()
		})
	})

	describe('powertoolsTestScenarios', () => {
		it('should provide full observability scenario', () => {
			const scenario = powertoolsTestScenarios.fullObservability

			expect(scenario.name).toBe('full observability enabled')
			expect(scenario.config.logger.enabled).toBe(true)
			expect(scenario.config.metrics.enabled).toBe(true)
			expect(scenario.config.tracer.enabled).toBe(true)
			expect(scenario.expectLogs).toBe(true)
			expect(scenario.expectMetrics).toBe(true)
			expect(scenario.expectTracing).toBe(true)
		})

		it('should provide no observability scenario', () => {
			const scenario = powertoolsTestScenarios.noObservability

			expect(scenario.name).toBe('observability disabled')
			expect(scenario.config.logger.enabled).toBe(false)
			expect(scenario.config.metrics.enabled).toBe(false)
			expect(scenario.config.tracer.enabled).toBe(false)
			expect(scenario.expectLogs).toBe(false)
			expect(scenario.expectMetrics).toBe(false)
			expect(scenario.expectTracing).toBe(false)
		})

		it('should provide production scenario', () => {
			const scenario = powertoolsTestScenarios.production

			expect(scenario.name).toBe('production configuration')
			expect(scenario.config.service.environment).toBe('production')
			expect(scenario.config.logger.logLevel).toBe('INFO')
			expect(scenario.config.logger.sampleRate).toBe(0.1)
			expect(scenario.config.tracer.captureResponse).toBe(false)
		})

		it('should provide development scenario', () => {
			const scenario = powertoolsTestScenarios.development

			expect(scenario.name).toBe('development configuration')
			expect(scenario.config.service.environment).toBe('development')
			expect(scenario.config.logger.logLevel).toBe('DEBUG')
			expect(scenario.config.logger.sampleRate).toBe(1.0)
			expect(scenario.config.tracer.captureResponse).toBe(true)
		})
	})
})

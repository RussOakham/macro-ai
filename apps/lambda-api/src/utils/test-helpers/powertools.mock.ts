/**
 * Powertools Test Helpers
 * Comprehensive mocking utilities for AWS Lambda Powertools with observability integration
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, type MockedFunction, vi } from 'vitest'

import type { ObservabilityConfig } from '../observability-config.js'
import { createTestTools } from '../observability-factory.js'

/**
 * Mock Logger interface for type safety
 */
export interface MockLogger {
	debug: MockedFunction<(...args: any[]) => void>
	info: MockedFunction<(...args: any[]) => void>
	warn: MockedFunction<(...args: any[]) => void>
	error: MockedFunction<(...args: any[]) => void>
	createChild: MockedFunction<(...args: any[]) => MockLogger>
}

/**
 * Mock Metrics interface for type safety
 */
export interface MockMetrics {
	addMetric: MockedFunction<(...args: any[]) => void>
	publishStoredMetrics: MockedFunction<(...args: any[]) => Promise<void>>
	clearMetrics: MockedFunction<(...args: any[]) => void>
	setDefaultDimensions: MockedFunction<(...args: any[]) => void>
}

/**
 * Mock Tracer interface for type safety
 */
export interface MockTracer {
	putAnnotation: MockedFunction<(...args: any[]) => void>
	putMetadata: MockedFunction<(...args: any[]) => void>
	getSegment: MockedFunction<(...args: any[]) => any>
	addErrorAsMetadata: MockedFunction<(...args: any[]) => void>
	captureAWS: MockedFunction<(...args: any[]) => any>
	captureHTTPsGlobal: MockedFunction<(...args: any[]) => void>
}

/**
 * Create mock logger with proper typing
 */
export const createMockLogger = (): MockLogger => {
	const mockChildLogger = {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		createChild: vi.fn(),
	}

	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		createChild: vi.fn().mockReturnValue(mockChildLogger),
	}
}

/**
 * Create mock metrics with proper typing
 */
export const createMockMetrics = (): MockMetrics => ({
	addMetric: vi.fn(),
	publishStoredMetrics: vi.fn().mockResolvedValue(undefined),
	clearMetrics: vi.fn(),
	setDefaultDimensions: vi.fn(),
})

/**
 * Create mock tracer with proper typing
 */
export const createMockTracer = (): MockTracer => ({
	putAnnotation: vi.fn(),
	putMetadata: vi.fn(),
	getSegment: vi.fn().mockReturnValue({}),
	addErrorAsMetadata: vi.fn(),
	captureAWS: vi.fn(),
	captureHTTPsGlobal: vi.fn(),
})

/**
 * Comprehensive Powertools mock suite
 */
export interface PowertoolsMockSuite {
	logger: MockLogger
	metrics: MockMetrics
	tracer: MockTracer
	config: ObservabilityConfig
}

/**
 * Create complete Powertools mock suite
 */
export const createPowertoolsMockSuite = (
	configOverrides: Partial<ObservabilityConfig> = {},
): PowertoolsMockSuite => {
	const testTools = createTestTools()
	const config = { ...testTools.config, ...configOverrides }

	return {
		logger: createMockLogger(),
		metrics: createMockMetrics(),
		tracer: createMockTracer(),
		config,
	}
}

/**
 * Mock factory for powertools-logger.js module
 */
export const createLoggerModuleMock = (mockLogger?: MockLogger) => {
	const logger = mockLogger ?? createMockLogger()

	return {
		logger,
		createChildLogger: vi.fn().mockReturnValue(logger),
	}
}

/**
 * Mock factory for powertools-metrics.js module
 */
export const createMetricsModuleMock = (mockMetrics?: MockMetrics) => {
	const metrics = mockMetrics ?? createMockMetrics()

	return {
		metrics,
		addMetric: vi.fn(),
		measureAndRecordExecutionTime: vi.fn(
			async (operation: () => Promise<unknown>) => {
				// Actually call the operation to ensure it executes
				return await operation()
			},
		),
		recordColdStart: vi.fn(),
		recordMemoryUsage: vi.fn(),
		MetricName: {
			ExecutionTime: 'ExecutionTime',
			MemoryUsage: 'MemoryUsage',
			ColdStart: 'ColdStart',
			ErrorCount: 'ErrorCount',
		},
		MetricUnit: {
			Count: 'Count',
			Milliseconds: 'Milliseconds',
			Bytes: 'Bytes',
			Percent: 'Percent',
		},
	}
}

/**
 * Mock factory for powertools-tracer.js module
 */
export const createTracerModuleMock = (mockTracer?: MockTracer) => {
	const tracer = mockTracer ?? createMockTracer()

	return {
		tracer,
		addCommonAnnotations: vi.fn(),
		addCommonMetadata: vi.fn(),
		captureError: vi.fn(),
		withSubsegment: vi.fn((name: string, operation: () => Promise<unknown>) =>
			operation(),
		),
		withSubsegmentSync: vi.fn((name: string, operation: () => unknown) =>
			operation(),
		),
		subsegmentNames: {
			EXPRESS_ROUTES: 'express-routes',
			DATABASE_QUERY: 'database-query',
			EXTERNAL_API: 'external-api',
		},
		traceErrorTypes: {
			DEPENDENCY_ERROR: 'DependencyError',
			VALIDATION_ERROR: 'ValidationError',
			BUSINESS_ERROR: 'BusinessError',
		},
	}
}

/**
 * Mock factory for powertools-error-logging.js module
 */
export const createErrorLoggingModuleMock = () => ({
	logErrorWithFullObservability: vi.fn(),
	logAppError: vi.fn(),
	logGenericError: vi.fn(),
	logResultError: vi.fn(),
	logOperationSuccess: vi.fn(),
	logOperationStart: vi.fn(),
	resultFromPromise: vi.fn(),
	resultFromSync: vi.fn(),
})

/**
 * Complete module mocking setup for Powertools
 * Note: This function cannot use vi.mock() due to hoisting issues.
 * Use individual mock creators and vi.mock() calls at the top level instead.
 */
export const setupPowertoolsMocks = (
	customMocks: {
		logger?: MockLogger
		metrics?: MockMetrics
		tracer?: MockTracer
	} = {},
) => {
	const loggerMock = createLoggerModuleMock(customMocks.logger)
	const metricsMock = createMetricsModuleMock(customMocks.metrics)
	const tracerMock = createTracerModuleMock(customMocks.tracer)
	const errorLoggingMock = createErrorLoggingModuleMock()

	return {
		logger: loggerMock,
		metrics: metricsMock,
		tracer: tracerMock,
		errorLogging: errorLoggingMock,
	}
}

/**
 * Powertools assertion helpers
 */
export const powertoolsAssertions = {
	/** Assert logger was called with specific message */
	expectLoggerCalled: (
		logger: MockLogger,
		level: keyof MockLogger,
		message: string,
		additionalData?: Record<string, unknown>,
	) => {
		if (additionalData) {
			expect(logger[level]).toHaveBeenCalledWith(
				message,
				expect.objectContaining(additionalData),
			)
		} else {
			expect(logger[level]).toHaveBeenCalledWith(message, expect.any(Object))
		}
	},

	/** Assert metric was added */
	expectMetricAdded: (
		metrics: MockMetrics,
		name: string,
		unit: string,
		value: number,
		dimensions?: Record<string, string>,
	) => {
		if (dimensions) {
			expect(metrics.addMetric).toHaveBeenCalledWith(
				name,
				unit,
				value,
				dimensions,
			)
		} else {
			expect(metrics.addMetric).toHaveBeenCalledWith(name, unit, value)
		}
	},

	/** Assert tracer annotation was added */
	expectAnnotationAdded: (
		tracer: MockTracer,
		key: string,
		value: string | number | boolean,
	) => {
		expect(tracer.putAnnotation).toHaveBeenCalledWith(key, value)
	},

	/** Assert tracer metadata was added */
	expectMetadataAdded: (tracer: MockTracer, key: string, value: unknown) => {
		expect(tracer.putMetadata).toHaveBeenCalledWith(key, value)
	},

	/** Assert error was logged with full observability */
	expectErrorLogged: (
		errorLoggingMock: ReturnType<typeof createErrorLoggingModuleMock>,
		error: Error,
		operation: string,
		context?: Record<string, unknown>,
	) => {
		if (context) {
			expect(
				errorLoggingMock.logErrorWithFullObservability,
			).toHaveBeenCalledWith(error, operation, expect.objectContaining(context))
		} else {
			expect(
				errorLoggingMock.logErrorWithFullObservability,
			).toHaveBeenCalledWith(error, operation, expect.any(Object))
		}
	},
}

/**
 * Powertools test scenarios
 */
export const powertoolsTestScenarios = {
	/** Test with all observability enabled */
	fullObservability: {
		name: 'full observability enabled',
		config: {
			logger: { enabled: true, logLevel: 'DEBUG' as const },
			metrics: { enabled: true },
			tracer: { enabled: true },
		},
		expectLogs: true,
		expectMetrics: true,
		expectTracing: true,
	},

	/** Test with observability disabled */
	noObservability: {
		name: 'observability disabled',
		config: {
			logger: { enabled: false },
			metrics: { enabled: false },
			tracer: { enabled: false },
		},
		expectLogs: false,
		expectMetrics: false,
		expectTracing: false,
	},

	/** Test production configuration */
	production: {
		name: 'production configuration',
		config: {
			service: { environment: 'production' as const },
			logger: { enabled: true, logLevel: 'INFO' as const, sampleRate: 0.1 },
			metrics: { enabled: true, sampleRate: 0.1 },
			tracer: { enabled: true, captureResponse: false },
		},
		expectLogs: true,
		expectMetrics: true,
		expectTracing: true,
	},

	/** Test development configuration */
	development: {
		name: 'development configuration',
		config: {
			service: { environment: 'development' as const },
			logger: { enabled: true, logLevel: 'DEBUG' as const, sampleRate: 1.0 },
			metrics: { enabled: true, sampleRate: 1.0 },
			tracer: { enabled: true, captureResponse: true },
		},
		expectLogs: true,
		expectMetrics: true,
		expectTracing: true,
	},
}

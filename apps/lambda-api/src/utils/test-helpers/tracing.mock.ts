import { vi } from 'vitest'

// Type for mocked Powertools Tracer utilities
// This ensures our mocks stay in sync with the real implementation
interface MockTracerUtilsType {
	addCommonAnnotations: ReturnType<typeof vi.fn>
	addCommonMetadata: ReturnType<typeof vi.fn>
	captureError: ReturnType<typeof vi.fn>
	tracer: {
		putAnnotation: ReturnType<typeof vi.fn>
		putMetadata: ReturnType<typeof vi.fn>
		addErrorAsMetadata: ReturnType<typeof vi.fn>
		getSegment: ReturnType<typeof vi.fn>
	}
	withSubsegment: ReturnType<typeof vi.fn>
	withSubsegmentSync: ReturnType<typeof vi.fn>
}

// Type for subsegment names constants
interface MockSubsegmentNamesType {
	EXPRESS_INIT: string
	EXPRESS_MIDDLEWARE: string
	EXPRESS_ROUTES: string
	PARAMETER_STORE_GET: string
	PARAMETER_STORE_GET_MULTIPLE: string
	PARAMETER_STORE_INIT: string
	PARAMETER_STORE_HEALTH: string
}

// Type for trace error types constants
interface MockTraceErrorTypesType {
	DEPENDENCY_ERROR: string
	PARAMETER_STORE_ERROR: string
}

/**
 * Reusable mock for Powertools Tracer supporting comprehensive X-Ray testing:
 * 1. Tracer Utility Mock (for service-level tests)
 * 2. Subsegment Verification (for integration tests)
 * 3. Error Capture Testing (for error handling tests)
 *
 * Tracer Utility Mock Usage (for service tests):
 * ```typescript
 * import { mockTracingUtils } from '../../utils/test-helpers/tracing.mock.ts'
 *
 * vi.mock('../../utils/powertools-tracer.ts', () => mockTracingUtils.createModule())
 *
 * describe('Service with Tracing', () => {
 *   let tracingMocks: ReturnType<typeof mockTracingUtils.setup>
 *
 *   beforeEach(() => {
 *     tracingMocks = mockTracingUtils.setup()
 *   })
 *
 *   it('should create subsegment with correct parameters', () => {
 *     // Test implementation
 *     expect(tracingMocks.withSubsegment).toHaveBeenCalledWith(
 *       'test-subsegment',
 *       expect.any(Function),
 *       expect.objectContaining({ operation: 'test' }),
 *       expect.objectContaining({ testMetadata: true })
 *     )
 *   })
 * })
 * ```
 *
 * Error Capture Testing Usage:
 * ```typescript
 * import { mockTracingUtils } from '../../utils/test-helpers/tracing.mock.ts'
 *
 * describe('Error Handling with Tracing', () => {
 *   it('should capture error in trace', () => {
 *     const testError = new Error('Test error')
 *     const tracingMocks = mockTracingUtils.setup()
 *
 *     // Test error handling
 *     expect(tracingMocks.captureError).toHaveBeenCalledWith(
 *       testError,
 *       'DependencyError',
 *       expect.objectContaining({ operation: 'test' })
 *     )
 *   })
 * })
 * ```
 */

/**
 * Creates a basic tracer mock with all utilities
 * Use this for creating fresh mock instances
 * Creates mocks for all known Powertools Tracer utilities based on the type inference
 */
export const createTracerUtilsMock = (): MockTracerUtilsType => {
	// Create mocks for all known utilities - these are inferred from the type
	// This maintains type safety while avoiding hoisting issues
	return {
		addCommonAnnotations: vi.fn(),
		addCommonMetadata: vi.fn(),
		captureError: vi.fn(),
		tracer: {
			putAnnotation: vi.fn(),
			putMetadata: vi.fn(),
			addErrorAsMetadata: vi.fn(),
			getSegment: vi.fn(),
		},
		withSubsegment: vi.fn().mockImplementation((_name, operation) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
			return operation()
		}),
		withSubsegmentSync: vi.fn().mockImplementation((_name, operation) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
			return operation()
		}),
	} as MockTracerUtilsType
}

/**
 * Creates mock constants for subsegment names
 * Use this to get consistent subsegment name constants for testing
 */
export const createSubsegmentNamesMock = (): MockSubsegmentNamesType => {
	return {
		EXPRESS_INIT: 'express-app-initialization',
		EXPRESS_MIDDLEWARE: 'express-middleware-setup',
		EXPRESS_ROUTES: 'express-routes-registration',
		PARAMETER_STORE_GET: 'parameter-store-get',
		PARAMETER_STORE_GET_MULTIPLE: 'parameter-store-get-multiple',
		PARAMETER_STORE_INIT: 'parameter-store-initialization',
		PARAMETER_STORE_HEALTH: 'parameter-store-health-check',
	}
}

/**
 * Creates mock constants for trace error types
 * Use this to get consistent error type constants for testing
 */
export const createTraceErrorTypesMock = (): MockTraceErrorTypesType => {
	return {
		DEPENDENCY_ERROR: 'DependencyError',
		PARAMETER_STORE_ERROR: 'ParameterStoreError',
	}
}

/**
 * Creates a mock factory for vi.mock() to mock the Powertools Tracer module
 * Use this for service/controller tests that use the Powertools Tracer utilities
 */
export const createTracerModule = (): {
	addCommonAnnotations: ReturnType<typeof vi.fn>
	addCommonMetadata: ReturnType<typeof vi.fn>
	captureError: ReturnType<typeof vi.fn>
	subsegmentNames: MockSubsegmentNamesType
	traceErrorTypes: MockTraceErrorTypesType
	tracer: {
		putAnnotation: ReturnType<typeof vi.fn>
		putMetadata: ReturnType<typeof vi.fn>
		addErrorAsMetadata: ReturnType<typeof vi.fn>
		getSegment: ReturnType<typeof vi.fn>
	}
	withSubsegment: ReturnType<typeof vi.fn>
	withSubsegmentSync: ReturnType<typeof vi.fn>
} => {
	const utilsMock = createTracerUtilsMock()
	const subsegmentNames = createSubsegmentNamesMock()
	const traceErrorTypes = createTraceErrorTypesMock()

	return {
		...utilsMock,
		subsegmentNames,
		traceErrorTypes,
	}
}

/**
 * Sets up and returns the tracer utility mocks for easy access in tests
 * Use this in beforeEach for service/controller tests
 */
export const setupTracerMock = (): MockTracerUtilsType => {
	vi.clearAllMocks()
	return createTracerUtilsMock()
}

/**
 * Creates a mock subsegment call expectation helper
 * Use this to verify subsegment creation with type-safe parameters
 */
export const createSubsegmentExpectation = (
	name: string,
	annotations?: Record<string, unknown>,
	metadata?: Record<string, unknown>,
) => {
	const expectation: {
		name: string
		operation: string
		annotations?: Record<string, unknown>
		metadata?: Record<string, unknown>
	} = {
		name,
		operation: 'any-function',
	}

	if (annotations) {
		expectation.annotations = annotations
	}

	if (metadata) {
		expectation.metadata = metadata
	}

	return expectation
}

/**
 * Creates a mock error capture expectation helper
 * Use this to verify error capture with type-safe parameters
 */
export const createErrorCaptureExpectation = (
	error: Error,
	errorType: string,
	context?: Record<string, unknown>,
) => {
	const expectation: (Error | string | Record<string, unknown>)[] = [
		error,
		errorType,
	]

	if (context) {
		expectation.push(context)
	}

	return expectation
}

/**
 * Comprehensive tracing mock utilities
 * Provides all utilities in a single object for easy importing
 */
export const mockTracingUtils = {
	createModule: createTracerModule,
	setup: setupTracerMock,
	createUtilsMock: createTracerUtilsMock,
	createSubsegmentNames: createSubsegmentNamesMock,
	createTraceErrorTypes: createTraceErrorTypesMock,
	expectSubsegment: createSubsegmentExpectation,
	expectErrorCapture: createErrorCaptureExpectation,
}

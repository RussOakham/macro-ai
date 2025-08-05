/**
 * Test helpers for Lambda API
 * Provides reusable mock utilities for testing AWS services and Lambda functionality
 */

// Parameter Store mocking utilities
export { mockParameterStoreService } from './parameter-store.mock.js'

// X-Ray Tracing mocking utilities
export { mockTracingUtils } from './tracing.mock.js'

// Middleware testing utilities
export {
	createMiddlewareChainTestUtils,
	createMiddlewareTestSuite,
	createMockAPIGatewayEvent,
	createMockAPIGatewayResponse,
	createMockErrorHandler,
	createMockHandler,
	createMockLambdaContext,
	createMockMiddlewareConfig,
	createMockMiddlewareContext,
	createMockObservabilityConfig,
	type MiddlewareChainTestUtils,
	middlewareTestScenarios,
	type MiddlewareTestSuite,
} from './middleware.mock.js'

// Powertools mocking utilities
export {
	createErrorLoggingModuleMock,
	createLoggerModuleMock,
	createMetricsModuleMock,
	createMockLogger,
	createMockMetrics,
	createMockTracer,
	createPowertoolsMockSuite,
	createTracerModuleMock,
	type MockLogger,
	type MockMetrics,
	type MockTracer,
	powertoolsAssertions,
	type PowertoolsMockSuite,
	powertoolsTestScenarios,
	setupPowertoolsMocks,
} from './powertools.mock.js'

// Error handling testing utilities
export {
	createErrorHandlingTestSuite,
	createMockTryCatch,
	createMockTryCatchAsync,
	createMockTryCatchSync,
	createTestError,
	errorClassificationHelpers,
	errorHandlingTestScenarios,
	type ErrorHandlingTestSuite,
	resultAssertions,
	setupErrorHandlingMocks,
	testErrorScenarios,
} from './error-handling.mock.js'

// Re-export types for convenience
export type {
	GetParameterCommandOutput,
	GetParametersCommandOutput,
} from '@aws-sdk/client-ssm'
export type { AwsClientStub } from 'aws-sdk-client-mock'

import {
	GetParameterCommandOutput,
	GetParametersCommandOutput,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { AwsClientStub, mockClient } from 'aws-sdk-client-mock'
import { vi } from 'vitest'

// Type for mocked ParameterStoreService methods
// This ensures our mocks stay in sync with the real implementation
interface MockParameterStoreServiceType {
	getInstance: ReturnType<typeof vi.fn>
	initializeParameters: ReturnType<typeof vi.fn>
	getParameter: ReturnType<typeof vi.fn>
	getParameters: ReturnType<typeof vi.fn>
	clearCache: ReturnType<typeof vi.fn>
	getCacheStats: ReturnType<typeof vi.fn>
	healthCheck: ReturnType<typeof vi.fn>
}

/**
 * Reusable mock for ParameterStoreService supporting both approaches:
 * 1. AWS SDK Client Mock (for service-level tests)
 * 2. Service Method Mock (for middleware/controller tests)
 *
 * AWS SDK Client Mock Usage (for parameter-store.service.test.ts):
 * ```typescript
 * import { mockParameterStoreService } from '../../utils/test-helpers/parameter-store.mock.ts'
 *
 * describe('ParameterStoreService', () => {
 *   let ssmMock: AwsClientStub<SSMClient>
 *
 *   beforeEach(() => {
 *     ssmMock = mockParameterStoreService.createAwsMock()
 *   })
 *
 *   it('should test something', () => {
 *     const mockParameter = mockParameterStoreService.createParameter({ Name: 'test-param', Value: 'test-value' })
 *     ssmMock.on(GetParameterCommand).resolves(mockParameter)
 *   })
 * })
 * ```
 *
 * Service Method Mock Usage (for middleware/controller tests):
 * ```typescript
 * import { mockParameterStoreService } from '../../utils/test-helpers/parameter-store.mock.ts'
 *
 * vi.mock('../../services/parameter-store.service.ts', () => mockParameterStoreService.createModule())
 *
 * describe('Lambda Config Service', () => {
 *   let parameterStoreMocks: ReturnType<typeof mockParameterStoreService.setup>
 *
 *   beforeEach(() => {
 *     parameterStoreMocks = mockParameterStoreService.setup()
 *   })
 *
 *   it('should test something', () => {
 *     const mockParameters = mockParameterStoreService.createParameters({ 'test-param': 'test-value' })
 *     parameterStoreMocks.initializeParameters.mockResolvedValue(mockParameters)
 *   })
 * })
 * ```
 */

/**
 * Creates and returns an AWS SDK client mock for SSMClient
 * Use this for service-level tests that test the ParameterStoreService directly
 */
export const createAwsMock = (): AwsClientStub<SSMClient> => {
	return mockClient(SSMClient)
}

/**
 * Creates a basic service mock with all methods
 * Use this for creating fresh mock instances
 * Creates mocks for all known ParameterStoreService methods based on the type inference
 */
export const createParameterStoreServiceMock =
	(): MockParameterStoreServiceType => {
		// Create mocks for all known methods - these are inferred from the type
		// This maintains type safety while avoiding hoisting issues
		return {
			getInstance: vi.fn(),
			initializeParameters: vi.fn(),
			getParameter: vi.fn(),
			getParameters: vi.fn(),
			clearCache: vi.fn(),
			getCacheStats: vi.fn(),
			healthCheck: vi.fn(),
		} as MockParameterStoreServiceType
	}

/**
 * Creates a mock factory for vi.mock() to mock the ParameterStoreService class
 * Use this for middleware/controller tests that use the ParameterStoreService
 */
export const createServiceMock = (): {
	ParameterStoreService: ReturnType<typeof vi.fn>
	parameterStore: MockParameterStoreServiceType
} => {
	const serviceMock = createParameterStoreServiceMock()

	return {
		ParameterStoreService: vi.fn().mockImplementation(() => serviceMock),
		parameterStore: serviceMock,
	}
}

/**
 * Sets up and returns the service method mocks for easy access in tests
 * Use this in beforeEach for middleware/controller tests
 */
export const setupServiceMock = (): MockParameterStoreServiceType => {
	vi.clearAllMocks()
	return createParameterStoreServiceMock()
}

/**
 * Creates a mock SSM parameter object for testing
 *
 * @param overrides - Properties to override in the default parameter object
 * @returns Mock SSM parameter object with proper GetParameterCommandOutput type
 */
export const createMockParameter = (
	overrides: Partial<GetParameterCommandOutput> = {},
): GetParameterCommandOutput => ({
	Parameter: {
		Name: 'test-parameter',
		Value: 'test-value',
		Type: 'String',
		Version: 1,
		LastModifiedDate: new Date('2023-01-01'),
		ARN: 'arn:aws:ssm:us-east-1:123456789012:parameter/test-parameter',
		DataType: 'text',
	},
	$metadata: {
		httpStatusCode: 200,
		requestId: 'test-request-id',
		attempts: 1,
		totalRetryDelay: 0,
	},
	...overrides,
})

/**
 * Creates a mock SSM parameters response for testing
 *
 * @param parameters - Object with parameter names as keys and values as values
 * @param overrides - Properties to override in the default parameters object
 * @returns Mock SSM parameters object with proper GetParametersCommandOutput type
 */
export const createMockParameters = (
	parameters: Record<string, string> = {},
	overrides: Partial<GetParametersCommandOutput> = {},
): GetParametersCommandOutput => ({
	Parameters: Object.entries(parameters).map(([name, value]) => ({
		Name: name,
		Value: value,
		Type: 'String',
		Version: 1,
		LastModifiedDate: new Date('2023-01-01'),
		ARN: `arn:aws:ssm:us-east-1:123456789012:parameter/${name}`,
		DataType: 'text',
	})),
	InvalidParameters: [],
	$metadata: {
		httpStatusCode: 200,
		requestId: 'test-request-id',
		attempts: 1,
		totalRetryDelay: 0,
	},
	...overrides,
})

/**
 * Creates mock parameters for Macro AI configuration
 * Returns the standard set of parameters used by the Lambda function
 */
export const createMacroAiParameters = (): Record<string, string> => ({
	'macro-ai-openai-key': 'sk-test-openai-key-1234567890',
	'macro-ai-database-url': 'postgresql://user:pass@localhost:5432/testdb',
	'macro-ai-redis-url': 'redis://localhost:6379',
	'macro-ai-cognito-user-pool-id': 'us-east-1_ABC123DEF',
	'macro-ai-cognito-user-pool-client-id': 'abcdefghijklmnopqrstuvwxyz',
})

/**
 * Unified export object supporting both AWS SDK mocking and service method mocking
 * Following the established pattern from other mock helpers
 */
export const mockParameterStoreService = {
	// Core factory functions
	create: createParameterStoreServiceMock,
	createModule: createServiceMock,
	setup: setupServiceMock,

	// AWS SDK Client Mock (for service-level tests)
	createAwsMock,

	// Mock data creators
	createParameter: createMockParameter,
	createParameters: createMockParameters,
	createMacroAiParameters,
}

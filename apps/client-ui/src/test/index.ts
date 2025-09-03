/**
 * Client-UI Testing Utilities Index
 *
 * Central export point for all enhanced testing utilities in the client-ui project.
 * This provides a clean interface for importing testing utilities across the project.
 */

// Main testing utilities
export type {
	ApiTestConfig,
	AuthTestState,
	ComponentTestContext,
	MockApiClient,
	MockAxiosInstance,
} from './test-utils'
export {
	clientUITestAssertions,
	clientUITestData,
	clientUITestUtils,
	createAuthenticatedUserState,
	createMockApiClient,
	createMockApiError,
	createMockApiResponse,
	createMockAuthState,
	createMockAxiosInstance,
	createMockRouterContext,
	createMockTokenRefresh,
	createMSWHandlers,
	renderWithProviders,
	setupMSWServer,
} from './test-utils'

// Specialized testing utilities
export type {
	EnhancedApiCallScenario,
	InterceptorTestConfig,
	MockAdapterConfig,
	MSWHandlerConfig,
	TokenRefreshTestConfig,
} from './api-test-utils'
export {
	createAuthTestScenarios,
	createDynamicMSWHandlers,
	createErrorTestScenarios,
	createHybridTestSetup,
	createMockAdapter,
	createMockApiClientWithAdapter,
	createMockAxiosWithInterceptors,
	createMockInterceptors,
	createMockSharedRefreshPromise,
	createMockTokenRefreshFunction,
	createNetworkErrorScenarios,
	createPerformanceTestScenarios,
	createTrackingMockApiClient,
	testApiCallScenarios,
	testErrorHandling,
	testInterceptor,
} from './api-test-utils'
export type {
	ComponentTestConfig,
	EnhancedRenderResult,
} from './component-test-utils'
export {
	componentAssertions,
	componentTesting,
	createMockComponentProps,
	createMockHook,
	createMockRouter,
	formTesting,
	renderComponent,
	renderWithAuth,
	renderWithoutAuth,
	simulateUserInteraction,
	testComponentState,
	testRouterNavigation,
	waitForComponentReady,
} from './component-test-utils'

// Re-export commonly used testing utilities from config-testing
export {
	apiResponseFactory,
	authFactory,
	chatFactory,
	testUtils,
	userFactory,
} from '@repo/config-testing'

// Re-export MSW utilities
export {
	authHandlers,
	chatHandlers,
	errorHandlers,
	handlers,
	server,
	userHandlers,
} from '@repo/config-testing'

// Re-export React Testing Library utilities
export {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'

// Re-export Vitest utilities
export {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	test,
	vi,
} from 'vitest'

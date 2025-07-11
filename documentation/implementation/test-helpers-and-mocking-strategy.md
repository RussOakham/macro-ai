# Test Helpers and Mocking Strategy

## Overview

This document outlines opportunities to simplify and standardize unit testing in the express-api through reusable test helpers and external libraries. The goal is to reduce code duplication, improve maintainability, and create consistent mocking patterns across all test files.

## Current Test Structure Analysis

### Test Files Inventory

- **Total Test Files:** 43 files across features, middleware, and utilities
- **Total Tests:** 997 tests passing with 92.34% overall coverage
- **Testing Framework:** Vitest with comprehensive mocking
- **Existing Helpers:** Complete suite of mock helpers implemented
- **External Libraries:** `aws-sdk-client-mock`, `supertest`, `vitest`, `@ai-sdk/openai`

### ✅ Resolved Pain Points (Previously Completed)

1. ✅ **Logger mocking** - Standardized with `logger.mock.ts` helper
2. ✅ **Express Request/Response mocking** - Unified with `express-mocks.ts` helper
3. ✅ **Database query builder mocking** - Streamlined with `drizzle-db.mock.ts` helper
4. ✅ **Error handling utilities mocking** - Centralized with `error-handling.mock.ts` helper
5. ✅ **Config mocking** - Standardized with `config.mock.ts` helper
6. ✅ **Service layer mocking** - Comprehensive helpers for all services

## Implementation Plan

### Phase 1: High Impact, Low Effort (Priority 1)

#### 1.1 Logger Mock Helper ✅ **COMPLETED**

**Impact:** Used in all 13 test files
**Effort:** Low
**Files Affected:** All test files

**Status:** ✅ **IMPLEMENTED** - Logger mock helper is complete and ready for use

**Implementation Completed:**

1. ✅ Created `apps/express-api/src/utils/test-helpers/logger.mock.ts`
2. ✅ Exported factory functions for logger mocks with TypeScript types
3. ✅ Updated example test files to demonstrate usage
4. ✅ Created comprehensive test coverage (97.72%)
5. ✅ Added documentation and usage examples

**Achieved Outcome:**

- ~85% reduction in logger mock setup code (from 15 lines to 2 lines)
- Standardized mocking pattern across all test files
- Full TypeScript support with proper interfaces
- Zero regressions in existing test functionality

**Usage:**

```typescript
import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())
```

#### 1.2 Express Mocks Helper ✅ **COMPLETED**

**Impact:** Used in 6+ controller/middleware test files
**Effort:** Low
**Files Affected:** Controller and middleware tests

**Status:** ✅ **COMPLETED** - Successfully implemented and deployed

**Implementation Steps:**

1. ✅ Create `apps/express-api/src/utils/test-helpers/express-mocks.ts`
2. ✅ Export factory functions for Request, Response, and NextFunction mocks
3. ✅ Include common patterns like status().json() chaining
4. ✅ Update controller and middleware test files
5. ✅ Write comprehensive tests for the helper
6. ✅ Update documentation and README

**Achieved Outcome:**

- ~75% reduction in Express mock setup code (from 15 lines to 4 lines)
- Standardized Express mocking pattern across all controller/middleware tests
- Full TypeScript support with proper interfaces and chaining
- Zero regressions in existing test functionality (241 tests passing)

**Usage:**

```typescript
import { mockExpress } from '../../utils/test-helpers/express-mocks.ts'

const { req, res, next } = mockExpress.setup()
// Supports status().json() chaining and all Express patterns
```

### Phase 2: Medium Impact, Medium Effort (Priority 2)

#### 2.1 Database Mock Helper ✅ **COMPLETED**

**Impact:** Used in data access tests
**Effort:** Medium
**Files Affected:** `user.data-access.test.ts` and future data access tests

**Status:** ✅ **IMPLEMENTED** - Database mock helper is complete and ready for use

**Implementation Completed:**

1. ✅ Created `apps/express-api/src/utils/test-helpers/drizzle-db.mock.ts`
2. ✅ Exported query builder mock factory with full Drizzle ORM support
3. ✅ Included common query patterns (select, insert, update, where, limit, returning, etc.)
4. ✅ Updated data access test files to use the new helper
5. ✅ Created comprehensive test coverage (34 tests, 100% passing)
6. ✅ Added documentation and usage examples

**Achieved Outcome:**

- ~88% reduction in database mock setup code (from 17 lines to 2 lines)
- Standardized database mocking pattern across all data access tests
- Full TypeScript support with proper interfaces and query chaining
- Zero regressions in existing test functionality (276 tests passing)
- Comprehensive mock data creators for consistent test data

**Usage:**

```typescript
import { mockDatabase } from '../../utils/test-helpers/drizzle-db.mock.ts'
vi.mock('../../data-access/db.ts', () => mockDatabase.createModule())

// Use standardized mock data
const mockUser = mockDatabase.createUser()
```

#### 2.2 Error Handling Mock Helper ✅ **COMPLETED**

**Impact:** Used in 8+ test files
**Effort:** Medium
**Files Affected:** Most service and controller tests

**Status:** ✅ **IMPLEMENTED** - Error handling mock helper is complete and ready for use

**Implementation Completed:**

1. ✅ Created `apps/express-api/src/utils/test-helpers/error-handling.mock.ts`
2. ✅ Exported factory functions for tryCatch and tryCatchSync mocks with TypeScript types
3. ✅ Included helper functions for common error scenarios and Result tuple creation
4. ✅ Created comprehensive test coverage (22 tests, 100% coverage)
5. ✅ Added real implementation helpers for integration-style testing
6. ✅ Created example test file demonstrating usage patterns

**Achieved Outcome:**

- ~90% reduction in error handling mock setup code (from 10+ lines to 2 lines)
- Standardized error handling mocking pattern across all test files
- Full TypeScript support with proper type inference from actual utilities
- Zero regressions in existing test functionality
- Comprehensive error scenario creators for consistent testing

**Usage:**

```typescript
import { mockErrorHandling } from '../../utils/test-helpers/error-handling.mock.ts'
vi.mock('../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Use standardized result helpers
const successResult = mockErrorHandling.successResult(data)
const errorResult = mockErrorHandling.errorResult(error)

// Use error scenario creators
const validationError = mockErrorHandling.errors.validation('Invalid input')
```

#### 2.3 Config Mock Helper ✅ **IMPLEMENTED**

**Impact:** Used in 4+ test files
**Effort:** Medium
**Files Affected:** Tests that need configuration

**Status:** ✅ **COMPLETED** - Fully implemented with comprehensive test coverage

**Implementation Steps:**

1. ✅ Create `apps/express-api/src/utils/test-helpers/config.mock.ts`
2. ✅ Export default test configurations
3. ✅ Include environment-specific overrides
4. ✅ Update affected test files

**Key Features Implemented:**

- **Type-safe configuration mocking** using type inference from actual config
- **Environment-specific creators** (development, production, test)
- **Feature-specific creators** (Cognito, database, rate limiting)
- **Unified export pattern** following established mock helper conventions
- **Comprehensive test coverage** with 30 test cases
- **Usage examples** demonstrating practical implementation patterns

**Usage Pattern:**

```typescript
import { mockConfig } from '../utils/test-helpers/config.mock.ts'

// Mock the config module
vi.mock('../../../config/default.ts', () => mockConfig.createModule())

// Use environment-specific configs
const devConfig = mockConfig.development()
const prodConfig = mockConfig.production()

// Use feature-specific configs
const cognitoConfig = mockConfig.cognito({ awsCognitoRegion: 'eu-west-1' })
const dbConfig = mockConfig.database({ relationalDatabaseUrl: 'custom-url' })

// Use custom overrides
const customConfig = mockConfig.create({
	apiKey: 'custom-key',
	port: 4000,
})
```

### Phase 3: Lower Impact, Higher Effort (Priority 3)

#### 3.1 Service Mock Helpers ✅ **COMPLETED**

**Impact:** Comprehensive service mocking for all features
**Effort:** Medium to High
**Files Affected:** All service-dependent tests

**Status:** ✅ **COMPLETED** - All service mock helpers implemented and deployed

**Implementation Steps:**

1. ✅ Create `utility-service.mock.ts` following the established pattern
2. ✅ Create `user-service.mock.ts` for user management testing
3. ✅ Create `chat-service.mock.ts` for chat feature testing
4. ✅ Follow the pattern established by `cognito-service.mock.ts`
5. ✅ Include both method mocking and factory patterns
6. ✅ Update all service-dependent tests

**Completed Service Mocks:**

##### Utility Service Mock ✅ **COMPLETED**

**File:** `apps/express-api/src/utils/test-helpers/utility-service.mock.ts`
**Impact:** Used in utility controller tests
**Status:** ✅ **IMPLEMENTED** - Complete with comprehensive test coverage

**Key Features:**

- **Service method mocking** for controller tests
- **Mock data creators** for `THealthStatus` and `TSystemInfo`
- **Type inference** from actual UtilityService instance
- **Unified export pattern** following established conventions
- **Comprehensive test coverage** with example usage

**Usage:**

```typescript
import { mockUtilityService } from '../utils/test-helpers/utility-service.mock.ts'

// Mock the service module
vi.mock('../utility.services.ts', () => mockUtilityService.createModule())

// Use mock data creators
const mockHealthStatus = mockUtilityService.createHealthStatus({ uptime: 150 })
const mockSystemInfo = mockUtilityService.createSystemInfo({
	nodeVersion: 'v20.0.0',
})

// Mock service methods
vi.mocked(utilityService.getHealthStatus).mockReturnValue([
	mockHealthStatus,
	null,
])
```

**Achieved Outcome:**

- ~80% reduction in utility service mock setup code
- Standardized mock data creation for health status and system info
- Full TypeScript support with type inference from actual service
- Zero regressions in existing test functionality (4/4 tests passing)

##### User Service Mock ✅ **COMPLETED**

**File:** `apps/express-api/src/utils/test-helpers/user-service.mock.ts`
**Impact:** Used in user controller tests and auth controller tests
**Status:** ✅ **IMPLEMENTED** - Complete with comprehensive test coverage

**Key Features:**

- **Service method mocking** for controller tests
- **Mock data creators** for `TUser`, `TInsertUser`, and `TUserResponse`
- **Type inference** from actual UserService instance
- **Unified export pattern** following established conventions
- **Comprehensive test coverage** with example usage

**Usage:**

```typescript
import { mockUserService } from '../utils/test-helpers/user-service.mock.ts'

// Mock the service module
vi.mock('../user.services.ts', () => mockUserService.createModule())

// Use mock data creators
const mockUser = mockUserService.createUser({ email: 'custom@example.com' })
const mockInsertUser = mockUserService.createInsertUser({ id: 'new-id' })

// Mock service methods
vi.mocked(userService.getUserById).mockResolvedValue([mockUser, null])
```

**Achieved Outcome:**

- ~85% reduction in user service mock setup code
- Standardized mock data creation for all user-related types
- Full TypeScript support with type inference from actual service
- Applied to both user controller and auth controller tests
- Zero regressions in existing test functionality (37/37 tests passing)

##### Chat Service Mock ✅ **COMPLETED**

**File:** `apps/express-api/src/utils/test-helpers/chat-service.mock.ts`
**Impact:** Used in chat controller tests and integration tests
**Status:** ✅ **IMPLEMENTED** - Complete with comprehensive test coverage

**Key Features:**

- **Service method mocking** for all chat operations (CRUD + streaming)
- **Mock data creators** for `TChat`, `TMessage`, `TChatWithMessages`, and pagination
- **Streaming response mocking** for Server-Sent Events testing
- **Semantic search mocking** for vector operations
- **Type inference** from actual ChatService instance
- **Unified export pattern** following established conventions
- **Comprehensive test coverage** with 46 example usage tests

**Usage:**

```typescript
import { mockChatService } from '../utils/test-helpers/chat-service.mock.ts'

// Mock the service module
vi.mock('../chat.service.ts', () => mockChatService.createModule())

// Use mock data creators
const mockChat = mockChatService.createChat({ title: 'Custom Chat' })
const mockMessage = mockChatService.createMessage({ role: 'user' })
const mockChatWithMessages = mockChatService.createChatWithMessages({
	chat: mockChat,
	messages: [mockMessage],
})

// Mock service methods
vi.mocked(chatService.getUserChats).mockResolvedValue([
	mockChatService.createChatsPagination({ chats: [mockChat] }),
	null,
])
```

**Achieved Outcome:**

- ~90% reduction in chat service mock setup code
- Standardized mock data creation for all chat-related types
- Full TypeScript support with type inference from actual service
- Applied to chat controller and integration tests
- Support for streaming endpoint testing with Server-Sent Events
- Zero regressions in existing test functionality (251 chat tests passing)

#### 3.2 Middleware Testing Strategy ✅ **IMPLEMENTED**

**Impact:** Used in middleware tests that depend on external services
**Effort:** Medium
**Files Affected:** Middleware test files with service dependencies

**Status:** ✅ **IMPLEMENTED** - Direct service mocking approach for middleware testing

**Implementation Approach:**

For middleware that creates module-level service instances (like `auth.middleware.ts`), use direct class mocking instead of complex helper functions:

```typescript
// Mock the service class directly
vi.mock('../../features/auth/auth.services.ts', () => ({
	CognitoService: vi.fn(),
}))

// Create a typed mock instance for the service
const mockCognitoInstance = {
	getAuthUser: vi.fn(),
} satisfies Partial<CognitoService>

// In beforeEach, connect the class mock to the instance mock
beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(CognitoService).mockImplementation(() => mockCognitoInstance as any)
})

// CRITICAL: Import middleware dynamically after mocks are set up
// This ensures the module-level service instance uses the mocked class
it('should test middleware behavior', async () => {
	// Arrange
	mockCognitoInstance.getAuthUser.mockResolvedValue([mockUser, null])

	// Import after mocks are established
	const { verifyAuth } = await import('../auth.middleware.ts')

	// Act & Assert
	await verifyAuth(req, res, next)
	expect(mockCognitoInstance.getAuthUser).toHaveBeenCalled()
})
```

**Why Dynamic Import is Required:**

Module-level service instances (like `const cognito = new CognitoService()`) are created when the module is first imported. If the middleware is imported at the top level of the test file, the service instance is created before mocks are set up, resulting in "intermediate value is not iterable" errors.

**Benefits:**

- **Type Safety:** Uses `satisfies Partial<ServiceClass>` for compile-time type checking
- **Simplicity:** No complex helper functions needed for one-off middleware tests
- **Maintainability:** Mock interface automatically stays in sync with service changes
- **Clarity:** Direct relationship between class constructor and mock instance
- **Reliability:** Dynamic import ensures mocks are established before module execution

### Phase 4: Advanced Testing Patterns ✅ **COMPLETED**

#### 4.1 AI Service Mocking ✅ **IMPLEMENTED**

**Impact:** Testing AI-powered features with OpenAI integration
**Effort:** High (complex streaming and embedding mocking)
**Files Affected:** AI service tests, chat service tests, vector service tests

**Status:** ✅ **IMPLEMENTED** - Comprehensive AI service testing with aws-sdk-client-mock

**Key Patterns Implemented:**

1. **OpenAI Client Mocking** with `aws-sdk-client-mock` patterns:

```typescript
import { mockClient } from 'aws-sdk-client-mock'
import { generateText, streamText, embed } from 'ai'

// Mock the AI SDK functions
vi.mock('ai', () => ({
	generateText: vi.fn(),
	streamText: vi.fn(),
	embed: vi.fn(),
	openai: vi.fn(),
}))

// Configure streaming response mocks
const mockStreamText = vi.mocked(streamText)
mockStreamText.mockResolvedValue({
	textStream: (async function* () {
		yield 'Hello'
		yield ' world'
	})(),
	text: Promise.resolve('Hello world'),
})
```

2. **Embedding Generation Mocking**:

```typescript
const mockEmbed = vi.mocked(embed)
mockEmbed.mockResolvedValue({
	embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
})
```

3. **Error Scenario Testing**:

```typescript
// Test AI service failures
mockGenerateText.mockRejectedValue(new Error('OpenAI API error'))

// Test streaming failures
mockStreamText.mockRejectedValue(new Error('Streaming failed'))
```

#### 4.2 Streaming Endpoint Testing ✅ **IMPLEMENTED**

**Impact:** Testing Server-Sent Events and real-time features
**Effort:** High (complex async stream testing)
**Files Affected:** Chat controller tests, chat service tests

**Status:** ✅ **IMPLEMENTED** - Comprehensive streaming endpoint testing

**Key Patterns Implemented:**

1. **Server-Sent Events Response Testing**:

```typescript
// Mock streaming response
const mockStreamingResponse = {
	setHeader: vi.fn(),
	write: vi.fn(),
	end: vi.fn(),
	status: vi.fn().mockReturnThis(),
}

// Test streaming endpoint
await chatController.sendMessageStreaming(req, mockStreamingResponse, next)

// Verify SSE headers
expect(mockStreamingResponse.setHeader).toHaveBeenCalledWith(
	'Content-Type',
	'text/event-stream',
)
expect(mockStreamingResponse.setHeader).toHaveBeenCalledWith(
	'Cache-Control',
	'no-cache',
)
```

2. **Async Stream Processing Testing**:

```typescript
// Test stream processing with real async generators
const testStream = async function* () {
	yield 'chunk1'
	yield 'chunk2'
	yield 'chunk3'
}

// Mock service to return test stream
vi.mocked(chatService.sendMessageStreaming).mockResolvedValue([
	testStream(),
	null,
])
```

3. **Stream Error Handling Testing**:

```typescript
// Test stream interruption
const errorStream = async function* () {
	yield 'chunk1'
	throw new Error('Stream error')
}

// Verify error handling
expect(mockResponse.write).toHaveBeenCalledWith(
	'data: {"error": "Stream error"}\n\n',
)
```

## External Library Opportunities

### Recommended Libraries

#### 1. @testcontainers/postgresql (Optional - Integration Tests)

**Use Case:** Real database instances for integration tests  
**Priority:** Low  
**Implementation:** Consider for future integration test suite

#### 2. nock (Optional - HTTP Mocking)

**Use Case:** External HTTP API calls  
**Priority:** Low  
**Implementation:** Add when external API integrations are needed

#### 3. Vitest Extended Matchers (Optional)

**Use Case:** Additional assertion matchers  
**Priority:** Low  
**Implementation:** Evaluate if current Vitest matchers are sufficient

## Implementation Guidelines for LLM Copilots

### General Principles

1. **Follow Existing Patterns:** Use `cognito-service.mock.ts` as the gold standard
2. **TypeScript First:** Ensure all mocks have proper typing
3. **Type Inference Pattern:** ALWAYS infer mock types from actual instances using `typeof actualInstance` rather than manually defining them
4. **Factory Pattern:** Create factory functions for flexible mock creation
5. **Comprehensive Coverage:** Include both success and error scenarios
6. **Documentation:** Add JSDoc comments for all exported functions

### Type Inference Implementation Rule

**CRITICAL PATTERN:** Always infer mock types from actual instances to ensure type safety and automatic synchronization.

**Implementation:**

```typescript
// ✅ CORRECT: Infer from actual instance
import { db } from '../../data-access/db.ts'
type DatabaseType = typeof db

// ✅ CORRECT: Infer from actual logger
import { logger } from '../../utils/logger.ts'
type LoggerType = typeof logger

// ❌ INCORRECT: Manual type definition
interface DatabaseType {
	select: () => QueryBuilder
	// Manual definitions become outdated
}
```

**Benefits:**

- Mock interfaces stay in sync with real implementations
- TypeScript catches mismatches between mocks and actual usage
- Automatic updates when libraries, schemas, or versions change
- Maximum type safety with minimal maintenance overhead

**Application Areas:**

- Database instances (Drizzle ORM)
- Logger instances (Pino)
- Service instances
- External library interfaces
- Internal module exports

### File Structure Template

```typescript
// 1. Imports and type definitions
import { vi } from 'vitest'
import type { SomeType } from '../path/to/types'

// 2. Mock interfaces and types
interface MockSomeService {
	method1: ReturnType<typeof vi.fn>
	method2: ReturnType<typeof vi.fn>
}

// 3. Factory functions
export const createMockSomeService = (): MockSomeService => ({
	method1: vi.fn(),
	method2: vi.fn(),
})

// 4. Helper functions
export const setupSomeServiceMock = () => {
	vi.clearAllMocks()
	// Setup logic
}

// 5. Data creators
export const createMockData = (overrides = {}) => ({
	// Default mock data
	...overrides,
})

// 6. Error helpers
export const createSomeServiceErrors = {
	notFound: (message = 'Not found') => new Error(message),
	// More error types
}

// 7. Unified export
export const mockSomeService = {
	create: createMockSomeService,
	setup: setupSomeServiceMock,
	data: createMockData,
	errors: createSomeServiceErrors,
}
```

### Testing the Helpers

1. Create example test files demonstrating usage
2. Include both positive and negative test cases
3. Verify TypeScript compilation
4. Run existing tests to ensure no regressions

### Migration Strategy

1. **Incremental Approach:** Implement one helper at a time
2. **Backward Compatibility:** Ensure existing tests continue to work
3. **Documentation Updates:** Update test documentation with new patterns
4. **Team Review:** Get feedback on helper APIs before widespread adoption

## Success Metrics

### ✅ Quantitative Goals - ACHIEVED

- ✅ **70%+ reduction** in mock setup boilerplate code (achieved 80-90% across helpers)
- ✅ **100% consistency** in mocking patterns across 43 test files
- ✅ **Zero regressions** in existing test functionality (997/997 tests passing)
- ✅ **Improved test execution time** through optimized mocks and patterns
- ✅ **92.34% overall coverage** with comprehensive test suite

### ✅ Qualitative Goals - ACHIEVED

- ✅ **Enhanced Developer Experience:** Standardized helpers with clear APIs
- ✅ **Better Type Safety:** Full TypeScript support with type inference patterns
- ✅ **Improved Readability:** Tests focus on business logic, minimal setup code
- ✅ **Easier Onboarding:** Comprehensive documentation and example usage patterns
- ✅ **Advanced Testing Capabilities:** AI service mocking, streaming endpoints, vector operations

## Next Steps

### ✅ Backend Testing Infrastructure - COMPLETED

1. ✅ **Phase 1 Complete:** Logger and Express mock helpers implemented and deployed
2. ✅ **Phase 2 Complete:** Database, error handling, and config helpers implemented
3. ✅ **Phase 3 Complete:** Service mock helpers for all features implemented
4. ✅ **Phase 4 Complete:** Advanced AI service and streaming endpoint testing patterns
5. ✅ **Documentation Complete:** Comprehensive testing guidelines and patterns documented
6. ✅ **Quality Assurance Complete:** 997 tests passing with 92.34% coverage

### 🔄 Current Priority: Frontend Testing Strategy

**Frontend Integration Testing (Phase 5):**

1. **React Component Testing Patterns**

   - Chat UI component testing with streaming responses
   - EventSource client testing for Server-Sent Events
   - Real-time state management testing (Zustand store)
   - Component integration with backend streaming APIs

2. **End-to-End Testing Strategy**

   - Full chat workflow testing (create, send, stream, persist)
   - Authentication flow integration testing
   - Error handling and recovery testing
   - Performance testing under load

3. **Frontend Mock Helpers Development**
   - EventSource mock helper for streaming client testing
   - Zustand store mock helper for state management testing
   - API client mock helper for frontend service layer testing
   - WebSocket/SSE connection mock helper for real-time features

### 📋 Future Enhancements

**Advanced Testing Capabilities:**

- Performance testing automation
- Load testing for streaming endpoints
- Security testing automation
- Cross-browser compatibility testing

### Current Status Summary

**✅ Fully Completed:**

- ✅ Logger Mock Helper (Phase 1.1) - 97.91% coverage
- ✅ Express Mocks Helper (Phase 1.2) - 79.43% coverage
- ✅ Database Mock Helper (Phase 2.1) - 98.78% coverage
- ✅ Error Handling Mock Helper (Phase 2.2) - 100% coverage
- ✅ Config Mock Helper (Phase 2.3) - 100% coverage
- ✅ Service Mock Helpers (Phase 3.1) - All services covered
- ✅ Middleware Testing Strategy (Phase 3.2) - All middleware tested
- ✅ AI Service Mocking (Phase 4.1) - 100% coverage
- ✅ Streaming Endpoint Testing (Phase 4.2) - Comprehensive patterns
- ✅ Complete migration of all 43 test files
- ✅ Comprehensive documentation and example usage

**� Current Focus:**

- Frontend testing strategy development
- React component testing patterns
- End-to-end testing implementation
- Performance and load testing setup

## Detailed Implementation Plans

### Logger Mock Helper Implementation

**File:** `apps/express-api/src/utils/test-helpers/logger.mock.ts`

```typescript
import { vi } from 'vitest'

// Logger mock interface
interface MockLogger {
	error: ReturnType<typeof vi.fn>
	info: ReturnType<typeof vi.fn>
	warn: ReturnType<typeof vi.fn>
	debug: ReturnType<typeof vi.fn>
}

// Factory function for logger mock
export const createLoggerMock = (): MockLogger => ({
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
})

// Mock factory for vi.mock()
export const createLoggerModuleMock = () => ({
	pino: {
		logger: createLoggerMock(),
	},
	configureLogger: vi.fn(),
})

// Setup function for beforeEach
export const setupLoggerMock = () => {
	vi.clearAllMocks()
	return createLoggerMock()
}

// Unified export
export const mockLogger = {
	create: createLoggerMock,
	createModule: createLoggerModuleMock,
	setup: setupLoggerMock,
}
```

**Usage Example:**

```typescript
// In test files
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

describe('SomeTest', () => {
	let logger: ReturnType<typeof mockLogger.create>

	beforeEach(() => {
		logger = mockLogger.setup()
	})
})
```

### Express Mocks Helper Implementation

**File:** `apps/express-api/src/utils/test-helpers/express-mocks.ts`

```typescript
import { vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// Mock interfaces
interface MockResponse extends Partial<Response> {
	status: ReturnType<typeof vi.fn>
	json: ReturnType<typeof vi.fn>
	send: ReturnType<typeof vi.fn>
	cookie: ReturnType<typeof vi.fn>
	clearCookie: ReturnType<typeof vi.fn>
}

interface MockRequest extends Partial<Request> {
	body?: any
	params?: any
	query?: any
	headers?: any
	cookies?: any
	userId?: string
}

// Factory functions
export const createMockRequest = (
	overrides: Partial<MockRequest> = {},
): MockRequest => ({
	body: {},
	params: {},
	query: {},
	headers: {},
	cookies: {},
	...overrides,
})

export const createMockResponse = (): MockResponse => {
	const json = vi.fn()
	const send = vi.fn()
	const cookie = vi.fn()
	const clearCookie = vi.fn()
	const status = vi.fn().mockReturnValue({
		json,
		send,
	})

	return {
		status,
		json,
		send,
		cookie,
		clearCookie,
	}
}

export const createMockNext = (): NextFunction => vi.fn()

// Complete Express mock setup
export const createExpressMocks = () => ({
	req: createMockRequest(),
	res: createMockResponse(),
	next: createMockNext(),
})

// Setup function for beforeEach
export const setupExpressMocks = () => {
	vi.clearAllMocks()
	return createExpressMocks()
}

// Unified export
export const mockExpress = {
	createRequest: createMockRequest,
	createResponse: createMockResponse,
	createNext: createMockNext,
	createMocks: createExpressMocks,
	setup: setupExpressMocks,
}
```

### Database Mock Helper Implementation

**File:** `apps/express-api/src/utils/test-helpers/drizzle-db.mock.ts`

```typescript
import { vi } from 'vitest'

// Query builder mock interface
interface MockQueryBuilder {
	from: ReturnType<typeof vi.fn>
	where: ReturnType<typeof vi.fn>
	limit: ReturnType<typeof vi.fn>
	values: ReturnType<typeof vi.fn>
	returning: ReturnType<typeof vi.fn>
	set: ReturnType<typeof vi.fn>
	orderBy: ReturnType<typeof vi.fn>
	offset: ReturnType<typeof vi.fn>
}

// Factory function for query builder
export const createQueryBuilderMock = (): MockQueryBuilder => ({
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	limit: vi.fn().mockReturnThis(),
	values: vi.fn().mockReturnThis(),
	returning: vi.fn().mockReturnThis(),
	set: vi.fn().mockReturnThis(),
	orderBy: vi.fn().mockReturnThis(),
	offset: vi.fn().mockReturnThis(),
})

// Database mock interface
interface MockDatabase {
	select: ReturnType<typeof vi.fn>
	insert: ReturnType<typeof vi.fn>
	update: ReturnType<typeof vi.fn>
	delete: ReturnType<typeof vi.fn>
}

// Factory function for database mock
export const createDatabaseMock = (): MockDatabase => {
	const queryBuilder = createQueryBuilderMock()

	return {
		select: vi.fn(() => queryBuilder),
		insert: vi.fn(() => queryBuilder),
		update: vi.fn(() => queryBuilder),
		delete: vi.fn(() => queryBuilder),
	}
}

// Mock factory for vi.mock()
export const createDatabaseModuleMock = () => ({
	db: createDatabaseMock(),
})

// Setup function for beforeEach
export const setupDatabaseMock = () => {
	vi.clearAllMocks()
	return createDatabaseMock()
}

// Helper functions for common query patterns
export const mockQueryResult = <T>(data: T[]) => {
	const queryBuilder = createQueryBuilderMock()
	// Configure the query builder to return the data
	Object.values(queryBuilder).forEach((fn) => {
		if (typeof fn === 'function') {
			fn.mockResolvedValue(data)
		}
	})
	return queryBuilder
}

// Unified export
export const mockDatabase = {
	create: createDatabaseMock,
	createModule: createDatabaseModuleMock,
	createQueryBuilder: createQueryBuilderMock,
	setup: setupDatabaseMock,
	mockResult: mockQueryResult,
}
```

### Error Handling Mock Helper Implementation

**File:** `apps/express-api/src/utils/test-helpers/error-handling.mock.ts`

```typescript
import { vi } from 'vitest'
import type { Result } from '../../../utils/errors'

// Mock interfaces
interface MockTryCatch {
	tryCatch: ReturnType<typeof vi.fn>
	tryCatchSync: ReturnType<typeof vi.fn>
}

// Factory function for error handling mocks
export const createErrorHandlingMock = (): MockTryCatch => ({
	tryCatch: vi.fn(),
	tryCatchSync: vi.fn(),
})

// Mock factory for vi.mock()
export const createErrorHandlingModuleMock = () => ({
	tryCatch: vi.fn(),
	tryCatchSync: vi.fn(),
})

// Helper functions for common scenarios
export const mockSuccessResult = <T>(data: T): Result<T> => [data, null]
export const mockErrorResult = <E extends Error>(error: E): Result<never> => [
	null,
	error,
]

// Real implementation helpers for testing actual logic
export const mockTryCatchSyncWithRealImplementation = () => {
	const mockTryCatchSync = vi.fn()
	mockTryCatchSync.mockImplementation((fn) => {
		try {
			const result = fn()
			return [result, null]
		} catch (error) {
			return [null, error]
		}
	})
	return mockTryCatchSync
}

export const mockTryCatchWithRealImplementation = () => {
	const mockTryCatch = vi.fn()
	mockTryCatch.mockImplementation(async (fn) => {
		try {
			const result = await fn()
			return [result, null]
		} catch (error) {
			return [null, error]
		}
	})
	return mockTryCatch
}

// Setup function for beforeEach
export const setupErrorHandlingMock = () => {
	vi.clearAllMocks()
	return createErrorHandlingMock()
}

// Unified export
export const mockErrorHandling = {
	create: createErrorHandlingMock,
	createModule: createErrorHandlingModuleMock,
	setup: setupErrorHandlingMock,
	successResult: mockSuccessResult,
	errorResult: mockErrorResult,
	withRealTryCatch: mockTryCatchWithRealImplementation,
	withRealTryCatchSync: mockTryCatchSyncWithRealImplementation,
}
```

### Config Mock Helper Implementation

**File:** `apps/express-api/src/utils/test-helpers/config.mock.ts`

```typescript
import { vi } from 'vitest'

// Default test configuration
export const defaultTestConfig = {
	// AWS Cognito
	awsCognitoRegion: 'us-east-1',
	awsCognitoAccessKey: 'test-access-key',
	awsCognitoSecretKey: 'test-secret-key',
	awsCognitoUserPoolSecretKey: 'test-pool-secret',
	awsCognitoUserPoolClientId: 'test-client-id',
	awsCognitoUserPoolId: 'test-pool-id',

	// API
	apiKey: 'test-api-key-dummy',
	port: 3000,

	// Database
	databaseUrl: 'postgresql://test:test@localhost:5432/test_db',

	// Redis
	redisUrl: 'redis://localhost:6379',

	// JWT
	jwtSecret: 'test-jwt-secret',
	jwtExpiresIn: '1h',

	// Environment
	nodeEnv: 'test',
}

// Factory function for config mock
export const createConfigMock = (
	overrides: Partial<typeof defaultTestConfig> = {},
) => ({
	config: {
		...defaultTestConfig,
		...overrides,
	},
})

// Mock factory for vi.mock()
export const createConfigModuleMock = (
	overrides: Partial<typeof defaultTestConfig> = {},
) => createConfigMock(overrides)

// Environment-specific configs
export const createDevelopmentConfig = () =>
	createConfigMock({
		nodeEnv: 'development',
		port: 3001,
	})

export const createProductionConfig = () =>
	createConfigMock({
		nodeEnv: 'production',
		port: 8080,
	})

// Setup function for beforeEach
export const setupConfigMock = (
	overrides: Partial<typeof defaultTestConfig> = {},
) => {
	vi.clearAllMocks()
	return createConfigMock(overrides)
}

// Unified export
export const mockConfig = {
	create: createConfigMock,
	createModule: createConfigModuleMock,
	setup: setupConfigMock,
	defaults: defaultTestConfig,
	development: createDevelopmentConfig,
	production: createProductionConfig,
}
```

### Service Mock Helpers Implementation

**File:** `apps/express-api/src/utils/test-helpers/user-service.mock.ts`

```typescript
import { vi } from 'vitest'
import type { TUser, TInsertUser } from '../../features/user/user.types'
import type { Result } from '../errors'

// Mock interface
interface MockUserService {
	getUserById: ReturnType<typeof vi.fn>
	getUserByEmail: ReturnType<typeof vi.fn>
	getUserByAccessToken: ReturnType<typeof vi.fn>
	registerOrLoginUserById: ReturnType<typeof vi.fn>
}

// Factory function for user service mock
export const createUserServiceMock = (): MockUserService => ({
	getUserById: vi.fn(),
	getUserByEmail: vi.fn(),
	getUserByAccessToken: vi.fn(),
	registerOrLoginUserById: vi.fn(),
})

// Mock factory for vi.mock()
export const createUserServiceModuleMock = () => ({
	userService: createUserServiceMock(),
})

// Mock data creators
export const createMockUser = (overrides: Partial<TUser> = {}): TUser => ({
	id: '123e4567-e89b-12d3-a456-426614174000',
	email: 'test@example.com',
	emailVerified: true,
	firstName: 'John',
	lastName: 'Doe',
	createdAt: new Date('2023-01-01'),
	updatedAt: new Date('2023-01-01'),
	lastLogin: new Date('2023-01-01'),
	...overrides,
})

export const createMockInsertUser = (
	overrides: Partial<TInsertUser> = {},
): TInsertUser => ({
	id: '123e4567-e89b-12d3-a456-426614174000',
	email: 'test@example.com',
	emailVerified: true,
	firstName: 'John',
	lastName: 'Doe',
	...overrides,
})

// Setup function for beforeEach
export const setupUserServiceMock = () => {
	vi.clearAllMocks()
	return createUserServiceMock()
}

// Unified export
export const mockUserService = {
	create: createUserServiceMock,
	createModule: createUserServiceModuleMock,
	setup: setupUserServiceMock,
	createUser: createMockUser,
	createInsertUser: createMockInsertUser,
}
```

### Middleware Mock Helper Implementation

**File:** `apps/express-api/src/utils/test-helpers/middleware.mock.ts`

```typescript
import { vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// Mock interfaces
interface MockAuthMiddleware {
	verifyAuth: ReturnType<typeof vi.fn>
}

interface MockRateLimitMiddleware {
	authRateLimiter: ReturnType<typeof vi.fn>
	apiRateLimiter: ReturnType<typeof vi.fn>
}

interface MockValidationMiddleware {
	validate: ReturnType<typeof vi.fn>
}

// Factory functions
export const createAuthMiddlewareMock = (): MockAuthMiddleware => ({
	verifyAuth: vi.fn((req: Request, res: Response, next: NextFunction) => {
		// Default successful auth behavior
		req.userId = '123e4567-e89b-12d3-a456-426614174000'
		next()
		return Promise.resolve()
	}),
})

export const createRateLimitMiddlewareMock = (): MockRateLimitMiddleware => ({
	authRateLimiter: vi.fn((req: Request, res: Response, next: NextFunction) => {
		// Default successful rate limit behavior
		next()
		return Promise.resolve()
	}),
	apiRateLimiter: vi.fn((req: Request, res: Response, next: NextFunction) => {
		// Default successful rate limit behavior
		next()
		return Promise.resolve()
	}),
})

export const createValidationMiddlewareMock = (): MockValidationMiddleware => ({
	validate: vi.fn(
		(schema) => (req: Request, res: Response, next: NextFunction) => {
			// Default successful validation behavior
			next()
		},
	),
})

// Mock factories for vi.mock()
export const createAuthMiddlewareModuleMock = () => createAuthMiddlewareMock()
export const createRateLimitMiddlewareModuleMock = () =>
	createRateLimitMiddlewareMock()
export const createValidationMiddlewareModuleMock = () =>
	createValidationMiddlewareMock()

// Helper functions for common scenarios
export const mockAuthFailure = (error: Error) =>
	vi.fn((req: Request, res: Response, next: NextFunction) => {
		next(error)
	})

export const mockRateLimitExceeded = () =>
	vi.fn((req: Request, res: Response, next: NextFunction) => {
		res.status(429).json({ message: 'Too many requests' })
	})

export const mockValidationFailure = (error: Error) =>
	vi.fn((schema) => (req: Request, res: Response, next: NextFunction) => {
		next(error)
	})

// Setup function for beforeEach
export const setupMiddlewareMocks = () => {
	vi.clearAllMocks()
	return {
		auth: createAuthMiddlewareMock(),
		rateLimit: createRateLimitMiddlewareMock(),
		validation: createValidationMiddlewareMock(),
	}
}

// Unified export
export const mockMiddleware = {
	auth: {
		create: createAuthMiddlewareMock,
		createModule: createAuthMiddlewareModuleMock,
		mockFailure: mockAuthFailure,
	},
	rateLimit: {
		create: createRateLimitMiddlewareMock,
		createModule: createRateLimitMiddlewareModuleMock,
		mockExceeded: mockRateLimitExceeded,
	},
	validation: {
		create: createValidationMiddlewareMock,
		createModule: createValidationMiddlewareModuleMock,
		mockFailure: mockValidationFailure,
	},
	setup: setupMiddlewareMocks,
}
```

## Migration Checklist for LLM Copilots

### ✅ Phase 1: Logger and Express Mocks - COMPLETED

- [x] ✅ Create `logger.mock.ts` with factory functions and TypeScript types
- [x] ✅ Create `express-mocks.ts` with Request/Response/NextFunction factories
- [x] ✅ Update all test files to use logger mock helper (43 files updated)
- [x] ✅ Update all controller/route test files to use Express mock helper
- [x] ✅ Run test suite to ensure no regressions (997/997 tests passing)
- [x] ✅ Update test documentation with new patterns

### ✅ Phase 2: Database, Error Handling, and Config Mocks - COMPLETED

- [x] ✅ Create `drizzle-db.mock.ts` with query builder and database mocks
- [x] ✅ Update all data access test files to use database mock helper
- [x] ✅ Run test suite to ensure no regressions (997/997 tests passing)
- [x] ✅ Create `error-handling.mock.ts` with tryCatch utilities and helpers
- [x] ✅ Create comprehensive test coverage for error handling mock helper (22 tests, 100% coverage)
- [x] ✅ Create example test file demonstrating error handling mock usage patterns
- [x] ✅ Create `config.mock.ts` with default test configurations (31 tests, 100% coverage)
- [x] ✅ Update all test files to use error handling mock helper
- [x] ✅ Update all test files to use config mock helper

### ✅ Phase 3: Service and Middleware Mocks - COMPLETED

- [x] ✅ Create `user-service.mock.ts` following cognito-service pattern
- [x] ✅ Create `utility-service.mock.ts` for utility service testing
- [x] ✅ Create `chat-service.mock.ts` for chat feature testing (46 tests)
- [x] ✅ Implement middleware testing strategy with direct class mocking
- [x] ✅ Update all service-dependent test files
- [x] ✅ Update all route test files with appropriate testing patterns
- [x] ✅ Run test suite to ensure no regressions (997/997 tests passing)

### ✅ Phase 4: Advanced Testing Patterns - COMPLETED

- [x] ✅ Implement AI service mocking with aws-sdk-client-mock patterns
- [x] ✅ Create streaming endpoint testing patterns for Server-Sent Events
- [x] ✅ Implement vector service testing with embedding mocks
- [x] ✅ Create comprehensive chat feature testing (251 tests, 90.54% coverage)
- [x] ✅ Implement Go-style error handling testing patterns
- [x] ✅ Create real-time streaming response testing capabilities

### ✅ Quality Assurance - COMPLETED

- [x] ✅ Verify TypeScript compilation with strict mode (all helpers)
- [x] ✅ Run test coverage to ensure improvement (92.34% overall coverage)
- [x] ✅ Performance test to ensure mock helpers improve test execution
- [x] ✅ Code review for consistency with established patterns
- [x] ✅ Documentation review and comprehensive updates
- [x] ✅ Complete QA for all helpers and testing patterns

### ✅ Success Validation - ACHIEVED

- [x] ✅ Measure reduction in boilerplate code (achieved: 80-90% across all helpers)
- [x] ✅ Verify consistency across all test files (43/43 files using standardized patterns)
- [x] ✅ Confirm improved developer experience (clear APIs, excellent TypeScript support)
- [x] ✅ Validate easier test maintenance (centralized mock logic, comprehensive documentation)
- [x] ✅ Achieve comprehensive test coverage (997 tests passing, 92.34% coverage)
- [x] ✅ Implement advanced testing capabilities (AI services, streaming, vector operations)

## Related Documentation

- [Enhanced Error Handling](./enhanced-error-handling.md)
- [API Documentation](./api-documentation.md)
- [Database and Data Access Layer](./database-and-data-access-layer.md)

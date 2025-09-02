# Phase 2.4: Advanced Mocking & Stubbing - Complete Implementation

## Overview

Phase 2.4 focuses on implementing comprehensive advanced mocking and stubbing capabilities for complex testing scenarios. This phase provides sophisticated testing utilities that enable testing of time-dependent logic, database transactions, error scenarios, and API contracts.

## 🎯 Objectives Achieved

### ✅ Time-Based Testing Utilities

- **TimeController**: Complete control over time in tests with fake timers
- **Time Advancement**: Precise control over time progression for testing scheduled operations
- **Timer Management**: Support for setTimeout, setInterval, and custom timers
- **Business Logic Testing**: Test time-dependent business rules and expiration logic

### ✅ Database Transaction Testing

- **TransactionTester**: Comprehensive database transaction testing with rollback capabilities
- **Concurrent Transactions**: Test multiple transactions running simultaneously
- **Transaction Isolation**: Verify transaction isolation levels and behavior
- **Deadlock Testing**: Simulate and test deadlock scenarios
- **Rollback Testing**: Ensure proper rollback behavior on errors

### ✅ Advanced Error Simulation

- **ErrorSimulator**: Sophisticated error injection and simulation
- **Error Types**: Support for network, database, validation, timeout, and permission errors
- **Probability Control**: Configurable error probability for realistic testing
- **Error Recovery**: Test error recovery mechanisms and retry logic
- **Custom Error Messages**: Support for custom error messages and codes

### ✅ Contract Testing with Pact

- **MockPact**: Complete Pact contract testing implementation
- **Contract Builder**: Fluent API for building API contracts
- **Consumer Testing**: Test API consumers against contracts
- **Provider Testing**: Test API providers against contracts
- **Contract Validation**: Comprehensive request/response validation

### ✅ Mock Data Factories

- **Realistic Data Generation**: Generate realistic test data using Faker.js
- **Custom Overrides**: Support for custom data overrides
- **Array Generation**: Generate arrays of mock data
- **API Response Mocking**: Mock API responses and error responses
- **Contract Data**: Generate data specifically for contract testing

### ✅ Performance Testing Utilities

- **PerformanceTester**: Comprehensive performance testing with metrics
- **Memory Monitoring**: Track memory usage during tests
- **Throughput Measurement**: Measure operations per second
- **Performance Comparison**: Compare different implementations
- **Time Series Tracking**: Track performance over time

## 📁 Files Created

### Core Implementation Files

- `apps/express-api/src/utils/test-helpers/advanced-mocking.ts` - Advanced mocking utilities
- `apps/express-api/src/utils/test-helpers/pact-contract-testing.ts` - Pact contract testing
- `apps/express-api/src/utils/test-helpers/index.ts` - Centralized exports and utilities

### Test Example Files

- `apps/express-api/src/utils/test-helpers/__tests__/advanced-mocking.example.test.ts` - Advanced mocking examples
- `apps/express-api/src/utils/test-helpers/__tests__/pact-contract.example.test.ts` - Pact contract examples

### Documentation

- `TESTING_PHASE2_4_ADVANCED_MOCKING.md` - This comprehensive documentation

## 🚀 Key Features Implemented

### 1. Time-Based Testing

```typescript
import { TimeController } from './test-helpers'

const timeController = new TimeController({
	useFakeTimers: true,
	autoAdvance: false,
	advanceInterval: 1000,
})

// Start time control
timeController.start()

// Test scheduled operations
setTimeout(operation, 5000)
timeController.advance(5000) // Fast-forward 5 seconds

// Test business hours logic
timeController.setTime(new Date('2024-01-15T10:00:00Z'))
expect(service.isBusinessHours()).toBe(true)
```

### 2. Database Transaction Testing

```typescript
import { TransactionTester } from './test-helpers'

const transactionTester = new TransactionTester(db, pool)

// Test transaction rollback
await transactionTester.withTransaction(async (client) => {
	await db.insert(usersTable).values(user)
	throw new Error('Simulated error') // Triggers rollback
})

// Test concurrent transactions
const results = await transactionTester.testConcurrentTransactions([
	async (client) => await createUser1(),
	async (client) => await createUser2(),
])
```

### 3. Error Simulation

```typescript
import { ErrorSimulator } from './test-helpers'

const errorSimulator = new ErrorSimulator({
	probability: 0.1,
	errorTypes: ['network', 'database', 'validation'],
	logErrors: true,
})

// Wrap functions with error simulation
const resilientService = {
	operation: errorSimulator.wrapWithErrorSimulation(
		async () => ({ success: true }),
		'network',
	),
}

// Test retry logic
for (let i = 0; i < maxRetries; i++) {
	try {
		return await resilientService.operation()
	} catch (error) {
		if (i === maxRetries - 1) throw error
		await wait(1000)
	}
}
```

### 4. Contract Testing

```typescript
import { ContractBuilder, ContractTester } from './test-helpers'

// Build contract using fluent API
const contract = new ContractBuilder()
	.get('/api/users', 'Get all users')
	.withQuery({ page: '1', limit: '10' })
	.willRespondWith(200)
	.withResponseBody(paginatedUsers)
	.done()
	.post('/api/users', 'Create user')
	.withRequestBody(userData)
	.willRespondWith(201)
	.withResponseBody(createdUser)
	.done()
	.build({
		name: 'user-api',
		version: '1.0.0',
		consumer: 'client-ui',
		provider: 'express-api',
	})

// Test consumer against contract
const contractTester = new ContractTester()
contractTester.registerContract('user-api', contract)

const result = await contractTester.testConsumer(
	'user-api',
	async (mockServerUrl) => {
		// Test consumer making requests to mock server
		const response = await fetch(`${mockServerUrl}/api/users`)
		expect(response.status).toBe(200)
	},
)
```

### 5. Mock Data Factories

```typescript
import { MockDataFactory } from './test-helpers'

// Create realistic test data
const user = MockDataFactory.createUser({
	email: 'test@example.com',
	firstName: 'John',
})

const users = MockDataFactory.createArray(
	() => MockDataFactory.createUser(),
	10,
	{ department: 'Engineering' },
)

const apiResponse = MockDataFactory.createApiResponse(user)
const errorResponse = MockDataFactory.createErrorResponse(
	'Validation failed',
	'VALIDATION_ERROR',
	400,
)
```

### 6. Performance Testing

```typescript
import { PerformanceTester } from './test-helpers'

const performanceTester = new PerformanceTester()

const results = await performanceTester.runPerformanceTest(
	'databaseQuery',
	async () => await db.select().from(usersTable),
	{
		iterations: 100,
		warmup: 10,
		measureMemory: true,
	},
)

console.log(`Average duration: ${results.summary.avgDuration}ms`)
console.log(`Throughput: ${results.summary.throughput} ops/sec`)
console.log(`Memory usage: ${results.summary.avgMemory}MB`)
```

## 🔧 Configuration Options

### Time Control Configuration

```typescript
interface TimeControlOptions {
	useFakeTimers?: boolean // Use fake timers (default: true)
	initialTime?: Date | number // Initial time (default: current time)
	autoAdvance?: boolean // Auto-advance time (default: false)
	advanceInterval?: number // Advance interval in ms (default: 1000)
}
```

### Error Simulation Configuration

```typescript
interface ErrorSimulationOptions {
	probability?: number // Error probability 0-1 (default: 0.1)
	errorTypes?: string[] // Error types to simulate
	customMessages?: Record<string, string> // Custom error messages
	logErrors?: boolean // Log simulated errors (default: false)
}
```

### Performance Testing Configuration

```typescript
interface PerformanceTestOptions {
	iterations: number // Number of iterations
	warmup?: number // Warmup iterations (default: 10)
	measureMemory?: boolean // Measure memory usage (default: false)
	customMetrics?: string[] // Custom metrics to track
}
```

## 📊 Testing Capabilities

### Time-Based Testing

- ✅ Scheduled operation testing
- ✅ Recurring timer testing
- ✅ Business hours logic testing
- ✅ Expiration logic testing
- ✅ Time-dependent business rules

### Database Transaction Testing

- ✅ Transaction rollback testing
- ✅ Concurrent transaction testing
- ✅ Transaction isolation testing
- ✅ Deadlock scenario testing
- ✅ Connection pool testing

### Error Simulation

- ✅ Network error simulation
- ✅ Database error simulation
- ✅ Validation error simulation
- ✅ Timeout error simulation
- ✅ Permission error simulation
- ✅ Error recovery testing

### Contract Testing

- ✅ Consumer contract testing
- ✅ Provider contract testing
- ✅ Request/response validation
- ✅ Schema validation
- ✅ Status code validation
- ✅ Header validation

### Mock Data Generation

- ✅ Realistic user data
- ✅ Realistic chat data
- ✅ Realistic message data
- ✅ API response mocking
- ✅ Error response mocking
- ✅ Paginated response mocking

### Performance Testing

- ✅ Operation performance measurement
- ✅ Memory usage tracking
- ✅ Throughput calculation
- ✅ Performance comparison
- ✅ Time series tracking

## 🎯 Integration Examples

### Complex Business Logic Testing

```typescript
describe('Complex Business Logic', () => {
	it('should handle time-dependent operations with error recovery', async () => {
		timeController.start()
		errorSimulator.start()

		const service = {
			processOrder: async (orderData) => {
				// Simulate validation
				if (errorSimulator.shouldSimulateError()) {
					errorSimulator.simulateError('validation')
				}

				// Simulate processing delay
				await new Promise((resolve) => setTimeout(resolve, 1000))

				// Simulate database operation
				if (errorSimulator.shouldSimulateError()) {
					errorSimulator.simulateError('database')
				}

				return { success: true, orderId: 'order-123' }
			},
		}

		// Set low error probability for successful test
		errorSimulator.options.probability = 0.1

		const result = await service.processOrder({ items: ['item1', 'item2'] })
		expect(result.success).toBe(true)
		expect(result.orderId).toBe('order-123')
	})
})
```

### API Contract Testing

```typescript
describe('API Contract Testing', () => {
	it('should validate complete API contract', async () => {
		const contract = ContractExamples.createUserManagementContract()
		contractTester.registerContract('user-api', contract)

		// Test consumer
		const consumerResult = await contractTester.testConsumer(
			'user-api',
			async (mockServerUrl) => {
				// Simulate consumer making requests
				const responses = await Promise.all([
					fetch(`${mockServerUrl}/api/users`),
					fetch(`${mockServerUrl}/api/users/123`),
					fetch(`${mockServerUrl}/api/users`, {
						method: 'POST',
						body: userData,
					}),
				])

				responses.forEach((response) => {
					expect(response.status).toBeGreaterThanOrEqual(200)
					expect(response.status).toBeLessThan(500)
				})
			},
		)

		expect(consumerResult).toBe(true)
	})
})
```

## 🚀 Usage in Test Suites

### Basic Setup

```typescript
import { createTestSetup, createMockData, testUtils } from './test-helpers'

describe('My Test Suite', () => {
	let testSetup: TestSetup

	beforeEach(() => {
		testSetup = createTestSetup({
			timeControl: { useFakeTimers: true },
			errorSimulation: { probability: 0.1 },
			performance: { iterations: 50 },
		})
	})

	afterEach(() => {
		testSetup.timeController.stop()
		testSetup.errorSimulator.stop()
	})
})
```

### Advanced Testing

```typescript
it('should test complex scenario', async () => {
	// Setup time control
	testSetup.timeController.start()

	// Setup error simulation
	testSetup.errorSimulator.start()

	// Create mock data
	const user = createMockData.user({ email: 'test@example.com' })

	// Test performance
	const perfResults = await testSetup.performanceTester.runPerformanceTest(
		'userCreation',
		() => createUser(user),
		{ iterations: 100 },
	)

	expect(perfResults.summary.avgDuration).toBeLessThan(100)
})
```

## 📈 Benefits Achieved

### 1. **Comprehensive Testing Coverage**

- Time-dependent logic testing
- Database transaction testing
- Error scenario testing
- API contract validation
- Performance testing

### 2. **Realistic Test Scenarios**

- Realistic mock data generation
- Probabilistic error simulation
- Time-based business logic testing
- Concurrent operation testing

### 3. **Developer Experience**

- Fluent API for contract building
- Centralized test utilities
- Comprehensive documentation
- Easy-to-use configuration

### 4. **Maintainability**

- Modular design
- Type-safe implementations
- Comprehensive error handling
- Extensive test coverage

### 5. **Integration Ready**

- Works with existing test infrastructure
- Compatible with Vitest
- Supports database integration
- Ready for CI/CD pipelines

## 🔄 Next Steps

Phase 2.4 is now complete with comprehensive advanced mocking and stubbing capabilities. The next logical step would be:

**Phase 2.5: Testing Documentation & Training**

- Create comprehensive testing documentation
- Develop testing guidelines and standards
- Create training materials and examples
- Set up testing code review checklist

## 📝 Summary

Phase 2.4 successfully implements a comprehensive suite of advanced mocking and stubbing utilities that enable testing of complex scenarios including:

- **Time-based testing** with precise control over timers and time progression
- **Database transaction testing** with rollback capabilities and concurrent transaction support
- **Advanced error simulation** with configurable error types and probabilities
- **Contract testing** with Pact-compatible implementation for API validation
- **Mock data factories** for generating realistic test data
- **Performance testing** with comprehensive metrics and monitoring

All utilities are fully integrated, well-documented, and ready for use in complex testing scenarios. The implementation provides a solid foundation for testing sophisticated business logic, error handling, and API contracts.

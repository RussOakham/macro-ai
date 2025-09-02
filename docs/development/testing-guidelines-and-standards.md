# Testing Guidelines and Standards

## Overview

This document establishes comprehensive testing guidelines and standards for the macro-ai monorepo. These guidelines ensure
consistent, high-quality testing practices across all applications and packages.

## Testing Standards Hierarchy

### 1. **MUST** Requirements (Critical)

- All business logic MUST have unit tests
- All API endpoints MUST have integration tests
- All error scenarios MUST be tested
- Tests MUST pass before merging to main
- Coverage thresholds MUST be met (80% statements, 75% branches, 80% functions, 80% lines)

### 2. **SHOULD** Requirements (Important)

- Complex components SHOULD have comprehensive test coverage
- Performance-critical code SHOULD have performance tests
- External integrations SHOULD have contract tests
- Test data SHOULD use realistic factories

### 3. **MAY** Requirements (Optional)

- Simple utilities MAY have basic tests
- Configuration files MAY have validation tests
- Documentation examples MAY have executable tests

## Testing Standards by Code Type

### Business Logic

```typescript
// ✅ REQUIRED: Test all business logic
describe('Order Calculation Service', () => {
	it('should calculate total with tax and discount', () => {
		const result = calculateOrderTotal({
			subtotal: 100,
			taxRate: 0.08,
			discountPercent: 10,
		})

		expect(result.total).toBe(97.2) // (100 - 10) * 1.08
		expect(result.tax).toBe(7.2)
		expect(result.discount).toBe(10)
	})

	it('should handle edge cases', () => {
		expect(() => calculateOrderTotal({ subtotal: -100 })).toThrow(
			'Subtotal cannot be negative',
		)
	})
})
```

### API Endpoints

```typescript
// ✅ REQUIRED: Test all API endpoints
describe('User API Endpoints', () => {
	it('POST /api/users should create user', async () => {
		const userData = MockDataFactory.createUser()

		const response = await request(app)
			.post('/api/users')
			.send(userData)
			.expect(201)

		expect(response.body.data.email).toBe(userData.email)
	})

	it('POST /api/users should validate input', async () => {
		const invalidData = { email: 'invalid-email' }

		await request(app).post('/api/users').send(invalidData).expect(400)
	})
})
```

### Error Handling

```typescript
// ✅ REQUIRED: Test all error scenarios
describe('Error Handling', () => {
	it('should handle database connection failures', async () => {
		mockDb.query.mockRejectedValue(new Error('Connection failed'))

		await expect(userService.getUser('123')).rejects.toThrow(
			'Database unavailable',
		)
	})

	it('should handle validation errors', async () => {
		const invalidUser = { email: 'not-an-email' }

		await expect(userService.createUser(invalidUser)).rejects.toThrow(
			'Invalid email format',
		)
	})
})
```

### Data Access Layer

```typescript
// ✅ REQUIRED: Test data access patterns
describe('User Data Access', () => {
	it('should retrieve user by ID', async () => {
		const user = await userDataAccess.getUserById('user-123')
		expect(user).toBeDefined()
		expect(user?.id).toBe('user-123')
	})

	it('should handle non-existent user', async () => {
		const user = await userDataAccess.getUserById('non-existent')
		expect(user).toBeNull()
	})
})
```

## Test Quality Standards

### Test Naming Standards

```typescript
// ✅ Good: Descriptive, behavior-focused names
describe('User Authentication Service', () => {
	describe('when user provides valid credentials', () => {
		it('should return authentication token and user data', () => {})
	})

	describe('when user provides invalid credentials', () => {
		it('should throw authentication error', () => {})
	})

	describe('when user account is locked', () => {
		it('should throw account locked error', () => {})
	})
})

// ❌ Avoid: Implementation-focused or vague names
describe('UserService', () => {
	it('should work', () => {})
	it('test login', () => {})
	it('should call database.query', () => {})
})
```

### Assertion Standards

```typescript
// ✅ Good: Specific, meaningful assertions
expect(user.email).toBe('test@example.com')
expect(user.id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
expect(response.status).toBe(201)
expect(response.body.data).toEqual(expectedData)

// ❌ Avoid: Vague or meaningless assertions
expect(user).toBeTruthy()
expect(response).toBeDefined()
expect(result).not.toBeNull()
```

### Test Data Standards

```typescript
// ✅ Good: Use factories for consistent data
const user = MockDataFactory.createUser({
	email: 'test@example.com',
	firstName: 'John',
})

// ✅ Good: Use realistic data
const chat = MockDataFactory.createChat({
	title: faker.lorem.sentence(),
	createdAt: faker.date.past(),
})

// ❌ Avoid: Hardcoded, unrealistic data
const user = {
	id: 'test-id',
	email: 'test@test.com',
	firstName: 'Test',
	lastName: 'User',
}
```

## Code Coverage Standards

### Coverage Requirements

- **Minimum Coverage**: 80% statements, 75% branches, 80% functions, 80% lines
- **Critical Code**: 95%+ coverage for security, authentication, payment logic
- **Utility Code**: 90%+ coverage for reusable utilities and helpers
- **Integration Code**: 70%+ coverage (focus on happy path and error scenarios)

### Coverage Exclusions

```typescript
// Automatically excluded from coverage:
- node_modules/
- dist/
- **/*.test.ts
- **/*.spec.ts
- **/*.d.ts
- **/*.config.*
- **/*.gen.ts (autogenerated files)
- **/main.tsx, **/main.ts (entry points)
- coverage/**
```

### Coverage Analysis

```bash
# Check current coverage
pnpm test:coverage

# Analyze coverage gaps
pnpm test:coverage:analyze

# Generate coverage badges
pnpm test:coverage:report
```

## Performance Standards

### Test Performance Requirements

- **Unit Tests**: < 1 second per test file
- **Integration Tests**: < 10 seconds per test file
- **Full Test Suite**: < 5 minutes total
- **CI/CD Pipeline**: < 10 minutes including setup

### Performance Optimization

```typescript
// ✅ Good: Use test doubles for external dependencies
vi.mock('../external-service', () => ({
	fetchData: vi.fn().mockResolvedValue(mockData),
}))

// ✅ Good: Use transactions for database tests
await transactionTester.withTransaction(async () => {
	// Test operations - automatically rolled back
})

// ✅ Good: Parallel test execution
// vitest.config.ts
export default defineConfig({
	test: {
		pool: 'threads',
		poolOptions: {
			threads: {
				maxThreads: 4,
				minThreads: 1,
			},
		},
	},
})
```

## Security Testing Standards

### Authentication Testing

```typescript
describe('Authentication Security', () => {
	it('should reject invalid tokens', async () => {
		const response = await request(app)
			.get('/api/protected')
			.set('Authorization', 'Bearer invalid-token')
			.expect(401)
	})

	it('should validate token expiration', async () => {
		const expiredToken = createExpiredToken()

		const response = await request(app)
			.get('/api/protected')
			.set('Authorization', `Bearer ${expiredToken}`)
			.expect(401)
	})
})
```

### Input Validation Testing

```typescript
describe('Input Validation', () => {
	it('should sanitize user input', async () => {
		const maliciousInput = '<script>alert("xss")</script>'

		const response = await request(app)
			.post('/api/users')
			.send({ firstName: maliciousInput })
			.expect(400)

		expect(response.body.error.message).toContain('Invalid input')
	})
})
```

## Integration Testing Standards

### Database Integration

```typescript
// ✅ Required: Use real database for integration tests
describe('User Database Integration', () => {
	let dbContext: DatabaseTestContext

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration({
			useTestcontainers: true,
			runMigrations: true,
		})
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	it('should persist user data correctly', async () => {
		const user = MockDataFactory.createUser()

		const [createdUser] = await dbContext.db
			.insert(usersTable)
			.values(user)
			.returning()

		expect(createdUser.email).toBe(user.email)
	})
})
```

### API Integration

```typescript
// ✅ Required: Test complete request/response cycle
describe('API Integration', () => {
	it('should handle complete user creation workflow', async () => {
		// 1. Create user
		const createResponse = await request(app)
			.post('/api/users')
			.send(userData)
			.expect(201)

		const userId = createResponse.body.data.id

		// 2. Verify user exists
		const getResponse = await request(app)
			.get(`/api/users/${userId}`)
			.expect(200)

		// 3. Update user
		const updateResponse = await request(app)
			.put(`/api/users/${userId}`)
			.send({ firstName: 'Updated' })
			.expect(200)

		expect(updateResponse.body.data.firstName).toBe('Updated')
	})
})
```

## Mock Standards

### Service Mocking

```typescript
// ✅ Good: Mock external dependencies
vi.mock('../external-service', () => ({
	ExternalService: vi.fn().mockImplementation(() => ({
		fetchData: vi.fn().mockResolvedValue(mockData),
		updateData: vi.fn().mockResolvedValue({ success: true }),
	})),
}))

// ✅ Good: Mock with realistic behavior
const mockUserService = {
	getUser: vi.fn().mockImplementation(async (id) => {
		if (id === 'existing-user') {
			return MockDataFactory.createUser({ id })
		}
		return null
	}),
}
```

### Database Mocking

```typescript
// ✅ Good: Use mock database for unit tests
const mockDb = createMockDatabase()
mockDb.select.mockResolvedValue([MockDataFactory.createUser()])

// ✅ Good: Use real database for integration tests
const dbContext = await setupDatabaseIntegration()
```

## Error Testing Standards

### Error Scenario Coverage

```typescript
describe('Error Scenarios', () => {
	// ✅ Required: Test validation errors
	it('should handle invalid input', async () => {
		await expect(service.createUser({ email: 'invalid' })).rejects.toThrow(
			'Invalid email format',
		)
	})

	// ✅ Required: Test system errors
	it('should handle database failures', async () => {
		mockDb.insert.mockRejectedValue(new Error('Database error'))

		await expect(service.createUser(validUser)).rejects.toThrow(
			'Failed to create user',
		)
	})

	// ✅ Required: Test network errors
	it('should handle network timeouts', async () => {
		mockApi.fetch.mockRejectedValue(new Error('Network timeout'))

		await expect(service.fetchExternalData()).rejects.toThrow(
			'External service unavailable',
		)
	})
})
```

## Documentation Requirements

### Test Documentation

- **README files**: Each test directory should have a README explaining the testing approach
- **Example tests**: Provide example tests for common patterns
- **Setup guides**: Document how to run tests locally and in CI
- **Troubleshooting**: Document common issues and solutions

### Code Comments

```typescript
describe('Complex Business Logic', () => {
	it('should calculate compound interest with monthly compounding', () => {
		// Formula: A = P(1 + r/n)^(nt)
		// P = 1000, r = 0.05, n = 12, t = 2
		const result = calculateCompoundInterest({
			principal: 1000,
			rate: 0.05,
			compoundingFrequency: 12,
			years: 2,
		})

		// Expected: 1000 * (1 + 0.05/12)^(12*2) ≈ 1104.89
		expect(result).toBeCloseTo(1104.89, 2)
	})
})
```

## Review Standards

### Code Review Checklist for Tests

#### Test Quality

- [ ] Tests have descriptive names that explain the behavior being tested
- [ ] Tests follow the Arrange-Act-Assert pattern
- [ ] Tests are focused and test one thing at a time
- [ ] Tests use realistic test data from factories
- [ ] Error scenarios are properly tested

#### Test Coverage

- [ ] All business logic has corresponding tests
- [ ] All API endpoints have integration tests
- [ ] Edge cases and error scenarios are covered
- [ ] Coverage thresholds are met

#### Test Performance

- [ ] Tests run in reasonable time (< 1s for unit tests)
- [ ] External dependencies are properly mocked
- [ ] Database tests use transactions or proper cleanup
- [ ] No unnecessary async operations

#### Test Maintainability

- [ ] Tests are easy to understand and modify
- [ ] Test setup and teardown is properly handled
- [ ] Mock data is created using factories
- [ ] Tests don't depend on external services

### Review Process

1. **Automated Checks**: All tests must pass CI/CD pipeline
2. **Coverage Check**: Coverage reports must meet minimum thresholds
3. **Manual Review**: Code reviewer must verify test quality
4. **Integration Check**: Tests must work with existing test suite

## Continuous Integration Standards

### CI/CD Pipeline Requirements

```yaml
# Required CI steps for testing
- name: Install Dependencies
  run: pnpm install

- name: Run Unit Tests
  run: pnpm test:unit

- name: Run Integration Tests
  run: pnpm test:integration

- name: Run Coverage Analysis
  run: pnpm test:coverage

- name: Upload Coverage Reports
  uses: codecov/codecov-action@v3
```

### Branch Protection Rules

- All tests must pass before merge
- Coverage thresholds must be maintained
- No decrease in overall coverage percentage
- Integration tests must pass on target environment

## Environment Standards

### Test Environment Setup

```typescript
// ✅ Required: Consistent test environment
beforeAll(async () => {
	// Setup test database
	dbContext = await setupDatabaseIntegration({
		useTestcontainers: true,
		runMigrations: true,
	})

	// Setup application
	app = createServer(dbContext.db)

	// Setup mocks
	setupMSW()
})

afterAll(async () => {
	await cleanupGlobalResources()
})
```

### Configuration Standards

```typescript
// vitest.config.ts - Required configuration
export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			thresholds: {
				global: {
					statements: 80,
					branches: 75,
					functions: 80,
					lines: 80,
				},
			},
			exclude: [
				'node_modules/',
				'dist/',
				'**/*.test.ts',
				'**/*.spec.ts',
				'**/*.d.ts',
				'**/*.config.*',
				'**/*.gen.ts',
				'**/main.tsx',
				'**/main.ts',
			],
		},
	},
})
```

## Data Management Standards

### Test Data Creation

```typescript
// ✅ Required: Use factories for test data
const user = MockDataFactory.createUser({
	email: 'test@example.com',
})

// ✅ Required: Use realistic data
const chat = MockDataFactory.createChat({
	title: faker.lorem.sentence(),
	userId: user.id,
})

// ❌ Prohibited: Hardcoded test data
const user = {
	id: 'test-123',
	email: 'test@test.com',
}
```

### Database Test Standards

```typescript
// ✅ Required: Use transactions for isolation
await transactionTester.withTransaction(async () => {
	const user = await createUser(userData)
	expect(user.id).toBeDefined()
	// Automatically rolled back
})

// ✅ Required: Clean up after tests
afterEach(async () => {
	await cleanupTestData()
})
```

## Security Testing Standards

### Authentication Tests

```typescript
// ✅ Required: Test authentication flows
describe('Authentication Security', () => {
	it('should require valid token for protected routes', async () => {
		await request(app).get('/api/protected').expect(401)
	})

	it('should validate token format', async () => {
		await request(app)
			.get('/api/protected')
			.set('Authorization', 'Bearer invalid-format')
			.expect(401)
	})
})
```

### Input Sanitization Tests

```typescript
// ✅ Required: Test input sanitization
describe('Input Security', () => {
	it('should reject SQL injection attempts', async () => {
		const maliciousInput = "'; DROP TABLE users; --"

		await request(app)
			.post('/api/users')
			.send({ firstName: maliciousInput })
			.expect(400)
	})
})
```

## Performance Testing Standards

### Performance Test Requirements

```typescript
// ✅ Required: Test performance-critical operations
describe('Performance Requirements', () => {
	it('should respond within acceptable time limits', async () => {
		const performanceTester = new PerformanceTester()

		const results = await performanceTester.runPerformanceTest(
			'userQuery',
			async () => await getUserById('user-123'),
			{ iterations: 100 },
		)

		expect(results.summary.avgDuration).toBeLessThan(50) // 50ms max
	})
})
```

### Load Testing Standards

```typescript
// ✅ Required: Test concurrent operations
describe('Load Testing', () => {
	it('should handle concurrent user creation', async () => {
		const promises = Array.from({ length: 10 }, () =>
			request(app).post('/api/users').send(MockDataFactory.createUser()),
		)

		const responses = await Promise.all(promises)
		responses.forEach((response) => {
			expect(response.status).toBe(201)
		})
	})
})
```

## Documentation Standards

### Test Documentation Requirements

- **Test Purpose**: Every test file must have a header comment explaining its purpose
- **Setup Instructions**: Document any special setup requirements
- **Example Usage**: Provide examples for complex testing patterns
- **Troubleshooting**: Document common issues and solutions

### Documentation Format

```typescript
/**
 * User Service Tests
 *
 * Tests the UserService class functionality including:
 * - User creation and validation
 * - User retrieval and updates
 * - Error handling and edge cases
 * - Performance characteristics
 *
 * Setup Requirements:
 * - Database test container
 * - Mock external services
 *
 * Common Issues:
 * - Database connection timeouts: Increase timeout in test config
 * - Mock service conflicts: Ensure proper mock cleanup
 */
```

## Maintenance Standards

### Test Maintenance Requirements

- **Regular Review**: Tests should be reviewed quarterly for relevance
- **Refactoring**: Tests should be refactored when implementation changes
- **Documentation Updates**: Test documentation should stay current
- **Performance Monitoring**: Test performance should be monitored and optimized

### Deprecation Process

1. **Identify**: Mark obsolete tests with deprecation comments
2. **Plan**: Create plan for removing or updating deprecated tests
3. **Communicate**: Notify team of deprecation timeline
4. **Remove**: Remove deprecated tests after migration period

## Compliance and Auditing

### Audit Requirements

- **Monthly Coverage Reports**: Generate and review coverage reports monthly
- **Quarterly Test Reviews**: Review test quality and effectiveness quarterly
- **Annual Standards Review**: Review and update testing standards annually

### Compliance Metrics

- **Coverage Percentage**: Maintain minimum coverage thresholds
- **Test Performance**: Monitor test execution times
- **Test Reliability**: Track flaky test rates and resolution
- **Security Coverage**: Ensure security scenarios are tested

## Tools and Utilities

### Required Tools

- **Vitest**: Primary test runner
- **React Testing Library**: React component testing
- **MSW**: API mocking
- **Testcontainers**: Database integration testing
- **Faker.js**: Test data generation

### Optional Tools

- **Storybook**: Visual component testing
- **Playwright**: E2E testing
- **Pact**: Contract testing
- **Artillery**: Load testing

### Custom Utilities

- **Database Integration**: `setupDatabaseIntegration()`
- **Time Control**: `TimeController`
- **Error Simulation**: `ErrorSimulator`
- **Performance Testing**: `PerformanceTester`
- **Mock Data**: `MockDataFactory`

## Enforcement

### Automated Enforcement

- **Pre-commit Hooks**: Run tests before commits
- **CI/CD Checks**: Enforce standards in CI pipeline
- **Coverage Gates**: Block merges that decrease coverage
- **Performance Gates**: Block merges that degrade test performance

### Manual Enforcement

- **Code Reviews**: Reviewers must verify test quality
- **Team Reviews**: Regular team discussions about testing practices
- **Training**: Regular training on testing best practices
- **Documentation**: Keep testing documentation current

## Conclusion

These testing guidelines and standards ensure consistent, high-quality testing across the macro-ai monorepo. By following
these standards, we maintain code quality, prevent regressions, and enable confident development and refactoring.

For questions or clarifications about these standards, refer to the comprehensive testing guide or consult with the
development team.

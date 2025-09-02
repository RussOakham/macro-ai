# Testing Code Review Checklist

## Overview

This checklist ensures comprehensive and consistent review of test code changes. Use this checklist when reviewing pull requests that include test modifications or additions.

## Quick Reference

### ✅ **Must Have**

- [ ] All tests pass
- [ ] Coverage thresholds met
- [ ] Tests follow naming conventions
- [ ] Error scenarios tested
- [ ] Proper test isolation

### ⚠️ **Should Have**

- [ ] Realistic test data
- [ ] Performance considerations
- [ ] Documentation updated
- [ ] Integration tests for APIs

### 💡 **Nice to Have**

- [ ] Contract tests for external APIs
- [ ] Performance tests for critical paths
- [ ] Property-based tests for complex logic

## Detailed Review Criteria

## 1. Test Quality and Structure

### Test Organization

- [ ] **Test files are properly organized** in `__tests__/` directories
- [ ] **Naming conventions followed** (`*.test.ts`, `*.integration.test.ts`, `*.example.test.ts`)
- [ ] **Tests are grouped logically** using `describe` blocks
- [ ] **Test descriptions are clear** and behavior-focused

### Test Structure

- [ ] **Tests follow Arrange-Act-Assert pattern**

  ```typescript
  it('should calculate total correctly', () => {
  	// Arrange: Set up test data
  	const order = { items: [{ price: 10, quantity: 2 }] }

  	// Act: Execute function
  	const result = calculateTotal(order)

  	// Assert: Verify outcome
  	expect(result).toBe(20)
  })
  ```

- [ ] **Each test focuses on one behavior**
- [ ] **Tests are independent and can run in any order**
- [ ] **Setup and teardown are properly handled**

### Test Naming

- [ ] **Test names describe the expected behavior**

  ```typescript
  // ✅ Good
  it('should return 404 when user does not exist')
  it('should throw validation error for invalid email')

  // ❌ Bad
  it('should work')
  it('test getUserById')
  ```

## 2. Test Coverage and Completeness

### Coverage Requirements

- [ ] **Statement coverage ≥ 80%**
- [ ] **Branch coverage ≥ 75%**
- [ ] **Function coverage ≥ 80%**
- [ ] **Line coverage ≥ 80%**

### Coverage Quality

- [ ] **All business logic is tested**
- [ ] **All API endpoints have tests**
- [ ] **All error scenarios are covered**
- [ ] **Edge cases are tested**

### Missing Tests Check

- [ ] **New functions have corresponding tests**
- [ ] **Modified functions have updated tests**
- [ ] **Deleted code has removed obsolete tests**

## 3. Test Data and Mocking

### Test Data Quality

- [ ] **Uses test data factories** (`MockDataFactory.createUser()`)
- [ ] **Test data is realistic and varied**
- [ ] **No hardcoded test data scattered throughout tests**
- [ ] **Test data doesn't expose sensitive information**

```typescript
// ✅ Good: Using factories
const user = MockDataFactory.createUser({
	email: 'test@example.com',
})

// ❌ Bad: Hardcoded data
const user = {
	id: 'test-123',
	email: 'test@test.com',
}
```

### Mocking Strategy

- [ ] **External dependencies are properly mocked**
- [ ] **Mocks are realistic and maintain interface contracts**
- [ ] **Database operations use appropriate testing strategy** (real DB for integration, mocks for unit)
- [ ] **Time-dependent code uses fake timers**

```typescript
// ✅ Good: Proper mocking
vi.mock('../external-service', () => ({
	fetchData: vi.fn().mockResolvedValue(mockData),
}))

// ✅ Good: Time control
timeController.start()
timeController.advance(5000)
```

## 4. Assertions and Expectations

### Assertion Quality

- [ ] **Assertions are specific and meaningful**
- [ ] **Expected values are explicit, not just "truthy"**
- [ ] **Error messages are tested, not just error occurrence**
- [ ] **Response structure is validated**

```typescript
// ✅ Good: Specific assertions
expect(response.status).toBe(201)
expect(response.body.data.email).toBe('test@example.com')
expect(response.body.data.id).toMatch(/^[0-9a-f-]{36}$/)

// ❌ Bad: Vague assertions
expect(response).toBeTruthy()
expect(response.body).toBeDefined()
```

### Error Testing

- [ ] **Error scenarios are explicitly tested**
- [ ] **Error messages are validated**
- [ ] **Error types are correct**
- [ ] **Error recovery is tested where applicable**

```typescript
// ✅ Good: Comprehensive error testing
await expect(service.createUser({ email: 'invalid' })).rejects.toThrow(
	'Invalid email format',
)
```

## 5. Integration and API Testing

### API Test Requirements

- [ ] **All endpoints have integration tests**
- [ ] **Request/response validation is tested**
- [ ] **Authentication/authorization is tested**
- [ ] **Input validation is tested**

### Database Integration

- [ ] **Uses real database for integration tests**
- [ ] **Proper test isolation** (transactions or cleanup)
- [ ] **Migration compatibility tested**
- [ ] **Data consistency verified**

```typescript
// ✅ Good: Database integration
beforeAll(async () => {
	dbContext = await setupDatabaseIntegration()
})

afterAll(async () => {
	await cleanupGlobalResources()
})
```

## 6. Performance and Reliability

### Performance Considerations

- [ ] **Tests run in reasonable time** (< 1s for unit tests, < 10s for integration)
- [ ] **No unnecessary async operations**
- [ ] **Proper use of fake timers for time-dependent tests**
- [ ] **Database operations are optimized**

### Reliability

- [ ] **Tests are deterministic** (no random failures)
- [ ] **No race conditions**
- [ ] **Proper cleanup prevents test interference**
- [ ] **Timeouts are set for long-running operations**

## 7. Security Testing

### Security Test Coverage

- [ ] **Authentication flows are tested**
- [ ] **Authorization checks are verified**
- [ ] **Input sanitization is tested**
- [ ] **SQL injection protection is verified**

```typescript
// ✅ Required: Security testing
it('should reject SQL injection attempts', async () => {
	const maliciousInput = "'; DROP TABLE users; --"

	await request(app)
		.post('/api/users')
		.send({ firstName: maliciousInput })
		.expect(400)
})
```

## 8. Documentation and Comments

### Test Documentation

- [ ] **Test files have header comments** explaining purpose
- [ ] **Complex test logic is commented**
- [ ] **Setup requirements are documented**
- [ ] **Known limitations are noted**

### Code Comments

- [ ] **Complex assertions are explained**
- [ ] **Mock setup is documented**
- [ ] **Performance expectations are noted**
- [ ] **Security implications are highlighted**

## 9. Maintenance and Sustainability

### Test Maintainability

- [ ] **Tests are easy to understand and modify**
- [ ] **Test utilities are reused appropriately**
- [ ] **No code duplication in test setup**
- [ ] **Tests will remain valid after refactoring**

### Future Considerations

- [ ] **Tests support future feature additions**
- [ ] **Mock interfaces match real implementations**
- [ ] **Test data factories are extensible**
- [ ] **Performance baselines are established**

## 10. CI/CD Integration

### Pipeline Integration

- [ ] **Tests run successfully in CI environment**
- [ ] **Test results are properly reported**
- [ ] **Coverage reports are generated**
- [ ] **Failed tests block deployment**

### Environment Compatibility

- [ ] **Tests work across different environments**
- [ ] **Database tests use containerized environments**
- [ ] **External service mocks are environment-agnostic**

## Review Process Checklist

### Before Review

- [ ] **Run tests locally** to ensure they pass
- [ ] **Check coverage report** to verify thresholds
- [ ] **Review test output** for any warnings or issues
- [ ] **Verify CI pipeline** passes all checks

### During Review

- [ ] **Read test descriptions** to understand intent
- [ ] **Verify test logic** matches described behavior
- [ ] **Check for edge cases** and error scenarios
- [ ] **Validate test data quality** and realism
- [ ] **Assess performance impact** of new tests

### After Review

- [ ] **Confirm all feedback** has been addressed
- [ ] **Re-run tests** after changes
- [ ] **Update documentation** if needed
- [ ] **Merge only when all criteria met**

## Common Review Comments

### Test Quality Issues

```typescript
// 💬 "Test name should describe expected behavior"
// Instead of: it('should test user creation')
// Use: it('should return user with generated ID when creating with valid data')

// 💬 "Add error case testing"
// Add tests for invalid input, network failures, database errors

// 💬 "Use test data factories"
// Replace hardcoded data with MockDataFactory.createUser()

// 💬 "Add assertion for error message"
// Instead of: expect(() => fn()).toThrow()
// Use: expect(() => fn()).toThrow('Specific error message')
```

### Coverage Issues

```typescript
// 💬 "Add tests for uncovered branches"
// Ensure all if/else branches are tested

// 💬 "Test the error handling path"
// Add tests for catch blocks and error scenarios

// 💬 "Cover edge cases"
// Test boundary conditions, empty inputs, null values
```

### Performance Issues

```typescript
// 💬 "Use fake timers for time-dependent tests"
// Replace real timers with timeController.advance()

// 💬 "Mock external dependencies"
// Don't make real network calls in unit tests

// 💬 "Use transaction rollback for database tests"
// Avoid expensive database cleanup operations
```

## Approval Criteria

### Minimum Approval Requirements

- [ ] All tests pass locally and in CI
- [ ] Coverage thresholds are met or improved
- [ ] No decrease in overall test quality
- [ ] Security implications are addressed
- [ ] Performance impact is acceptable

### Quality Gates

- [ ] **Functionality**: Tests verify the intended behavior
- [ ] **Reliability**: Tests are stable and deterministic
- [ ] **Maintainability**: Tests are easy to understand and modify
- [ ] **Performance**: Tests run efficiently
- [ ] **Security**: Security scenarios are tested

### Final Checklist

- [ ] **All review comments addressed**
- [ ] **Tests pass in CI environment**
- [ ] **Coverage reports look good**
- [ ] **Documentation is updated**
- [ ] **Team is satisfied with test quality**

## Templates for Common Review Scenarios

### New Feature Review

```markdown
## Testing Review for [Feature Name]

### Test Coverage Analysis

- [ ] Unit tests for business logic: ✅/❌
- [ ] Integration tests for APIs: ✅/❌
- [ ] Error scenario coverage: ✅/❌
- [ ] Performance tests (if applicable): ✅/❌

### Quality Assessment

- [ ] Test names are descriptive: ✅/❌
- [ ] Realistic test data used: ✅/❌
- [ ] Proper mocking strategy: ✅/❌
- [ ] Documentation updated: ✅/❌

### Recommendations

- [ ] Add tests for edge case X
- [ ] Consider performance testing for critical path Y
- [ ] Update documentation to include new testing patterns
```

### Bug Fix Review

```markdown
## Testing Review for Bug Fix

### Regression Prevention

- [ ] Test reproduces the original bug: ✅/❌
- [ ] Test verifies the fix works: ✅/❌
- [ ] Related edge cases are tested: ✅/❌

### Quality Check

- [ ] Root cause is addressed in tests: ✅/❌
- [ ] Similar scenarios are covered: ✅/❌
- [ ] Test will catch future regressions: ✅/❌
```

## Conclusion

This checklist ensures that all test code meets our high standards for quality, maintainability, and effectiveness. By following this checklist consistently, we maintain a robust test suite that provides confidence in our code quality and enables safe refactoring and feature development.

Remember: The goal is not just to check boxes, but to ensure that tests provide real value and protect the codebase from regressions while supporting ongoing development.

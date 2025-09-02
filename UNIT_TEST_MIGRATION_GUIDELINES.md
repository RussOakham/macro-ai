# Unit Test Migration Guidelines

## Overview

This document provides detailed guidelines for migrating existing unit tests in the express-api to adopt the improved
testing methodologies from our Testing Improvement Plan. These guidelines are based on comprehensive analysis of current
test patterns and identify specific improvement opportunities.

## Current State Analysis Summary

### ✅ **Existing Strengths**

Based on analysis of 50+ test files:

- **Excellent foundation**: Comprehensive test coverage (92.34%) with 997+ tests
- **Consistent structure**: Well-organized describe/it blocks with clear test organization
- **Good mocking patterns**: Proper use of `vi.mock()` and mock helpers
- **Type safety**: Strong TypeScript integration with proper type definitions
- **Error handling**: Comprehensive error scenario testing
- **Business logic coverage**: Good coverage of core functionality

### 🔍 **Specific Improvement Opportunities Identified**

#### **1. Test Data Generation Patterns**

**Current Issues**:

- **Hardcoded test data**: Manual object creation with static values
- **Repetitive data setup**: Same test data patterns repeated across files
- **Limited realism**: Test data doesn't reflect real-world scenarios

**Examples from current tests**:

```typescript
// ❌ Current pattern in user.services.test.ts
const mockUser: TUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  emailVerified: true,
  firstName: 'John',
  lastName: 'Doe',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  lastLogin: new Date('2023-01-01'),
}
```

#### **2. Mock Setup Patterns**

**Current Issues**:

- **Manual mock creation**: Extensive boilerplate for each test file
- **Inconsistent mock patterns**: Different approaches across similar test files
- **Limited reusability**: Mock setup not easily shared between tests

**Examples from current tests**:

```typescript
// ❌ Current pattern in user.services.test.ts
const mockUserRepository: IUserRepository = {
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateLastLogin: vi.fn(),
  updateUser: vi.fn(),
}

const mockCognitoService = {
  getAuthUser: mockGetAuthUser,
  signUpUser: vi.fn(),
  confirmSignUp: vi.fn(),
  resendConfirmationCode: vi.fn(),
  signInUser: vi.fn(),
  signOutUser: vi.fn(),
  forgotPassword: vi.fn(),
  confirmForgotPassword: vi.fn(),
} as unknown as CognitoService
```

#### **3. Express Mocking Patterns**

**Current Issues**:

- **Custom Express mocks**: Manual creation instead of using node-mocks-http
- **Inconsistent request/response setup**: Different patterns across middleware tests
- **Limited Express behavior**: Mocks don't reflect real Express object behavior

**Examples from current tests**:

```typescript
// ❌ Current pattern in validation.middleware.test.ts
let mockRequest: Partial<Request>
let mockResponse: Partial<Response>
let mockNext: NextFunction

// Manual setup in beforeEach
const expressMocks = mockExpress.setup()
mockResponse = expressMocks.res
mockNext = expressMocks.next
```

#### **4. Parameterized Testing Gaps**

**Current Issues**:

- **Duplicate test cases**: Similar tests repeated with different values
- **No data-driven testing**: Limited use of `describe.each` or `it.each`
- **Validation test repetition**: Multiple similar validation scenarios

**Examples from current tests**:

```typescript
// ❌ Current pattern - duplicate test cases
it('should validate email format', () => {
  expect(validateEmail('valid@example.com')).toBe(true)
})

it('should reject invalid email', () => {
  expect(validateEmail('invalid')).toBe(false)
})

it('should reject empty email', () => {
  expect(validateEmail('')).toBe(false)
})
```

## Migration Guidelines

### **1. Test Data Generation Migration**

#### **Before (Current Pattern)**

```typescript
// ❌ Hardcoded test data
const mockUser: TUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  emailVerified: true,
  firstName: 'John',
  lastName: 'Doe',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  lastLogin: new Date('2023-01-01'),
}
```

#### **After (Improved Pattern)**

```typescript
// ✅ Faker-based test data
import { createMockData } from '../../../utils/test-helpers'

const mockUser = createMockData.user({
  email: 'test@example.com',
  emailVerified: true,
})
```

#### **Migration Steps**

1. **Import faker factories** from `@repo/config-testing` or local test helpers
2. **Replace hardcoded objects** with factory calls
3. **Use overrides** for specific test scenarios
4. **Remove manual test data creation**

#### **Benefits**

- **Realistic data**: Faker generates realistic test data
- **Reduced boilerplate**: 60-80% reduction in test data setup
- **Maintainability**: Centralized data generation logic
- **Consistency**: Standardized test data patterns

### **2. Enhanced Mocking Migration**

#### **Before (Current Pattern)**

```typescript
// ❌ Manual service mocking
const mockUserRepository: IUserRepository = {
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateLastLogin: vi.fn(),
  updateUser: vi.fn(),
}
```

#### **After (Improved Pattern)**

```typescript
// ✅ Enhanced service mocking
import { createMockUserService } from '../../../utils/test-helpers/enhanced-mocks'

const mockUserService = createMockUserService()
mockUserService.getUserById.mockResolvedValue([user, null])
```

#### **Migration Steps**

1. **Import enhanced mock utilities** from test helpers
2. **Replace manual mock creation** with utility functions
3. **Use TypeScript-safe mock methods**
4. **Leverage automatic type inference**

#### **Benefits**

- **Type safety**: Full TypeScript support with auto-completion
- **Reduced boilerplate**: 50-70% reduction in mock setup code
- **Consistency**: Standardized mock patterns across tests
- **Maintainability**: Centralized mock creation logic

### **3. Express Mocking Migration**

#### **Before (Current Pattern)**

```typescript
// ❌ Manual Express mocking
let mockRequest: Partial<Request>
let mockResponse: Partial<Response>
let mockNext: NextFunction

beforeEach(() => {
  const expressMocks = mockExpress.setup()
  mockResponse = expressMocks.res
  mockNext = expressMocks.next
})
```

#### **After (Improved Pattern)**

```typescript
// ✅ Professional Express mocking
import { createMockExpressObjects } from '../../../utils/test-helpers/enhanced-mocks'

const { req, res, next } = createMockExpressObjects({
  body: { email: 'test@example.com' },
  params: { id: '123' },
})
```

#### **Migration Steps**

1. **Import enhanced Express mocking utilities**
2. **Replace manual mock creation** with utility functions
3. **Use TypeScript-safe mock objects**
4. **Leverage built-in assertion helpers**

#### **Benefits**

- **Realistic behavior**: node-mocks-http provides real Express object behavior
- **Type safety**: Full TypeScript support
- **Reduced setup**: Simplified mock creation
- **Better testing**: More accurate Express object simulation

### **4. Parameterized Testing Migration**

#### **Before (Current Pattern)**

```typescript
// ❌ Duplicate test cases
it('should validate email format', () => {
  expect(validateEmail('valid@example.com')).toBe(true)
})

it('should reject invalid email', () => {
  expect(validateEmail('invalid')).toBe(false)
})

it('should reject empty email', () => {
  expect(validateEmail('')).toBe(false)
})
```

#### **After (Improved Pattern)**

```typescript
// ✅ Parameterized testing
describe.each([
  ['valid@example.com', true],
  ['invalid', false],
  ['', false],
  ['another@valid.com', true],
])('Email validation: %s', (email, expected) => {
  it(`should ${expected ? 'accept' : 'reject'} ${email}`, () => {
    expect(validateEmail(email)).toBe(expected)
  })
})
```

#### **Migration Steps**

1. **Identify duplicate test patterns**
2. **Group similar test cases**
3. **Create parameterized test arrays**
4. **Use `describe.each` or `it.each` for data-driven tests**

#### **Benefits**

- **Reduced duplication**: Eliminate repetitive test code
- **Better coverage**: Test more scenarios with less code
- **Maintainability**: Easier to add new test cases
- **Clarity**: Clear data-driven test structure

## Specific Migration Patterns by Test Type

### **Service Tests**

#### **Current Pattern Analysis**

- Manual repository mocking
- Hardcoded test data
- Repetitive error scenario setup
- Limited parameterized testing

#### **Migration Approach**

1. **Replace manual mocks** with enhanced mock utilities
2. **Use faker factories** for test data generation
3. **Implement parameterized testing** for validation scenarios
4. **Standardize error testing patterns**

#### **Example Migration**

```typescript
// Before
const mockUserRepository: IUserRepository = {
  findUserById: vi.fn(),
  // ... more manual mocks
}

const mockUser: TUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  // ... hardcoded data
}

// After
import { createMockUserService, createMockData } from '../../../utils/test-helpers'

const mockUserService = createMockUserService()
const mockUser = createMockData.user({ email: 'test@example.com' })
```

### **Middleware Tests**

#### **Current Pattern Analysis**

- Custom Express mock setup
- Manual request/response creation
- Repetitive validation testing
- Limited error scenario coverage

#### **Migration Approach**

1. **Use node-mocks-http** for Express object creation
2. **Implement parameterized testing** for validation scenarios
3. **Standardize error handling patterns**
4. **Enhance Express behavior simulation**

#### **Example Migration**

```typescript
// Before
let mockRequest: Partial<Request>
let mockResponse: Partial<Response>
let mockNext: NextFunction

beforeEach(() => {
  const expressMocks = mockExpress.setup()
  mockResponse = expressMocks.res
  mockNext = expressMocks.next
})

// After
import { createMockExpressObjects } from '../../../utils/test-helpers/enhanced-mocks'

const { req, res, next } = createMockExpressObjects({
  body: { email: 'test@example.com' },
  params: { id: '123' },
})
```

### **Utility Tests**

#### **Current Pattern Analysis**

- Manual crypto module mocking
- Hardcoded test values
- Repetitive error scenario setup
- Limited edge case testing

#### **Migration Approach**

1. **Use enhanced mock utilities** for complex dependencies
2. **Implement parameterized testing** for edge cases
3. **Standardize error testing patterns**
4. **Enhance test data generation**

#### **Example Migration**

```typescript
// Before
const mockCipher: MockCipher = {
  update: vi.fn().mockReturnValue('encrypted'),
  final: vi.fn().mockReturnValue('text'),
  getAuthTag: vi.fn().mockReturnValue(mockAuthTag),
}

// After
import { createEnhancedMock } from '../../../utils/test-helpers/enhanced-mocks'

const mockCipher = createEnhancedMock<MockCipher>()
mockCipher.update.mockReturnValue('encrypted')
mockCipher.final.mockReturnValue('text')
mockCipher.getAuthTag.mockReturnValue(mockAuthTag)
```

## Quality Gates and Validation

### **Pre-Migration Checklist**

- [ ] **Identify test file type** (service, middleware, utility)
- [ ] **Analyze current patterns** and improvement opportunities
- [ ] **Plan migration approach** based on test type
- [ ] **Identify dependencies** and mock requirements

### **During Migration Checklist**

- [ ] **Replace hardcoded test data** with faker factories
- [ ] **Implement enhanced mocking** utilities
- [ ] **Add parameterized testing** where appropriate
- [ ] **Maintain test coverage** and functionality
- [ ] **Validate test execution** and results

### **Post-Migration Validation**

- [ ] **Run test suite** and ensure all tests pass
- [ ] **Measure performance improvements** from parallel execution
- [ ] **Validate coverage metrics** and ensure no regression
- [ ] **Check for linting and type issues**
- [ ] **Document lessons learned** and improvements

## Success Metrics

### **Quantitative Improvements**

- **Mock boilerplate reduction**: 50-70% reduction in mock setup code
- **Test data setup reduction**: 60-80% reduction in test data boilerplate
- **Test execution time**: Maintain or improve current execution time
- **Test coverage**: Maintain 92.34%+ coverage, aim for 95%+

### **Qualitative Improvements**

- **Test maintainability**: Easier to read and modify tests
- **Test reliability**: More realistic test scenarios
- **Test consistency**: Standardized patterns across all test files
- **Developer experience**: Faster test writing and debugging

## Common Pitfalls and Solutions

### **Pitfall 1: Over-mocking**

**Problem**: Mocking too many dependencies, making tests unrealistic

**Solution**: Mock only external dependencies, use real implementations for internal logic

### **Pitfall 2: Inconsistent Migration**

**Problem**: Different migration approaches across similar test files

**Solution**: Follow standardized migration patterns and use shared utilities

### **Pitfall 3: Breaking Existing Tests**

**Problem**: Migration changes break existing test functionality

**Solution**: Migrate incrementally and validate at each step

### **Pitfall 4: Performance Regression**

**Problem**: New testing patterns slow down test execution

**Solution**: Monitor performance metrics and optimize as needed

## Next Steps

1. **Review and approve** these migration guidelines
2. **Begin pilot migration** with 2-3 representative test files
3. **Validate approach** and refine guidelines based on results
4. **Proceed with systematic migration** following the established plan
5. **Monitor progress** against success metrics

---

_These guidelines provide a structured approach to migrating existing unit tests while maintaining the excellent foundation
we already have. The focus is on incremental improvement with measurable benefits._

# Unit Test Inventory and Categorization

## Overview

This document provides a comprehensive inventory of all 50+ unit test files in the express-api, categorized by improvement
priority and migration complexity. This inventory serves as the foundation for our systematic migration plan.

## Test File Inventory

### **Total Test Files: 50**

**Breakdown by Category**:

- **High Priority (Core Business Logic)**: 20 files
- **Medium Priority (Middleware & Utilities)**: 18 files
- **Low Priority (Data Access & Routes)**: 12 files

## High Priority Tests (Core Business Logic)

### **Target: Week 2 Migration**

These tests cover core business logic and are critical for application functionality. They have the highest impact and
should be migrated first.

#### **Authentication Services (3 files)**

- `src/features/auth/__tests__/auth.services.test.ts` ✅ **Already well-structured**
- `src/features/auth/__tests__/auth.controller.test.ts`
- `src/features/auth/__tests__/auth.routes.test.ts`

**Current Patterns**:

- Manual Cognito service mocking
- Hardcoded user data
- Repetitive error scenario setup

**Improvement Opportunities**:

- Replace hardcoded test data with faker factories
- Implement enhanced service mocking
- Add parameterized testing for validation scenarios

#### **Chat Services (4 files)**

- `src/features/chat/__tests__/chat.service.test.ts` ✅ **Already well-structured**
- `src/features/chat/__tests__/ai.service.test.ts`
- `src/features/chat/__tests__/vector.service.test.ts`
- `src/features/chat/__tests__/chat.controller.test.ts`

**Current Patterns**:

- Manual AI service mocking
- Hardcoded chat data
- Limited parameterized testing

**Improvement Opportunities**:

- Implement enhanced AI service mocking
- Add realistic chat data generation
- Enhance error scenario testing

#### **User Services (3 files)**

- `src/features/user/__tests__/user.services.test.ts`
- `src/features/user/__tests__/user.controller.test.ts`
- `src/features/user/__tests__/user.routes.test.ts`

**Current Patterns**:

- Manual repository mocking
- Hardcoded user data
- Repetitive validation testing

**Improvement Opportunities**:

- Replace manual mocks with enhanced utilities
- Implement faker-based user data generation
- Add parameterized testing for validation

#### **Utility Services (2 files)**

- `src/features/utility/__tests__/utility.services.test.ts`
- `src/features/utility/__tests__/utility.controller.test.ts`

**Current Patterns**:

- Manual service mocking
- Hardcoded test data
- Limited error scenario coverage

**Improvement Opportunities**:

- Implement enhanced service mocking
- Add realistic test data generation
- Enhance error handling test coverage

#### **Core Utilities (8 files)**

- `src/utils/__tests__/crypto.test.ts`
- `src/utils/__tests__/cookies.test.ts`
- `src/utils/__tests__/environment-utils.test.ts`
- `src/utils/__tests__/response-handlers.test.ts`
- `src/utils/__tests__/server.test.ts`
- `src/utils/error-handling/__tests__/try-catch.test.ts`
- `src/config/env-config.test.ts`

**Current Patterns**:

- Manual crypto module mocking
- Hardcoded test values
- Repetitive error scenario setup

**Improvement Opportunities**:

- Use enhanced mock utilities for complex dependencies
- Implement parameterized testing for edge cases
- Standardize error testing patterns

## Medium Priority Tests (Middleware & Utilities)

### **Target: Week 3 Migration**

These tests cover middleware and utility functions. They have moderate impact and should be migrated after core business
logic.

#### **Middleware Tests (6 files)**

- `src/middleware/__tests__/auth.middleware.test.ts` ✅ **Already well-structured**
- `src/middleware/__tests__/validation.middleware.test.ts`
- `src/middleware/__tests__/rate-limit.middleware.test.ts`
- `src/middleware/__tests__/security-headers.middleware.test.ts`
- `src/middleware/__tests__/api-key.middleware.test.ts`
- `src/middleware/__tests__/error.middleware.test.ts`

**Current Patterns**:

- Custom Express mock setup
- Manual request/response creation
- Repetitive validation testing

**Improvement Opportunities**:

- Use node-mocks-http for Express object creation
- Implement parameterized testing for validation scenarios
- Standardize error handling patterns

#### **Route Tests (3 files)**

- `src/router/__tests__/index.routes.test.ts`
- `src/features/utility/__tests__/utility.routes.test.ts`
- `src/features/user/__tests__/user.routes.test.ts`

**Current Patterns**:

- Manual route mocking
- Hardcoded request data
- Limited integration testing

**Improvement Opportunities**:

- Implement enhanced route mocking
- Add realistic request data generation
- Enhance integration testing patterns

#### **Test Helper Examples (9 files)**

- `src/utils/test-helpers/__tests__/enhanced-mocks.example.test.ts`
- `src/utils/test-helpers/__tests__/parameterized-testing.example.test.ts`
- `src/utils/test-helpers/__tests__/api-integration.example.test.ts`
- `src/utils/test-helpers/__tests__/database-integration.example.test.ts`
- `src/utils/test-helpers/__tests__/msw-basic.example.test.ts`
- `src/utils/test-helpers/__tests__/msw-simple.test.ts`
- `src/utils/test-helpers/__tests__/pact-contract.example.test.ts`
- `src/utils/test-helpers/__tests__/express-mocks.example.test.ts`
- `src/utils/test-helpers/__tests__/cognito-service.mock.example.test.ts`

**Current Patterns**:

- Example implementations
- Demonstration patterns
- Reference implementations

**Improvement Opportunities**:

- Update examples to reflect new patterns
- Ensure consistency with migration guidelines
- Validate example implementations

## Low Priority Tests (Data Access & Routes)

### **Target: Week 4 Migration**

These tests cover data access and route functionality. They have lower impact and can be migrated last.

#### **Data Access Tests (4 files)**

- `src/features/chat/__tests__/chat.data-access.test.ts`
- `src/features/chat/__tests__/message.data-access.test.ts`
- `src/features/chat/__tests__/vector.data-access.test.ts`
- `src/features/user/__tests__/user.data-access.test.ts`

**Current Patterns**:

- Manual database mocking
- Hardcoded test data
- Limited error scenario coverage

**Improvement Opportunities**:

- Implement database integration testing patterns
- Add realistic test data generation
- Enhance error scenario coverage

#### **Integration Tests (1 file)**

- `src/features/chat/__tests__/chat.routes.integration.test.ts`

**Current Patterns**:

- Basic integration testing
- Limited error scenario coverage

**Improvement Opportunities**:

- Enhance integration testing patterns
- Add comprehensive error scenario testing

#### **Mock Helper Tests (7 files)**

- `src/utils/test-helpers/__tests__/config.mock.test.ts`
- `src/utils/test-helpers/__tests__/error-handling.mock.test.ts`
- `src/utils/test-helpers/__tests__/drizzle-db.mock.test.ts`
- `src/utils/test-helpers/__tests__/chat-service.mock.example.test.ts`
- `src/utils/test-helpers/__tests__/utility-service.mock.example.test.ts`
- `src/utils/test-helpers/__tests__/user-service.mock.example.test.ts`
- `src/utils/test-helpers/__tests__/logger.mock.example.test.ts`

**Current Patterns**:

- Mock implementation tests
- Example implementations
- Reference implementations

**Improvement Opportunities**:

- Update mock implementations
- Ensure consistency with new patterns
- Validate mock functionality

## Migration Priority Matrix

### **Priority 1: Critical Business Logic (Week 2)**

- **Impact**: High
- **Complexity**: Medium
- **Files**: 20
- **Focus**: Core functionality, user-facing features

### **Priority 2: Middleware & Utilities (Week 3)**

- **Impact**: Medium
- **Complexity**: Low-Medium
- **Files**: 18
- **Focus**: Infrastructure, supporting functionality

### **Priority 3: Data Access & Routes (Week 4)**

- **Impact**: Low-Medium
- **Complexity**: Low
- **Files**: 12
- **Focus**: Data layer, route functionality

## Common Patterns Analysis

### **Pattern 1: Manual Mock Creation**

**Files Affected**: 35+ files
**Current Approach**: Manual mock object creation
**Improvement**: Use enhanced mock utilities

### **Pattern 2: Hardcoded Test Data**

**Files Affected**: 40+ files
**Current Approach**: Static test data objects
**Improvement**: Use faker factories

### **Pattern 3: Custom Express Mocking**

**Files Affected**: 15+ files
**Current Approach**: Manual Express object creation
**Improvement**: Use node-mocks-http

### **Pattern 4: Limited Parameterized Testing**

**Files Affected**: 25+ files
**Current Approach**: Duplicate test cases
**Improvement**: Use `describe.each` and `it.each`

### **Pattern 5: Repetitive Error Testing**

**Files Affected**: 30+ files
**Current Approach**: Manual error scenario setup
**Improvement**: Standardize error testing patterns

## Migration Complexity Assessment

### **Low Complexity (15 files)**

- Simple utility functions
- Basic mock implementations
- Example test files

### **Medium Complexity (25 files)**

- Service layer tests
- Middleware tests
- Controller tests

### **High Complexity (10 files)**

- Complex service integrations
- Database access tests
- Integration tests

## Success Metrics by Category

### **High Priority Tests**

- **Target**: 70% reduction in mock boilerplate
- **Target**: 80% reduction in test data setup
- **Target**: 50% increase in parameterized testing

### **Medium Priority Tests**

- **Target**: 60% reduction in mock boilerplate
- **Target**: 70% reduction in test data setup
- **Target**: 40% increase in parameterized testing

### **Low Priority Tests**

- **Target**: 50% reduction in mock boilerplate
- **Target**: 60% reduction in test data setup
- **Target**: 30% increase in parameterized testing

## Next Steps

1. **Begin with Priority 1** (High Priority Tests)
2. **Start with pilot migration** of 2-3 representative files
3. **Validate approach** and refine guidelines
4. **Proceed systematically** through each priority level
5. **Monitor progress** against success metrics

---

_This inventory provides a comprehensive foundation for our systematic migration approach, ensuring we prioritize the most
impactful improvements while maintaining our excellent test coverage._

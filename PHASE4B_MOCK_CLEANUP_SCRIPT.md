# Phase 4B.1: Mock Cleanup Standardization Script

**Date**: September 1, 2025  
**Status**: Implementation Ready  
**Purpose**: Systematically remove redundant manual `vi.clearAllMocks()` calls from test files that already use test helper
setup functions

## Files Successfully Updated ✅

1. `apps/express-api/src/middleware/__tests__/validation.middleware.test.ts`
2. `apps/express-api/src/utils/__tests__/response-handlers.test.ts`
3. `apps/express-api/src/middleware/__tests__/security-headers.middleware.test.ts`
4. `apps/express-api/src/middleware/__tests__/rate-limit.middleware.test.ts`
5. `apps/express-api/src/middleware/__tests__/auth.middleware.test.ts`
6. `apps/express-api/src/utils/__tests__/server.test.ts`
7. `apps/express-api/src/utils/__tests__/crypto.test.ts`

## Files Remaining to Update

### **High Priority - Files Using Test Helper Setup Functions**

These files have both manual `vi.clearAllMocks()` and test helper setup functions:

1. `apps/express-api/src/features/auth/__tests__/auth.routes.test.ts`
2. `apps/express-api/src/features/auth/__tests__/auth.services.test.ts`
3. `apps/express-api/src/features/chat/__tests__/ai.service.test.ts`
4. `apps/express-api/src/features/chat/__tests__/vector.service.test.ts`
5. `apps/express-api/src/features/chat/__tests__/vector.data-access.test.ts`
6. `apps/express-api/src/features/chat/__tests__/chat.service.test.ts`
7. `apps/express-api/src/features/chat/__tests__/message.data-access.test.ts`
8. `apps/express-api/src/features/chat/__tests__/chat.data-access.test.ts`
9. `apps/express-api/src/features/user/__tests__/user.services.test.ts`
10. `apps/express-api/src/features/user/__tests__/user.routes.test.ts`
11. `apps/express-api/src/features/user/__tests__/user.data-access.test.ts`
12. `apps/express-api/src/features/utility/__tests__/utility.services.test.ts`
13. `apps/express-api/src/router/__tests__/index.routes.test.ts`
14. `apps/express-api/src/utils/error-handling/__tests__/try-catch.test.ts`

### **Medium Priority - Files with Appropriate Manual Cleanup**

These files use manual `vi.clearAllMocks()` appropriately (no test helpers needed):

1. `apps/express-api/src/config/env-config.test.ts` - Simple config test, no Express mocks needed
2. `apps/express-api/src/utils/__tests__/cookies.test.ts` - Simple utility test, no Express mocks needed
3. `apps/express-api/src/utils/__tests__/environment-utils.test.ts` - Environment utility test

### **Low Priority - Test Helper Files**

These files are part of the test helper system itself:

1. `apps/express-api/src/utils/test-helpers/error-handling.mock.ts`
2. `apps/express-api/src/utils/test-helpers/logger.mock.ts`
3. `apps/express-api/src/utils/test-helpers/parameter-store.mock.ts`
4. `apps/express-api/src/utils/test-helpers/config.mock.ts`
5. `apps/express-api/src/utils/test-helpers/express-mocks.ts`
6. `apps/express-api/src/utils/test-helpers/chat-service.mock.ts`
7. `apps/express-api/src/utils/test-helpers/utility-service.mock.ts`
8. `apps/express-api/src/utils/test-helpers/user-service.mock.ts`
9. `apps/express-api/src/utils/test-helpers/drizzle-db.mock.ts`
10. `apps/express-api/src/utils/test-helpers/cognito-service.mock.ts`

### **Documentation Files**

1. `apps/express-api/src/utils/test-helpers/README.md` - Documentation, not code

## Implementation Strategy

### **Phase 4B.1.1: Update High Priority Files**

For each file in the "High Priority" list:

1. **Identify the pattern**:

   ```typescript
   beforeEach(() => {
   	vi.clearAllMocks() // ← Remove this line
   	vi.resetModules()

   	// Setup test helpers (already includes vi.clearAllMocks())
   	const mocks = mockExpress.setup()
   	// ... rest of setup
   })
   ```

2. **Update to**:

   ```typescript
   beforeEach(() => {
   	vi.resetModules()

   	// Setup test helpers (includes vi.clearAllMocks())
   	const mocks = mockExpress.setup()
   	// ... rest of setup
   })
   ```

3. **Add comment** explaining that cleanup is handled by test helpers

### **Phase 4B.1.2: Verify Changes**

After each batch of updates:

1. Run tests to ensure functionality is preserved
2. Check for any linting errors
3. Verify that mock cleanup is still working correctly

### **Phase 4B.1.3: Update Documentation**

Update the test helper README to clarify that setup functions handle cleanup automatically.

## Expected Benefits

1. **Reduced Boilerplate**: Eliminate redundant `vi.clearAllMocks()` calls
2. **Consistency**: All tests use the same cleanup pattern via test helpers
3. **Maintainability**: Changes to cleanup logic only need to be made in test helpers
4. **Clarity**: Comments make it clear that cleanup is handled automatically

## Risk Mitigation

1. **Incremental Updates**: Update files in small batches
2. **Test Verification**: Run tests after each batch to ensure functionality is preserved
3. **Rollback Plan**: Git commits allow easy rollback if issues arise
4. **Documentation**: Clear comments explain the cleanup pattern

## Success Metrics

- **Before**: 46 files using manual `vi.clearAllMocks()`
- **After**: ~15 files using manual `vi.clearAllMocks()` (only where appropriate)
- **Improvement**: ~67% reduction in redundant cleanup code
- **Test Pass Rate**: Maintain 100% test pass rate throughout updates

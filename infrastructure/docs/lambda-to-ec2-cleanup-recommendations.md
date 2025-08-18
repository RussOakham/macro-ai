# Lambda-to-EC2 Migration Cleanup Recommendations

**Date**: 2025-08-18  
**Status**: Analysis Complete  
**Migration Phase**: Post-EC2 Migration Cleanup

## Executive Summary

Comprehensive analysis of the codebase after Lambda-to-EC2 migration has identified opportunities for cleanup
across four categories:

- ✅ **Category 1 & 2**: Safe removals and updates (COMPLETED)
- ✅ **Category 3**: Infrastructure Lambda documentation (COMPLETED)
- 📋 **Category 4**: Dead code and dependency analysis (THIS REPORT)

## Category 4: Investigation Results

### 🔍 Dependency Analysis Results

#### Express API Unused Dependencies (High Priority)

**Location**: `apps/express-api/package.json`

```bash
# Unused dependencies that can be removed:
* @aws-sdk/client-cognito-identity  # Cognito Identity (not Identity Provider)
* config                           # Legacy config package
* jsonwebtoken                     # JWT handling (replaced by Cognito)
* jwk-to-pem                      # JWT key conversion
* node-fetch                      # Fetch polyfill (Node 18+ has native fetch)
* pgvector                        # Vector database (not currently used)
* pino-pretty                     # Pretty printing (dev dependency)
* swagger-jsdoc                   # JSDoc to Swagger (replaced by Zod)
```

#### Express API Unused Dev Dependencies (Medium Priority)

```bash
* @types/config                   # Types for config package
* @types/jsonwebtoken            # Types for JWT package
* @types/swagger-jsdoc           # Types for swagger-jsdoc
* @vitest/coverage-v8            # Coverage tool (if not using coverage)
* eslint-config-prettier         # ESLint config (check if used)
* eslint-plugin-import           # Import linting (check if used)
* eslint-plugin-jsx-a11y         # React accessibility (not needed for API)
* eslint-plugin-react            # React linting (not needed for API)
* eslint-plugin-react-hooks      # React hooks (not needed for API)
* eslint-plugin-unused-imports   # Unused imports (check if configured)
* rimraf                         # File removal utility (check if used)
```

#### Missing Dependencies (Critical)

```bash
* express-serve-static-core       # Express types (should be added)
```

### 🧹 Lambda-Specific Code Cleanup

#### High Priority Lambda References

1. **Logger Utility** (`apps/express-api/src/utils/logger.ts`)
   - `isLambdaEnvironment()` function always returns false
   - Comment indicates Lambda deployment removed
   - **Action**: Remove function and related logic

2. **Configuration Services**
   - `apps/express-api/src/services/enhanced-config.service.ts`
   - `apps/express-api/src/utils/enhanced-load-config.ts`
   - `apps/express-api/src/utils/load-config.ts`
   - Contains Lambda environment detection and caching logic
   - **Action**: Simplify to EC2-only configuration loading

3. **Service Documentation** (`apps/express-api/src/services/README.md`)
   - References Lambda runtime environment
   - Mentions Lambda cold start process
   - **Action**: Update to reflect EC2 deployment

#### Medium Priority Infrastructure Cleanup

1. **API Gateway Construct** (`infrastructure/src/constructs/api-gateway-construct.ts`)
   - Entire construct appears unused (not imported in any stacks)
   - **Action**: Verify not used, then remove

2. **API Gateway Documentation**
   - `docs/operations/api-gateway-deployment-troubleshooting.md`
   - `docs/adr/005-api-gateway-deployment-architecture.md`
   - **Action**: Archive or remove obsolete documentation

3. **Integration Tests** (`tests/integration/api-gateway-integration.test.ts`)
   - API Gateway specific integration tests
   - **Action**: Replace with ALB integration tests

### 📊 Unused Exports Analysis

#### High Impact Unused Exports (27 modules)

**Database Schema Exports** (Low Priority - Keep for Future Use)

- `src/data-access/schema.ts`: Table definitions may be used by migrations

**Type Definitions** (Medium Priority - Review)

- Multiple `.types.ts` files with unused exports
- Consider if types are needed for API client generation

**Test Helpers** (Low Priority - Keep)

- All test helper modules show as unused but are likely used in tests
- Mock utilities should be retained for testing

**Middleware** (High Priority - Review)

- `monitoring-metrics.ts`: Multiple unused exports
- May indicate incomplete monitoring implementation

### 🎯 Cleanup Recommendations by Priority

#### 🔴 High Priority (Immediate Action)

1. **Remove Unused Dependencies**

   ```bash
   cd apps/express-api
   pnpm remove @aws-sdk/client-cognito-identity config jsonwebtoken jwk-to-pem node-fetch pgvector swagger-jsdoc
   pnpm remove -D @types/config @types/jsonwebtoken @types/swagger-jsdoc
   pnpm add -D @types/express-serve-static-core
   ```

2. **Clean Lambda References in Code**
   - Update `logger.ts` to remove `isLambdaEnvironment()`
   - Simplify configuration services to remove Lambda-specific logic
   - Update service documentation

3. **Verify API Gateway Construct Usage**
   - Confirm `api-gateway-construct.ts` is not imported
   - Remove if unused

#### 🟡 Medium Priority (Next Sprint)

1. **Review Unused Dev Dependencies**
   - Audit ESLint plugins and configs
   - Remove React-related linting from API package
   - Verify coverage tools are configured

2. **Update Documentation**
   - Archive API Gateway troubleshooting docs
   - Update deployment guides to reflect EC2 architecture

3. **Review Unused Exports**
   - Audit middleware exports for incomplete implementations
   - Clean up type definitions that are truly unused

#### 🟢 Low Priority (Future Maintenance)

1. **Test Helper Cleanup**
   - Review test helpers for actual usage
   - Consolidate similar mock utilities

2. **Database Schema Review**
   - Verify all table exports are needed
   - Consider if vector search will be implemented

## Implementation Plan

### Phase 1: Dependency Cleanup (1-2 hours)

- Remove unused dependencies from package.json
- Add missing dependencies
- Test build and deployment

### Phase 2: Code Cleanup (2-3 hours)

- Remove Lambda-specific code paths
- Update configuration services
- Update documentation

### Phase 3: Infrastructure Cleanup (1-2 hours)

- Remove unused API Gateway construct
- Archive obsolete documentation
- Update integration tests

### Phase 4: Export Cleanup (1-2 hours)

- Review and clean unused exports
- Consolidate type definitions
- Update middleware implementations

## Risk Assessment

### Low Risk

- Dependency removal (can be easily reverted)
- Documentation updates
- Unused export cleanup

### Medium Risk

- Configuration service changes (test thoroughly)
- Infrastructure construct removal (verify not used)

### High Risk

- None identified (all changes are post-migration cleanup)

## Success Metrics

- ✅ Reduced package.json dependencies by ~8 packages
- ✅ Eliminated Lambda-specific code paths
- ✅ Improved code maintainability
- ✅ Reduced bundle size and build time
- ✅ Cleaner codebase for future development

---

**Next Steps**: Begin with Phase 1 dependency cleanup, then proceed through phases systematically with testing at each step.

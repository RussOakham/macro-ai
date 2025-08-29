# Codebase Cleanup Audit Report

**Branch**: `cleanup/codebase-audit-and-cleanup`  
**Date**: January 2025  
**Status**: Ready for Planning

---

## 📊 Executive Summary

This audit identifies **193 markdown files**, **202 TypeScript files**, and **59 shell scripts** across the monorepo.
While the codebase passes linting and type-checking, there are significant opportunities for cleanup,
consolidation, and
modernization.

**Key Findings**:

- **Documentation Overload**: 193 markdown files with potential duplication and outdated content
- **Legacy Infrastructure**: EC2-based deployment documentation still present despite ECS migration
- **Unused Dependencies**: Several devDependencies identified as unused
- **Console Logging**: Multiple console.log statements in production code
- **TODO Items**: 15+ incomplete implementation markers
- **Package Duplication**: `types-macro-ai-api` package appears to be legacy

---

## 🔍 Detailed Findings

### 1. Dead Code & Unused Dependencies

#### Unused Files (26 files identified by knip)

**High Priority - Infrastructure (8 files)**:

- `infrastructure/src/app.ts` - Main CDK app file
- `infrastructure/src/constructs/ecs-fargate-construct.ts` - ECS construct
- `infrastructure/src/constructs/ecs-load-balancer-construct.ts` - Load balancer construct
- `infrastructure/src/constructs/environment-config-construct.ts` - Environment config
- `infrastructure/src/constructs/networking.ts` - Networking construct
- `infrastructure/src/constructs/parameter-store-construct.ts` - Parameter store
- `infrastructure/src/stacks/macro-ai-preview-stack.ts` - Preview stack
- `infrastructure/src/utils/tagging-strategy.ts` - Tagging utilities

**Medium Priority - API Client (3 files)**:

- `packages/macro-ai-api-client/src/clients/index.ts` - Client exports
- `packages/macro-ai-api-client/src/clients/unified.client.ts` - Unified client
- `packages/macro-ai-api-client/src/schemas/index.ts` - Schema exports

**Medium Priority - Express API (5 files)**:

- `apps/express-api/scripts/test-streaming.js` - Test script
- `apps/express-api/src/config/config.ts` - Config file
- `apps/express-api/src/config/simple-env.ts` - Simple env config
- `apps/express-api/src/middleware/monitoring-metrics.ts` - Monitoring middleware
- `apps/express-api/src/types/validation.types.ts` - Validation types

**Low Priority - Client UI (10 files)**:

- Various UI components and utilities that appear unused

#### Unused Dependencies (35 packages identified by knip)

**Client UI (8 unused dependencies)**:

- `@aws-sdk/client-cognito-identity-provider` - Cognito client
- `@tailwindcss/vite` - Tailwind Vite plugin
- `@tanstack/zod-adapter` - Zod adapter
- `next-themes` - Theme management
- `pino-pretty` - Logging prettifier
- `zod-validation-error` - Validation error handling
- `zustand` - State management

**Express API (9 unused dependencies)**:

- `@aws-sdk/client-cloudwatch` - CloudWatch client
- `@aws-sdk/client-cognito-identity` - Cognito identity
- `config` - Configuration package
- `jsonwebtoken` - JWT handling
- `jwk-to-pem` - JWK conversion
- `node-fetch` - HTTP client
- `on-finished` - Request lifecycle
- `pgvector` - Vector database
- `swagger-jsdoc` - Swagger documentation

**Infrastructure (20 unused dependencies)**:

- Multiple AWS SDK clients (EC2, S3, Lambda, etc.)
- `aws-cdk-lib` - CDK library
- `chalk` - Terminal colors
- `cli-table3` - CLI tables
- `commander` - CLI argument parsing
- `constructs` - CDK constructs
- `dotenv` - Environment loading
- `ora` - Terminal spinners

#### Unused DevDependencies (45 packages identified by knip)

**Root Package (10 unused devDependencies)**:

- `@types/yaml`, `@vitest/ui`, `depcheck`, `drizzle-kit`
- `eslint`, `ts-unused-exports`, `tsx`, `unimported`, `vitest`, `yaml`

**Client UI (9 unused devDependencies)**:

- Testing libraries, ESLint plugins, React compiler plugin

**Express API (7 unused devDependencies)**:

- Type definitions, ESLint plugins, testing utilities

**Infrastructure (6 unused devDependencies)**:

- ESLint configurations and plugins

**Config Packages (13 unused devDependencies)**:

- Various ESLint plugins and configurations across packages

**Recommendation**: These are concrete findings from knip analysis. Prioritize removal based on package usage and
business impact.

#### Updated Knip Analysis - After Infrastructure Workspace Inclusion

**Status**: Infrastructure workspace now included in knip.json, but 8 infrastructure files still show as unused.

**Key Findings**:

- **Infrastructure files still unused**: 8 files not imported anywhere
- **CDK entry point issue**: `infrastructure/src/app.ts` not imported
- **Previous deployment remnants**: Likely Lambda/EC2 code that can be removed
- **Action required**: Verify if these files are actually used in ECS deployment process

#### Additional Knip Findings

**Unused Exports (32 exports)**:

- **Express API**: Configuration functions, error handling utilities
- **Client UI**: Auth utilities, validation functions, chat utilities
- **Impact**: These exports are defined but never imported, indicating dead code

**Unused Exported Types (21 types)**:

- **Chat System**: Chat schemas, message types, vector types
- **API Clients**: Client type definitions
- **Validation**: API response types, error types
- **Impact**: Type definitions that aren't used in the codebase

**Unlisted Dependencies (3 packages)**:

- `@typescript-eslint/utils` - ESLint utilities
- `postcss-load-config` - PostCSS configuration

**Unlisted Binaries (8 commands)**:

- `cdk` - CDK CLI commands in GitHub workflows
- `generate-swagger` - Swagger generation script
- `scripts/github-actions-deploy.sh` - Deployment script

**Configuration Hints (70 suggestions)**:

- **Knip Configuration**: Multiple workspace configurations need refinement
- **Entry Patterns**: Some entry patterns don't match actual files
- **Project Patterns**: Redundant project file patterns
- **Ignore Dependencies**: Several packages should be removed from ignoreDependencies

#### Legacy Package: `types-macro-ai-api`

- **Location**: `packages/types-macro-ai-api/`
- **Status**: Only contains compiled output (`dist/` folder)
- **Issue**: No source code, no package.json, appears abandoned
- **Impact**: Confusion about which types package to use

**Recommendation**: Remove entirely - `macro-ai-api-client` handles types.

### 2. Documentation Cleanup Opportunities

#### Documentation Volume Analysis

- **Total Markdown Files**: 193
- **Shell Scripts**: 59
- **Documentation Ratio**: ~1.5 docs per source file

#### Potential Duplication Areas

1. **Deployment Documentation**
   - `DOCKER_ECS_MIGRATION_TASKLIST.md` (290 lines) - Very detailed
   - `docs/deployment/` directory - Multiple deployment guides
   - `AMPLIFY_DEPLOYMENT.md` - Legacy Amplify documentation
   - `DOCKER.md` - Docker-specific documentation

2. **Integration Guides**
   - `CLIENT_UI_SCHEMA_INTEGRATION.md`
   - `INTEGRATION_GUIDE.md`
   - `docs/integration/` directory

3. **API Client Documentation**
   - `SCHEMA_INFERENCE_REFACTOR.md`
   - `IMPLEMENTATION_SUMMARY.md`
   - `AUTO_GENERATION_SUMMARY.md`
   - `TYPES_USAGE_EXAMPLE.md`

#### Legacy Documentation to Review

- **EC2 Deployment**: Still referenced despite ECS migration
- **Amplify**: May be outdated if not actively using Amplify
- **Migration Task Lists**: Should be archived after completion

### 3. Code Quality Issues

#### Console Logging in Production Code

**Files with console.log statements**:

- `scripts/resolve-catalog-references.ts` (20+ instances)
- `tests/integration/*.test.ts` (Multiple files)
- `packages/macro-ai-api-client/scripts/*.ts` (Multiple files)
- `apps/express-api/config/default.ts`

**Recommendation**: Replace with proper logging (pino) in production code.

#### TODO Items Requiring Attention

**High Priority**:

- `infrastructure/src/constructs/ecs-fargate-construct.ts:218` - Type issues
- `apps/express-api/src/features/utility/utility.services.ts:445` - Database config
- `apps/express-api/src/features/utility/utility.services.ts:455` - Database ping

**Medium Priority**:

- `apps/express-api/src/features/chat/vector.data-access.ts:183` - Semantic search
- `apps/express-api/src/features/chat/vector.service.ts:172` - Semantic search

**Low Priority**:

- Disk space monitoring
- OpenAI API ping
- Redis ping

### 4. Infrastructure & Configuration

#### Environment Configuration

- **Multiple .env files**: `env.build.preview.example`, `env.local.example`, `env.runtime.preview.example`
- **Parameter Store**: Still using runtime access in some areas
- **Docker**: Environment injection working but may have legacy patterns

#### Script Consolidation

**Root Scripts**:

- `resolve-catalog-references.ts` - Complex script that may be overkill
- `validate-workflow-integration.sh` - 536 lines, may have duplication

**Package Scripts**:

- Multiple build scripts across packages
- Potential for consolidation using Turborepo

### 5. Feature Duplication Analysis

#### API Client Generation

- **Current**: `macro-ai-api-client` package with comprehensive generation
- **Legacy**: `types-macro-ai-api` package (empty)
- **Duplication**: Multiple documentation files for same functionality

#### Testing Infrastructure

- **Integration Tests**: Comprehensive but may have overlapping coverage
- **Test Setup**: Multiple vitest.setup.ts files with similar configurations

---

## 🎯 Cleanup Priorities

### Phase 1: High Impact, Low Risk (Week 1)

1. **Remove Legacy Package**: `types-macro-ai-api`
2. **Clean Console Logs**: Replace with proper logging in production code
3. **Consolidate .env Files**: Reduce to essential examples
4. **Remove Deprecated Scripts**: Clean up unused build/deployment scripts
5. **Remove Unused Dependencies**: 35 packages identified by knip
6. **Remove Unused DevDependencies**: 45 packages identified by knip
7. **Clean Unused Files**: 26 files identified by knip (prioritize infrastructure)

### Phase 2: Medium Impact, Medium Risk (Week 2)

1. **Documentation Consolidation**: Merge duplicate deployment guides
2. **TODO Resolution**: Address high-priority incomplete implementations
3. **Script Optimization**: Consolidate similar functionality
4. **Dependency Audit**: Remove truly unused devDependencies

### Phase 3: High Impact, High Risk (Week 3)

1. **Infrastructure Documentation**: Update for ECS-only deployment
2. **API Client Documentation**: Consolidate into single source of truth
3. **Testing Infrastructure**: Optimize and deduplicate
4. **Configuration Management**: Standardize across packages

### Phase 4: Testing Cleanup - Final Phase (Week 4)

1. **Fix Skipped Tests**: Address 7 skipped test suites
2. **Review Edge Case Tests**: Evaluate 15+ test suites against testing rules
3. **Remove Non-Compliant Tests**: Eliminate contrived scenarios
4. **Testing Rules Compliance**: Ensure all tests align with CLAUDE.md guidelines

---

## 🛠️ Recommended Tools & Approaches

### Code Analysis Tools

1. **Knip**: Already configured, use for export analysis
2. **Depcheck**: Identify unused dependencies
3. **ESLint**: Enforce no-console rule in production code
4. **TypeScript**: Use strict mode to catch unused imports

### Documentation Tools

1. **Markdown Lint**: Already configured, enforce consistency
2. **Link Checker**: Verify internal documentation links
3. **Template System**: Create standardized documentation templates

### Automation

1. **Pre-commit Hooks**: Prevent new console.log statements
2. **CI/CD Checks**: Automated dependency and documentation validation
3. **Script Generation**: Use Turborepo for consistent build processes

---

## 📋 Action Items

### Immediate Actions (This Week)

- [ ] **Audit `types-macro-ai-api` package** - Confirm it's unused
- [x] **Run knip analysis** - ✅ **COMPLETED** - Found 26 unused files, 35 unused dependencies, 45 unused devDependencies
- [ ] **Identify console.log usage** - Create replacement plan
- [ ] **Review TODO items** - Prioritize by business impact
- [ ] **Prioritize infrastructure cleanup** - 8 unused infrastructure files identified
- [ ] **Review API client exports** - 3 unused files in macro-ai-api-client package
- [x] **Fix knip configuration** - ✅ **COMPLETED** - Infrastructure workspace now included
- [ ] **Investigate infrastructure files** - 8 files still marked as unused - may be actual dead code
- [ ] **Verify ECS deployment usage** - Check if infrastructure files are actually used in deployment
- [ ] **Identify deprecated infrastructure** - Look for Lambda/EC2 legacy code

### Week 1 Goals

- [ ] **Remove legacy package** - `types-macro-ai-api`
- [ ] **Clean console statements** - Replace with proper logging
- [ ] **Consolidate .env files** - Reduce to 2-3 essential examples
- [ ] **Update documentation** - Remove EC2 references

### Week 2 Goals

- [ ] **Consolidate deployment docs** - Merge duplicate guides
- [ ] **Optimize scripts** - Remove unused, consolidate similar
- [ ] **Address high-priority TODOs** - Database and API implementations
- [ ] **Dependency cleanup** - Remove unused devDependencies

### Week 3 Goals

- [ ] **Infrastructure documentation** - ECS-only deployment
- [ ] **API client docs** - Single source of truth
- [ ] **Testing optimization** - Remove duplication
- [ ] **Configuration standardization** - Consistent patterns

### Week 4 Goals - Testing Cleanup

- [ ] **Fix skipped tests** - Address 7 skipped test suites
- [ ] **Review edge case tests** - Evaluate against testing rules
- [ ] **Remove non-compliant tests** - Eliminate contrived scenarios
- [ ] **Testing rules compliance** - Ensure alignment with CLAUDE.md guidelines

---

## 🚨 Risk Assessment

### Infrastructure Files - Deprecated Strategies Identified

**8 infrastructure files identified as unused by knip**:

- `infrastructure/src/app.ts` - **MAIN CDK APP FILE** - ECS Fargate deployment entry point
- `infrastructure/src/constructs/ecs-fargate-construct.ts` - **CURRENT** ECS Fargate construct
- `infrastructure/src/constructs/ecs-load-balancer-construct.ts` - **CURRENT** Load balancer construct
- `infrastructure/src/constructs/environment-config-construct.ts` - **CURRENT** Environment config
- `infrastructure/src/constructs/networking.ts` - **CURRENT** Networking construct
- `infrastructure/src/constructs/parameter-store-construct.ts` - **CURRENT** Parameter store
- `infrastructure/src/stacks/macro-ai-preview-stack.ts` - **CURRENT** Preview stack
- `infrastructure/src/utils/tagging-strategy.ts` - **CURRENT** Tagging utilities

**🔍 INVESTIGATION REQUIRED**: These files are still marked as unused even after including infrastructure workspace in 
knip.json. This suggests they may actually be dead code from previous deployment strategies:

1. **No imports found** - These files are not imported anywhere in the codebase
2. **Previous deployment strategies** - May be remnants from Lambda/EC2 deployments
3. **CDK entry point** - `infrastructure/src/app.ts` should be the main entry point but isn't imported
4. **Action required** - Verify if these files are actually used in current ECS deployment

**Immediate Action**: Check if these infrastructure files are actually imported or used in deployment processes.

### Deprecated Infrastructure Strategies

**Previous deployment strategies that can be cleaned up**:

- **Serverless Lambda**: Deprecated in favor of ECS Fargate
- **EC2**: Deprecated in favor of ECS Fargate
- **Amplify**: Legacy deployment method (check if still used)

**Files to investigate for deprecation**:

- Any files marked with `@deprecated` comments
- Legacy deployment scripts and documentation
- EC2-specific constructs and configurations
- Lambda function definitions

**Recommendation**: Remove deprecated infrastructure code after confirming it's not referenced by current deployments.

### Testing Cleanup - Align with Testing Rules

**Testing Rules from CLAUDE.md**:

- Focus on **realistic and valuable cases**, not exhaustive permutations
- Avoid contrived edge cases unless explicitly relevant to business logic
- Prioritize: Core logic correctness, Critical failure paths, Integration with external systems

#### Skipped Tests Requiring Action (7 test suites)

**Integration Tests**:

- `tests/integration/auth-integration.test.ts:114` - Authentication Integration Tests
- `tests/integration/config-loading-integration.test.ts:114` - Configuration Loading Integration Tests
- `tests/integration/cdk-pre-deployment-validation.test.ts:287` - CDK Pre-deployment Validation Tests
- `tests/integration/cdk-pre-deployment-validation.test.ts:319` - AWS Infrastructure Validation
- `tests/integration/database-integration.test.ts:94` - Database Integration Tests

**Unit Tests**:

- `apps/express-api/src/config/simple-config.test.ts:13` - Simple Configuration System
- `apps/express-api/src/config/simple-config.test.ts:56` - loadConfig function
- `apps/express-api/src/__tests__/index.test.ts:46` - Server Bootstrap (index.ts)

**Action Required**: Fix broken tests or remove if redundant/non-compliant with testing rules.

#### Tests Potentially Non-Compliant with Rules (15+ test suites)

**Edge Case Tests** - Review for business relevance:

- Response handlers, Crypto, Cookies, Routes, Middleware, Chat services, Auth services
- **Criteria**: Keep only if edge cases are critical to business logic
- **Remove**: Contrived scenarios not relevant to actual user workflows

**Recommendation**: Review each "edge case" test suite against business requirements before removal.

### Low Risk

- Removing unused packages
- Cleaning console statements
- Consolidating documentation

### Medium Risk

- Updating infrastructure documentation
- Modifying build scripts
- Changing configuration patterns

### High Risk

- Removing dependencies that may be used
- Changing deployment documentation
- Modifying core infrastructure code

---

## 📊 Success Metrics

### Code Quality

- **Console statements**: 0 in production code
- **TODO items**: 50% reduction
- **Unused dependencies**: 100% removal (35 packages identified)
- **Unused devDependencies**: 100% removal (45 packages identified)
- **Unused files**: 100% removal (26 files identified)
- **Unused exports**: 100% removal (32 exports identified)
- **Unused types**: 100% removal (21 types identified)

### Documentation

- **Markdown files**: 30% reduction through consolidation
- **Duplication**: 90% elimination
- **Accuracy**: 100% current with actual implementation

### Infrastructure

- **Legacy references**: 100% removal
- **Script consolidation**: 40% reduction
- **Configuration files**: 50% reduction

---

## 🔄 Next Steps

1. **Review this audit** with the team
2. **Prioritize cleanup phases** based on business impact
3. **Create detailed task breakdown** for each phase
4. **Set up automated checks** to prevent regression
5. **Schedule regular cleanup reviews** (monthly)

---

## 📚 References

- **Current Branch**: `cleanup/codebase-audit-and-cleanup`
- **Knip Configuration**: `knip.json`
- **Package Manager**: pnpm workspaces
- **Build Tool**: Turborepo
- **Testing**: Vitest
- **Linting**: ESLint + Prettier

---

_This audit was generated on the `cleanup/codebase-audit-and-cleanup` branch and represents the current state
of the codebase as of January 2025._

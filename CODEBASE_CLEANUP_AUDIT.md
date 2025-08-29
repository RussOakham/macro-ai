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

#### Unused DevDependencies (Root Package)

```bash
# Identified by depcheck
* @vitest/ui          # Available in all packages but may be unused
* depcheck            # Self-referencing - this is the tool itself
* drizzle-kit         # May be unused if not actively developing DB
* eslint              # Available in all packages
* ts-unused-exports   # Alternative to knip
* tsx                 # May be unused in some contexts
* unimported          # Alternative to knip
* vitest              # Available in all packages
```

**Recommendation**: Audit actual usage across packages before removal.

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
- [ ] **Run knip analysis** - Fix environment variable issues first
- [ ] **Identify console.log usage** - Create replacement plan
- [ ] **Review TODO items** - Prioritize by business impact

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

---

## 🚨 Risk Assessment

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
- **Unused dependencies**: 80% reduction

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

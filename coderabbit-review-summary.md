# CodeRabbit AI Review Summary - PR #57

**Repository**: RussOakham/macro-ai  
**PR**: #57 - Feature/deploy preview pipeline fixes  
**Review Date**: August 28, 2025  
**Total Comments**: 48 (27 actionable + 21 outside diff range)

---

## 🔴 Critical Issues

### Security & Infrastructure

- **ID**: `infrastructure/src/constructs/networking.ts:172-177`
  - **Issue**: Remove port 3040 from ALB security group; open it on the ECS service/task SG instead
  - **Risk**: ALB should only expose 80/443; 3040 should be allowed on the service SG from the ALB SG,
    not world-open on the ALB SG

- **ID**: `infrastructure/src/constructs/ecs-fargate-construct.ts:451-466`
  - **Issue**: Duplicate/broad CloudWatch Logs permissions and mismatch with actual log group
  - **Risk**: You grant Logs permissions twice (once scoped to `/macro-ai/${environmentName}`, then again with
    `resources: ['*']`)

- **ID**: `infrastructure/src/constructs/ecs-fargate-construct.ts:294-303`
  - **Issue**: Running tasks in public subnets is acceptable for cost, but document SG ingress
  - **Risk**: Since tasks are public, ensure the security group only allows ALB-to-task ingress on the container port

### Data & Configuration

- **ID**: `infrastructure/src/constructs/parameter-store-construct.ts:42-51`
  - **Issue**: Preview prefix ends with "/" causing double slashes in names and ARNs
  - **Risk**: Current value `/macro-ai/development/` later joins using `/${tier}/...`, yielding `//`

---

## 🟠 Important Issues

### AWS Credentials & IAM

- **ID**: `infrastructure/src/constructs/parameter-store-construct.ts:97-113`
  - **Issue**: Remove static IAM key parameters; use IAM roles
  - **Impact**: Keeping `cognito-access-key` and `cognito-secret-key` encourages anti-patterns

- **ID**: `.github/workflows/hygiene-checks.yml:269-271`
  - **Issue**: Fully remove AWS_COGNITO_ACCESS_KEY/SECRET_KEY from jobs
  - **Impact**: These contradict the earlier removal and risk reintroduction of static credentials

- **ID**: `infrastructure/scripts/github-actions-deploy.sh:132-146`
  - **Issue**: Remove all AWS_COGNITO_ACCESS_KEY and AWS_COGNITO_SECRET_KEY references
  - **Impact**: Comprehensive cleanup needed across multiple files and systems

### Health Checks & Monitoring

- **ID**: `infrastructure/src/constructs/ecs-fargate-construct.ts:247-255`
  - **Issue**: Container health check uses wget (may be absent) and inconsistent path
  - **Impact**: Many base images lack wget. Also keep the path consistent with workflow checks

- **ID**: `infrastructure/src/constructs/ecs-fargate-construct.ts:383-395`
  - **Issue**: PR service health path mismatch. Align with main service
  - **Impact**: Main uses `/api/health`; PR service uses `/health`. Standardize on `/api/health`

### Scripts & Automation

- **ID**: `apps/express-api/scripts/generate-env-from-parameter-store.sh:86-98`
  - **Issue**: Remove deprecated Cognito access/secret defaults; fix non-relational default to Redis
  - **Impact**: These defaults reintroduce deprecated keys and the store type is inconsistent with docs

- **ID**: `actual-user-data.sh:105-107`
  - **Issue**: Undefined variables in logs
  - **Impact**: `corsAllowedOrigins`, `prNumber`, `branchName` are never set; should reference the exported envs

---

## 🟡 Low Importance Issues

### Documentation & Schema

- **ID**: `docs/getting-started/environment-configuration.md:187-201`
  - **Issue**: Docs/schema mismatch: schema still requires removed AWS credentials
  - **Impact**: The "Environment Validation Schema" block still lists AWS_COGNITO_ACCESS_KEY/SECRET_KEY as required

- **ID**: `docs/reference/configuration-reference.md:170-181`
  - **Issue**: Add APP_ENV to the env schema to match the documented two-variable pattern
  - **Impact**: Schema currently validates NODE_ENV but not APP_ENV, causing drift from docs and CI/scripts

### Code Quality & Consistency

- **ID**: `apps/express-api/src/utils/server.ts:18-18`
  - **Issue**: Inconsistent import extensions (.ts vs .js) across modules
  - **Impact**: Server imports .ts; api-key.middleware.ts imports .js. Standardize to avoid ESM/TS resolution pitfalls

- **ID**: `apps/express-api/src/middleware/api-key.middleware.ts:3-4`
  - **Issue**: Import extension inconsistency
  - **Impact**: This file uses .js while server/logger use .ts. Standardize per project's tsconfig

### Testing & Validation

- **ID**: `apps/express-api/scripts/validate-env.js:112-118`
  - **Issue**: NODE_ENV/APP_ENV validation is inconsistent; staging/preview will fail or be misclassified
  - **Impact**: NODE_ENV validator disallows "staging" (but other scripts emit NODE_ENV=staging)

---

## 🟢 Negligible / No Action Needed / False Positives

### Generated Files

- **ID**: `apps/client-ui/src/routeTree.gen.ts:1-10`
  - **Issue**: Generated file: avoid formatter/linter churn
  - **Action**: Ensure this file is in your repo-level .eslintignore and .prettierignore

### Minor Formatting & Grammar

- **ID**: `CLAUDE.md:115-137`
  - **Issue**: Use consistent US English spelling
  - **Action**: Change "prioritise" → "prioritize" to match the rest of the doc

- **ID**: `CLAUDE.md:95-101`
  - **Issue**: Minor grammar: pluralize "import alias"
  - **Action**: Change "import alias" → "import aliases"

### Unused Configuration

- **ID**: `infrastructure/src/constructs/networking.ts:38-43`
  - **Issue**: enableVpcEndpoints is defined but unused
  - **Action**: Either wire it to create interface/gateway endpoints or remove to avoid dead config

- **ID**: `infrastructure/src/constructs/networking.ts:15-19`
  - **Issue**: enableFlowLogs/enableDetailedMonitoring declared but not applied
  - **Action**: Avoid config drift; either implement or drop for now

---

## 📊 Summary Statistics

- **Critical**: 3 issues
- **Important**: 8 issues
- **Low Importance**: 6 issues
- **Negligible**: 31 issues

## 🎯 Recommended Action Plan

1. **Immediate (Critical)**: Fix security group configurations and CloudWatch permissions
2. **This Week (Important)**: Complete AWS credential cleanup and standardize health check paths
3. **Next Sprint (Low)**: Address documentation mismatches and import consistency
4. **When Time Permits (Negligible)**: Fix minor formatting and remove unused configurations

## 🔗 Related Resources

- [PR #57](https://github.com/RussOakham/macro-ai/pull/57)
- [CodeRabbit Review](https://github.com/RussOakham/macro-ai/pull/57#issuecomment-3233381475)
- [GitHub Actions Deployment](https://github.com/RussOakham/macro-ai/pull/57#issuecomment-3233410442)

---

_Generated from CodeRabbit AI review on August 28, 2025_

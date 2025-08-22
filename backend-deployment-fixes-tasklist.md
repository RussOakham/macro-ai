# Backend Deployment Workflow Fixes - Task List

## Phase 1: Immediate Critical Fixes (Week 1)

### Task 1.1: Fix Environment Variable Injection in CDK ✅

**Priority: Critical**
**Estimated Time: 2-3 days**

- [x] **Update CDK User Data Script** (`infrastructure/src/stacks/macro-ai-preview-stack.ts`)
  - [x] Add all required environment variables from Zod schema to user data script
  - [x] Ensure variables are set both in `/etc/environment` and systemd service
  - [x] Test with a minimal set of required variables first

- [ ] **Required Variables to Add:**

  ```bash
  API_KEY=<value>
  AWS_COGNITO_REGION=<value>
  AWS_COGNITO_USER_POOL_ID=<value>
  AWS_COGNITO_USER_POOL_CLIENT_ID=<value>
  AWS_COGNITO_USER_POOL_SECRET_KEY=<value>
  AWS_COGNITO_ACCESS_KEY=<value>
  AWS_COGNITO_SECRET_KEY=<value>
  COOKIE_ENCRYPTION_KEY=<value>
  OPENAI_API_KEY=<value>
  RELATIONAL_DATABASE_URL=<value>
  NON_RELATIONAL_DATABASE_URL=<value>
  REDIS_URL=<value>
  ```

### Task 1.2: Fix Configuration Loading Logic ✅

**Priority: Critical**
**Estimated Time: 1-2 days**

- [x] **Update `simple-config.ts`** (`apps/express-api/src/config/simple-config.ts`)
  - [x] Fix environment detection logic for EC2 instances
  - [x] Ensure production environments can load configuration from environment variables
  - [x] Add fallback logic for missing .env files

- [x] **Update `index.ts`** (`apps/express-api/src/index.ts`)
  - [x] Add better error handling for configuration failures
  - [x] Add detailed logging for configuration loading process
  - [x] Ensure graceful degradation if some config is missing

### Task 1.3: Add Build-Time Environment Validation ✅

**Priority: High**
**Estimated Time: 1 day**

- [x] **Create Build Validation Script** (`apps/express-api/scripts/validate-env.js`)
  - [x] Validate required environment variables before build
  - [x] Check Zod schema compliance at build time
  - [x] Fail build if critical variables are missing

- [x] **Update Build Workflow** (`.github/workflows/deploy-preview.yml`)
  - [x] Add environment validation step before build
  - [x] Ensure build fails early if configuration is invalid
  - [x] Add validation for both build-time and runtime variables

## Phase 2: Infrastructure Improvements (Week 2)

### Task 2.1: Fix Parameter Store Integration ✅

**Priority: High**
**Estimated Time: 3-4 days**

- [x] **Update Parameter Store Construct** (`infrastructure/src/constructs/parameter-store-construct.ts`)
  - [x] Fix placeholder parameter values
  - [x] Ensure parameters are properly created and accessible
  - [x] Add parameter validation before deployment

- [x] **Create Environment Config Construct** (`infrastructure/src/constructs/environment-config-construct.ts`)
  - [x] Fetch Parameter Store values during CDK synthesis time
  - [x] Generate complete .env file content
  - [x] Provide environment variables for systemd and /etc/environment

- [x] **Update EC2 User Data** (`infrastructure/src/stacks/macro-ai-preview-stack.ts`)
  - [x] Integrate Environment Config Construct for CDK synthesis time configuration
  - [x] Create .env files with pre-resolved values
  - [x] Ensure all required parameters are available at deployment time

### Task 2.2: Improve Environment Variable Management ✅

**Priority: High**
**Estimated Time: 2-3 days**

- [x] **Create Environment Configuration Files**
  - [x] `env.build.preview.example` for build-time variables
  - [x] `env.runtime.preview.example` for runtime variables
  - [x] `env.local.example` for local development

- [x] **Update Configuration Loading** (`apps/express-api/src/config/`)
  - [x] Support multiple environment file sources
  - [x] Add environment-specific configuration overrides
  - [x] Implement configuration precedence rules

### Task 2.3: Fix Health Check Implementation ✅

**Priority: Medium**
**Estimated Time: 1-2 days**

- [x] **Update Health Check Endpoint** (`apps/express-api/src/features/utility/`)
  - [x] Ensure health check works even with minimal configuration
  - [x] Add configuration validation to health check
  - [x] Return meaningful error messages for configuration issues

- [x] **Update Deployment Health Check** (`.github/workflows/deploy-preview.yml`)
  - [x] Add retry logic for health checks
  - [x] Better error reporting for failed health checks
  - [x] Add configuration validation to health check process

## Phase 3: Testing and Validation (Week 3)

### Task 3.1: Create Comprehensive Testing Suite

**Priority: High**
**Estimated Time: 3-4 days**

- [ ] **Unit Tests for Configuration**
  - [ ] Test environment variable loading in different scenarios
  - [ ] Test Zod schema validation
  - [ ] Test configuration fallback logic

- [ ] **Integration Tests**
  - [ ] Test configuration loading in containerized environment
  - [ ] Test Parameter Store integration
  - [ ] Test environment variable injection

- [ ] **End-to-End Tests**
  - [ ] Test complete deployment workflow
  - [ ] Test configuration loading on EC2 instances
  - [ ] Test health check functionality

### Task 3.2: Environment-Specific Testing

**Priority: Medium**
**Estimated Time: 2-3 days**

- [ ] **Local Development Testing**
  - [ ] Test with `.env` files
  - [ ] Test with environment variables
  - [ ] Test configuration validation

- [ ] **CI Environment Testing**
  - [ ] Test build-time validation
  - [ ] Test artifact creation
  - [ ] Test deployment package validation

- [ ] **EC2 Environment Testing**
  - [ ] Test environment variable injection
  - [ ] Test Parameter Store access
  - [ ] Test application startup

## Phase 4: Monitoring and Observability (Week 4)

### Task 4.1: Add Configuration Monitoring

**Priority: Medium**
**Estimated Time: 2-3 days**

- [ ] **Configuration Health Monitoring**
  - [ ] Add metrics for configuration loading success/failure
  - [ ] Monitor missing environment variables
  - [ ] Track configuration validation errors

- [ ] **Deployment Monitoring**
  - [ ] Monitor environment variable injection success
  - [ ] Track Parameter Store access patterns
  - [ ] Monitor application startup success rates

### Task 4.2: Improve Error Reporting

**Priority: Medium**
**Estimated Time: 2-3 days**

- [ ] **Enhanced Error Messages**
  - [ ] Clear error messages for missing configuration
  - [ ] Actionable error messages for deployment issues
  - [ ] Environment-specific error guidance

- [ ] **Logging Improvements**
  - [ ] Structured logging for configuration loading
  - [ ] Environment variable validation logging
  - [ ] Deployment process logging

## Phase 5: Documentation and Process (Week 5)

### Task 5.1: Update Documentation

**Priority: Medium**
**Estimated Time: 2-3 days**

- [ ] **Configuration Documentation**
  - [ ] Document required environment variables
  - [ ] Document configuration loading process
  - [ ] Document troubleshooting steps

- [ ] **Deployment Documentation**
  - [ ] Document deployment workflow
  - [ ] Document environment variable injection
  - [ ] Document health check process

### Task 5.2: Create Runbooks

**Priority: Medium**
**Estimated Time: 2-3 days**

- [ ] **Troubleshooting Runbooks**
  - [ ] Common configuration issues
  - [ ] Deployment failure scenarios
  - [ ] Environment variable problems

- [ ] **Maintenance Runbooks**
  - [ ] Parameter Store updates
  - [ ] Environment variable changes
  - [ ] Configuration validation

## Implementation Order and Dependencies

### Week 1 Dependencies

- Task 1.1 must be completed before Task 1.2
- Task 1.2 must be completed before Task 1.3

### Week 2 Dependencies

- Task 2.1 depends on Task 1.1 completion
- Task 2.2 depends on Task 1.2 completion

### Week 3 Dependencies

- All Phase 1 and 2 tasks must be completed
- Testing infrastructure must be in place

### Week 4-5 Dependencies

- All previous phases must be completed
- Monitoring infrastructure must be deployed

## Success Criteria

### Phase 1 Success

- [ ] EC2 instances receive all required environment variables
- [ ] Application starts successfully on EC2
- [ ] Health check endpoint responds correctly
- [ ] Build process validates environment variables

### Phase 2 Success

- [ ] Parameter Store integration works correctly
- [ ] Environment variable injection is reliable
- [ ] Configuration loading works across all environments

### Phase 3 Success

- [ ] All tests pass consistently
- [ ] Deployment workflow is reliable
- [ ] Configuration validation works in all scenarios

### Phase 4-5 Success

- [ ] Configuration issues are detected early
- [ ] Error messages are actionable
- [ ] Documentation is comprehensive and accurate

## Risk Mitigation

### High-Risk Tasks

- **Task 1.1**: Test in staging environment first
- **Task 2.1**: Have rollback plan ready
- **Task 3.1**: Ensure testing doesn't break existing functionality

### Rollback Plan

- Keep previous working deployment configuration
- Maintain ability to quickly revert to previous version
- Test rollback procedures before major changes

---

**Task List Created:** $(date)

## Task 1.1 Summary ✅

**What was accomplished:**

1. **Updated CDK User Data Script** - Added all required environment variables from Zod schema
2. **Fixed Environment Variable Injection** - Variables now set in `/etc/environment`, `.env` file, and systemd service
3. **Created Helper Scripts** - `populate-env-vars.sh` and `recreate-development-params.sh` for parameter management

**Key Changes Made:**

- `infrastructure/src/stacks/macro-ai-preview-stack.ts` - Added missing environment variables
- `infrastructure/scripts/populate-env-vars.sh` - Script to populate environment variables
- `infrastructure/scripts/recreate-development-params.sh` - Script to recreate development parameters

**Current Status:**

- ✅ CDK user data script updated with all required environment variables
- ✅ Environment variables set in multiple locations (system-wide, app-specific, systemd)
- ✅ Helper scripts created for parameter management
- ✅ Development parameters recreated with correct naming convention
- ✅ Parameter Store integration updated to use `macro-ai-development-` prefix

## Task 1.2 Summary ✅

**What was accomplished:**

1. **Fixed CDK User Data Script** - Added Parameter Store fetching logic to retrieve actual values during EC2 startup
2. **Simplified Configuration Loading** - Application now reads from local `.env` file created by user data script
3. **Removed Unnecessary Runtime Integration** - No need for `@aws-sdk/client-ssm` in application runtime
4. **Maintained Existing Configuration System** - Uses the proven `simple-config.ts` approach

**Key Changes Made:**

- `infrastructure/src/stacks/macro-ai-preview-stack.ts` - Added Parameter Store fetching in user data script
- `apps/express-api/src/index.ts` - Reverted to use existing configuration system
- Deleted unnecessary `parameter-store-config.ts` file

**Current Status:**

- ✅ CDK user data script fetches Parameter Store values during EC2 startup
- ✅ Environment variables written to local `.env` file on EC2 instance
- ✅ Application reads configuration from local `.env` file (no runtime Parameter Store calls)
- ✅ Existing configuration validation and loading logic preserved

## Task 1.3 Summary ✅

**What was accomplished:**

1. **Created Build Validation Script** - `scripts/validate-env.js` that validates environment variables before build
2. **Added Build-Time Validation** - Script checks Zod schema compliance and fails build if critical variables missing
3. **Updated GitHub Workflow** - Added environment validation step before Express API build
4. **Created Environment Template** - `env.build.preview.example` shows required build-time variables

**Key Changes Made:**

- `apps/express-api/scripts/validate-env.js` - Comprehensive environment validation script
- `apps/express-api/package.json` - Added `validate-env` script and `prebuild` hook
- `.github/workflows/deploy-preview.yml` - Added environment validation before build
- `apps/express-api/env.build.preview.example` - Template for build-time environment variables

**Current Status:**

- ✅ Build validation script created with comprehensive validation rules
- ✅ Build process now validates environment variables before compilation
- ✅ GitHub workflow includes environment validation step
- ✅ Build fails early if configuration is invalid

## Task 2.1 Summary ✅

**What was accomplished:**

1. **Created Environment Config Construct** - New construct that fetches Parameter Store values during CDK synthesis time
2. **Implemented CDK Synthesis Time Approach** - Environment variables resolved at deployment time, not runtime
3. **Updated EC2 User Data Script** - Clean implementation that creates complete .env files with pre-resolved configuration
4. **Eliminated Runtime Parameter Store Calls** - Applications now receive all configuration at deployment time

**Key Changes Made:**

- `infrastructure/src/constructs/environment-config-construct.ts` - New construct for CDK synthesis time configuration
- `infrastructure/src/stacks/macro-ai-preview-stack.ts` - Updated to use Environment Config Construct
- User data script now creates complete .env files with all required environment variables

**Current Status:**

- ✅ Parameter Store values fetched during CDK synthesis (deployment time)
- ✅ Complete .env files created with all required configuration
- ✅ Applications receive environment-agnostic configuration
- ✅ No runtime Parameter Store API calls needed
- ✅ Better separation of concerns between infrastructure and application

**Architecture Benefits Achieved:**

- **Environment-Agnostic Applications**: Applications run identically regardless of environment
- **Better Security**: No need for EC2 instances to have Parameter Store read permissions
- **Improved Reliability**: Configuration issues caught during deployment, not at runtime
- **Faster Startup**: No Parameter Store API calls during application initialization

## Task 2.2 Summary ✅

**What was accomplished:**

1. **Created Enhanced Environment Configuration System** - New `env-config.ts` module with environment-specific file loading
2. **Added Environment-Specific Configuration Files** - Example files for local development, preview deployments, and runtime configuration
3. **Implemented Configuration Precedence Rules** - Proper loading order with environment-specific overrides
4. **Enhanced Build-Time Validation** - Updated validation script to support multiple environment file types

**Key Changes Made:**

- `apps/express-api/src/config/env-config.ts` - New enhanced environment configuration system
- `apps/express-api/src/config/simple-config.ts` - Updated to use enhanced configuration loader
- `apps/express-api/env.local.example` - Local development environment template
- `apps/express-api/env.runtime.preview.example` - Preview deployment runtime template
- `apps/express-api/scripts/validate-env.js` - Enhanced validation with environment-specific file loading

**Current Status:**

- ✅ Environment-specific configuration file support (.env, .env.local, .env.development, etc.)
- ✅ Proper configuration precedence rules implemented
- ✅ Enhanced environment type detection (development, test, staging, production, preview)
- ✅ Backward compatibility maintained with existing configuration loading
- ✅ Build-time validation supports multiple environment file sources
- ✅ CDK synthesis time configuration integrated with environment management

**Architecture Benefits Achieved:**

- **Environment-Specific Configuration**: Different config files for different environments
- **Clear Precedence Rules**: Predictable configuration loading order
- **Better Development Experience**: Local developers can use .env.local for personalized settings
- **Enhanced Validation**: Build-time validation now understands environment context
- **Maintainable Configuration**: Centralized configuration management with clear file structure

**Next Action:** Proceed with Phase 3 - Testing and Validation (Task 3.1: Create Comprehensive Testing Suite)

## Task 2.3 Summary ✅

**What was accomplished:**

1. **Enhanced Health Check System** - Added comprehensive configuration validation to health checks
2. **New Configuration Health Endpoint** - Created `/health/config` endpoint for detailed configuration debugging
3. **Improved Error Handling** - Enhanced health check error messages and validation logic
4. **Fixed Linting Issues** - Resolved all TypeScript and ESLint errors in health check implementation

**Key Changes Made:**

- `apps/express-api/src/features/utility/utility.services.ts` - Added `getConfigurationStatus` method with granular configuration validation
- `apps/express-api/src/features/utility/utility.controller.ts` - Added `getConfigurationStatus` controller method
- `apps/express-api/src/features/utility/utility.routes.ts` - Added `/health/config` route with OpenAPI documentation
- `apps/express-api/src/features/utility/utility.schemas.ts` - Added `configurationResponseSchema` for the new endpoint
- `apps/express-api/src/features/utility/utility.types.ts` - Added `TConfigurationStatus` interface and updated service/controller interfaces

**Current Status:**

- ✅ All health check endpoints now include configuration validation
- ✅ New `/health/config` endpoint provides detailed configuration debugging information
- ✅ Health checks work with minimal configuration (only `NODE_ENV` required for basic checks)
- ✅ Enhanced error messages for configuration issues
- ✅ All linting and build issues resolved
- ✅ Health check system ready for production deployment

**Architecture Benefits Achieved:**

- **Better Debugging**: Configuration issues can be identified through dedicated health endpoint
- **Improved Monitoring**: Health checks now provide granular status information
- **Production Ready**: Health checks work reliably even with minimal configuration
- **Enhanced Observability**: Detailed health status for ALB and monitoring systems

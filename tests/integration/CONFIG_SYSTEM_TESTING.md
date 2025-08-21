# Configuration System Integration Testing

Comprehensive integration tests for the new simplified configuration system, validating the complete flow from AWS
Parameter Store to application configuration.

## 🎯 Overview

The configuration system integration tests validate:

- **Bootstrap Script Integration**: Tests the `bootstrap-ec2-config.sh` script functionality
- **Configuration Loading**: Tests the `simple-config.ts` system with environment variable loading and validation
- **End-to-End Parameter Store**: Tests complete flow from Parameter Store to application configuration
- **CDK Pre-deployment Validation**: Tests validation that can run before CDK deployment

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI**: Installed and configured with appropriate credentials
2. **Node.js & pnpm**: For running the test suite
3. **AWS Permissions**: Access to Parameter Store and STS services

### Run All Configuration System Tests

```bash
cd tests/integration
./run-config-system-tests.sh
```

### Run Specific Test Categories

```bash
# Bootstrap script tests only
./run-config-system-tests.sh bootstrap

# Configuration loading tests only
./run-config-system-tests.sh config-loading

# End-to-end Parameter Store tests only
./run-config-system-tests.sh parameter-store-e2e

# CDK pre-deployment validation only
./run-config-system-tests.sh cdk-validation
```

## 📋 Test Categories

### 1. Bootstrap Script Integration Tests

**File**: `bootstrap-script-integration.test.ts`

**Tests**:

- Parameter fetching from AWS Parameter Store
- Environment file creation and formatting
- Error handling for missing parameters or invalid credentials
- Environment-specific parameter mapping (development, staging, production, PR environments)
- Command line argument validation
- Help message display

**Key Validations**:

- Script can successfully fetch parameters from Parameter Store
- Creates properly formatted environment files (`/etc/macro-ai.env`)
- Handles missing parameters gracefully
- Maps PR environments to development parameters
- Validates AWS credentials and permissions

### 2. Configuration Loading Integration Tests

**File**: `config-loading-integration.test.ts`

**Tests**:

- Environment variable loading and validation
- Zod schema validation for type checking
- CamelCase conversion functionality (e.g., `AWS_COGNITO_REGION` → `awsCognitoRegion`)
- Error handling for missing or invalid configuration
- Environment file loading with precedence rules
- Different environment configurations (development, production, test, PR)

**Key Validations**:

- All required environment variables are loaded and validated
- Type conversion works correctly (strings to numbers, etc.)
- CamelCase property mapping is accurate
- Validation errors provide detailed feedback
- Environment variables take precedence over .env files

### 3. End-to-End Parameter Store Integration Tests

**File**: `parameter-store-end-to-end.test.ts`

**Tests**:

- Complete flow from Parameter Store setup to application configuration
- Real AWS Parameter Store parameter creation and retrieval
- Bootstrap script execution against real parameters
- Application configuration loading from generated environment files
- Partial parameter availability handling
- Environment file format and permissions validation

**Key Validations**:

- Parameters can be created in and retrieved from AWS Parameter Store
- Bootstrap script successfully processes real AWS parameters
- Generated environment files have correct format and permissions
- Application can load and validate configuration from generated files
- All expected configuration values are present and correctly typed

### 4. CDK Pre-deployment Validation Tests

**File**: `cdk-pre-deployment-validation.test.ts`

**Tests**:

- AWS Parameter Store access validation
- Required IAM permissions verification
- Environment-specific parameter validation (development, staging, production)
- Bootstrap script accessibility from GitHub
- Systemd service template validation
- CDK synthesis validation for all environments

**Key Validations**:

- All required parameters exist in Parameter Store for target environments
- IAM permissions are sufficient for Parameter Store operations
- Bootstrap script can be downloaded and executed
- Systemd service template references correct environment file paths
- CDK can synthesize successfully with new configuration system

## 🔧 Configuration

### Required Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Test Configuration
TEST_ENVIRONMENT=development  # or staging, production
TEST_TIMEOUT=300             # Test timeout in seconds
```

### Test Runner Options

```bash
# Show help
./run-config-system-tests.sh --help

# Run with verbose output
./run-config-system-tests.sh --verbose

# Run for specific environment
./run-config-system-tests.sh --environment staging

# Dry run (show what would be tested)
./run-config-system-tests.sh --dry-run

# Skip prerequisite checks
./run-config-system-tests.sh --skip-prerequisites
```

## 📊 Test Execution Flow

### 1. Prerequisites Validation

- Verifies Node.js, pnpm, and AWS CLI are installed
- Checks AWS credentials are configured
- Validates project structure and dependencies

### 2. Test Category Execution

- Runs tests in isolated environments
- Cleans up test resources after execution
- Provides detailed error reporting

### 3. Results Summary

- Shows passed/failed test counts
- Provides detailed error information for failures
- Generates validation reports for CDK pre-deployment

## 🚨 Troubleshooting

### Common Issues

#### 1. AWS Credentials Not Configured

```bash
# Configure AWS CLI
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

#### 2. Parameter Store Access Denied

```bash
# Check IAM permissions
aws sts get-caller-identity
aws ssm describe-parameters --max-items 1
```

#### 3. Bootstrap Script Not Found

```bash
# Verify script exists
ls -la ../../infrastructure/scripts/bootstrap-ec2-config.sh

# Check GitHub accessibility
curl -I https://raw.githubusercontent.com/RussOakham/macro-ai/main/infrastructure/scripts/bootstrap-ec2-config.sh
```

#### 4. CDK Synthesis Failures

```bash
# Check CDK installation
cd ../../infrastructure
npx cdk --version

# Verify CDK can list stacks
npx cdk list
```

## 🔍 Test Results

### Success Criteria

- All bootstrap script tests pass
- Configuration loading validates all required parameters
- End-to-end flow completes successfully
- CDK pre-deployment validation passes

### Performance Benchmarks

- **Bootstrap Script Execution**: < 30 seconds
- **Parameter Store Operations**: < 10 seconds per environment
- **Configuration Loading**: < 5 seconds
- **CDK Synthesis**: < 60 seconds per environment

## 🔄 CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Configuration System Tests
  run: |
    cd tests/integration
    ./run-config-system-tests.sh --environment development
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: us-east-1
```

## 📝 Adding New Tests

To add new configuration system tests:

1. Create test file in `tests/integration/`
2. Add test script to `package.json`
3. Update `run-config-system-tests.sh` if needed
4. Document test purpose and validations

## 🎯 Best Practices

- **Isolation**: Each test cleans up its resources
- **Real AWS Services**: Tests use actual AWS Parameter Store
- **Error Handling**: Comprehensive error scenario testing
- **Documentation**: Clear test purpose and validation criteria
- **Performance**: Tests complete within reasonable timeframes

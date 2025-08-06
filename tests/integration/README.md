# Integration Testing Suite

Comprehensive end-to-end testing for the Macro AI full-stack deployment, validating Lambda functions, API Gateway, authentication,
database connectivity, and frontend-backend integration.

## 🎯 Overview

The integration test suite provides:

- **API Gateway Testing**: Endpoint validation, CORS, and performance testing
- **Authentication Testing**: JWT validation, protected routes, and rate limiting
- **Database Integration**: Connection testing and Parameter Store validation
- **End-to-End Testing**: Complete frontend-backend integration flows
- **Performance Testing**: Response times and concurrent request handling
- **Error Handling**: Comprehensive error scenario validation

## 🚀 Quick Start

### Prerequisites

1. **Deployed Infrastructure**: Backend must be deployed to AWS
2. **Environment Variables**: Required test configuration
3. **AWS Credentials**: Access to deployed resources

### Run All Tests

```bash
cd tests/integration
./run-integration-tests.sh
```

### Run Specific Test Suites

```bash
# API Gateway tests only
pnpm test:api

# Authentication tests only
pnpm test:auth

# Database integration tests only
pnpm test:database

# End-to-end tests only
pnpm test -- end-to-end.test.ts
```

## 🔧 Configuration

### Required Environment Variables

```bash
# API Configuration
TEST_API_ENDPOINT=https://your-api-gateway-url.amazonaws.com/hobby/
TEST_API_KEY=your-api-key-32-characters-long

# Test Environment
TEST_ENVIRONMENT=hobby  # or staging, production
TEST_TIMEOUT=300        # Test timeout in seconds

# Optional: Frontend URL for CORS testing
TEST_FRONTEND_URL=https://your-amplify-app.amplifyapp.com

# Optional: Test User Credentials (for auth tests)
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPassword123!
TEST_USER_USERNAME=testuser
```

### AWS Configuration

```bash
# AWS Region
AWS_REGION=us-east-1

# AWS Credentials (via AWS CLI or environment)
aws configure
# or
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

## 📋 Test Suites

### 1. API Gateway Integration Tests

**File**: `api-gateway-integration.test.ts`

**Tests**:

- Health check endpoint validation
- CORS configuration testing
- API key validation
- Error handling and response format
- Performance and concurrent request testing
- Lambda function integration

**Key Validations**:

- Response times < 5 seconds
- Proper CORS headers
- Consistent JSON response format
- Error handling without sensitive data exposure

### 2. Authentication Integration Tests

**File**: `auth-integration.test.ts`

**Tests**:

- Authentication endpoint validation
- JWT token validation
- Protected route access control
- Rate limiting functionality
- CORS for authentication flows
- Security header validation

**Key Validations**:

- Proper authentication error handling
- JWT token structure validation
- Rate limiting enforcement
- No sensitive data in error responses

### 3. Database Integration Tests

**File**: `database-integration.test.ts`

**Tests**:

- Database connectivity through Lambda
- Parameter Store integration
- Configuration loading validation
- Connection pooling efficiency
- Error handling for database operations

**Key Validations**:

- Database connection within 10 seconds
- Parameter Store caching effectiveness
- No database internals in error messages
- Consistent performance across requests

### 4. End-to-End Integration Tests

**File**: `end-to-end.test.ts`

**Tests**:

- Complete frontend-backend CORS flows
- Authentication request flows with CORS
- Cross-origin error handling
- Performance under frontend load
- Security header consistency

**Key Validations**:

- CORS preflight and actual request flows
- Consistent error format across origins
- No sensitive information in cross-origin errors
- Acceptable response times for frontend requests

## 🔍 Test Execution

### Local Testing

```bash
# Set up environment
export TEST_API_ENDPOINT="https://your-api.amazonaws.com/hobby/"
export TEST_API_KEY="your-api-key"

# Run tests
cd tests/integration
pnpm test
```

### CI/CD Integration

The integration tests are automatically run in the GitHub Actions pipeline:

1. **After Backend Deployment**: Validates API Gateway and Lambda
2. **After Frontend Deployment**: Tests complete integration
3. **Environment-Specific**: Different configurations for staging/production

### Test Results

Results are saved to `tests/integration/results/`:

- `integration-test-results.json`: Detailed test results
- Console output with pass/fail status
- Performance metrics and timing data

## 📊 Performance Benchmarks

### Expected Response Times

- **Health Check**: < 3 seconds
- **Authentication**: < 5 seconds
- **Database Operations**: < 8 seconds
- **CORS Preflight**: < 2 seconds

### Concurrent Request Handling

- **5 Concurrent Requests**: All should succeed
- **Response Time Variance**: < 5 seconds deviation
- **Error Rate**: 0% for valid requests

## 🚨 Troubleshooting

### Common Issues

#### 1. API Endpoint Not Found

```bash
# Check if infrastructure is deployed
aws cloudformation describe-stacks --stack-name MacroAiHobbyStack

# Verify API Gateway endpoint
aws apigateway get-rest-apis
```

#### 2. Authentication Failures

```bash
# Check API key configuration
echo $TEST_API_KEY

# Verify Parameter Store access
aws ssm get-parameters-by-path --path "/macro-ai/hobby"
```

#### 3. CORS Issues

```bash
# Test CORS manually
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-api-endpoint/api/health
```

#### 4. Database Connection Issues

```bash
# Check Lambda logs
aws logs tail /aws/lambda/macro-ai-hobby-api --follow

# Verify database URL in Parameter Store
aws ssm get-parameter --name "/macro-ai/hobby/critical/neon-database-url"
```

### Debug Mode

Enable verbose logging:

```bash
export DEBUG=true
export VITEST_LOG_LEVEL=verbose
pnpm test
```

## 🔐 Security Considerations

### Test Data

- **No Real User Data**: Tests use mock/test data only
- **Temporary Resources**: No persistent test data created
- **Isolated Testing**: Tests don't affect production data

### Credentials

- **Environment Variables**: Sensitive data in environment variables
- **AWS IAM**: Least privilege access for test execution
- **No Hardcoded Secrets**: All secrets externalized

## 📈 Monitoring and Reporting

### Test Metrics

- **Pass Rate**: Percentage of successful tests
- **Response Times**: Average and maximum response times
- **Error Rates**: Failed requests and error types
- **Coverage**: Endpoint and scenario coverage

### Alerts

Integration test failures trigger:

- **GitHub Actions Failure**: Blocks deployment
- **Test Result Artifacts**: Detailed failure information
- **Performance Degradation**: Response time alerts

## 🔄 Continuous Improvement

### Adding New Tests

1. **Create Test File**: Follow existing patterns
2. **Update Configuration**: Add to vitest.config.ts
3. **Document Tests**: Update this README
4. **CI/CD Integration**: Ensure pipeline inclusion

### Performance Optimization

- **Parallel Execution**: Where safe and beneficial
- **Test Data Caching**: Reuse setup data
- **Selective Testing**: Run only relevant tests for changes
- **Timeout Optimization**: Balance thoroughness and speed

---

**Next Steps**: After successful integration testing, monitor production deployments and implement comprehensive
end-to-end monitoring for the complete application stack.

# Lambda API

AWS Lambda function for Macro AI Express API using serverless-http wrapper.

## Overview

This package wraps the existing Express API (`@repo/express-api`) as a single AWS Lambda function using the `serverless-http`
package. It provides seamless integration with AWS services including Parameter Store, Cognito, and API Gateway.

## Architecture

- **Single Lambda Function**: All Express routes handled by one Lambda function
- **serverless-http Wrapper**: Converts Express app to Lambda-compatible handler
- **Parameter Store Integration**: Secure configuration loading with caching
- **Cold Start Optimization**: Express app initialization on first invocation
- **Connection Reuse**: Database and Redis connections reused across invocations

## Project Structure

```text
apps/lambda-api/
├── src/
│   ├── services/
│   │   ├── parameter-store.service.ts    # Parameter Store integration
│   │   └── lambda-config.service.ts      # Configuration management
│   ├── utils/
│   │   └── lambda-utils.ts               # Lambda utility functions
│   ├── test/
│   │   └── setup.ts                      # Test configuration
│   └── lambda.ts                         # Main Lambda handler
├── dist/                                 # Compiled output
├── package.json                          # Dependencies and scripts
├── tsconfig.json                         # TypeScript configuration
├── esbuild.config.js                     # Build configuration
└── vitest.config.ts                      # Test configuration
```

## Configuration

### Environment Variables

The Lambda function loads configuration from AWS Parameter Store:

- `macro-ai-openai-key` (SecureString) - OpenAI API key
- `macro-ai-database-url` (SecureString) - Neon PostgreSQL connection
- `macro-ai-redis-url` (SecureString) - Upstash Redis connection
- `macro-ai-cognito-user-pool-id` (String) - Cognito User Pool ID
- `macro-ai-cognito-user-pool-client-id` (String) - Cognito App Client ID

### Lambda Settings

- **Runtime**: Node.js 20.x LTS
- **Memory**: 1024 MB
- **Timeout**: 5 minutes
- **Architecture**: x86_64

## Development

### Prerequisites

- Node.js 20+ LTS
- pnpm package manager
- AWS CLI configured
- Access to Parameter Store parameters

### Installation

```bash
# Install dependencies
pnpm install

# Build the Lambda function
pnpm run build

# Run tests
pnpm run test

# Run tests with coverage
pnpm run test:coverage
```

### Build Scripts

- `pnpm run build` - Full build (clean, compile, bundle)
- `pnpm run compile` - TypeScript compilation only
- `pnpm run bundle` - ESBuild bundling for production
- `pnpm run bundle:dev` - ESBuild bundling for development
- `pnpm run package` - Create deployment ZIP file

### Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test --watch

# Run tests with coverage
pnpm run test:coverage

# Type checking
pnpm run type-check
```

## Deployment

### Manual Deployment

1. Build the Lambda function:

   ```bash
   pnpm run build
   ```

2. Create deployment package:

   ```bash
   pnpm run package
   ```

3. Upload `lambda-deployment.zip` to AWS Lambda

### AWS SAM Deployment

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  MacroAILambda:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: macro-ai-lambda
      CodeUri: dist/
      Handler: lambda.handler
      Runtime: nodejs20.x
      MemorySize: 1024
      Timeout: 300
      Role: !Sub 'arn:aws:iam::${AWS::AccountId}:role/macro-ai-lambda-execution-role'
      Environment:
        Variables:
          NODE_ENV: production
          AWS_REGION: us-east-1
```

## Performance

### Cold Start Optimization

- **Parameter Caching**: 5-minute TTL for Parameter Store values
- **Connection Reuse**: Database and Redis connections persist across invocations
- **Bundle Optimization**: Tree shaking and minification reduce bundle size
- **Express Initialization**: App created once on cold start, reused for warm invocations

### Memory Usage

- **Bundle Size**: ~5MB (includes all dependencies)
- **Memory Allocation**: 1024MB (optimal for AI operations)
- **Execution Time**: 100-500ms average per request

### Cost Estimation

For 1000 requests/month:

- **Requests**: 1000 × £0.0000002 = £0.0002
- **Compute**: 1000 × 200ms × £0.000001667 = £0.0003
- **Total**: ~£0.0005/month (within AWS free tier)

## Observability & Monitoring

This Lambda API includes comprehensive observability features powered by **AWS Lambda Powertools**
for structured logging, metrics, and error handling.

### Structured Logging

The application uses **AWS Lambda Powertools Logger** for structured JSON logging with
automatic correlation IDs and contextual information:

#### Features

- **Structured JSON logs** with consistent format
- **Automatic correlation IDs** for request tracing
- **Environment-based log levels** (DEBUG in development, INFO in production)
- **Service metadata** automatically included (service name, version, environment)
- **Go-style error handling integration** with structured error logging

#### Log Levels

- `DEBUG`: Detailed debugging information (development only)
- `INFO`: General operational messages
- `WARN`: Warning conditions that should be monitored
- `ERROR`: Error conditions requiring attention
- `CRITICAL`: Critical errors requiring immediate action

#### Example Log Output

```json
{
	"level": "INFO",
	"message": "Lambda request received",
	"timestamp": "2025-01-15T10:30:00.000Z",
	"service": "macro-ai-lambda-api",
	"environment": "production",
	"functionName": "macro-ai-lambda-api",
	"region": "us-east-1",
	"version": "lambda-api-v1.0.0",
	"operation": "lambdaRequest",
	"requestId": "abc123-def456",
	"method": "POST",
	"path": "/api/users"
}
```

### CloudWatch Metrics

The application emits custom CloudWatch metrics using **AWS Lambda Powertools Metrics**:

#### Cold Start Metrics

- `ColdStart`: Tracks Lambda cold start occurrences
- `WarmStart`: Tracks warm start invocations
- Dimensions: `service`, `Environment`, `Service`, `FunctionName`, `Region`

#### Performance Metrics

- `ExecutionTime`: Measures operation execution time in milliseconds
- `MemoryUsage`: Tracks memory utilization
- Dimensions: `service`, `Environment`, `Service`, `FunctionName`, `Region`, `Operation`

#### Parameter Store Metrics

- `ParameterStoreCacheHit`: Cache hit events
- `ParameterStoreCacheMiss`: Cache miss events requiring Parameter Store calls
- `ParameterStoreRetrievalTime`: Time taken to retrieve parameters (milliseconds)
- `ParameterStoreError`: Parameter Store operation failures
- Dimensions: `service`, `Environment`, `Service`, `FunctionName`, `Region`, `ParameterName`

#### Metric Namespace

All metrics are published to the `MacroAI/Lambda` namespace in CloudWatch.

### Error Handling & Logging

#### Go-Style Error Handling Integration

The application includes utilities for structured error logging with Go-style Result tuples:

```typescript
import {
	logResultError,
	resultFromPromise,
} from './utils/powertools-error-logging'

// Automatic error logging with Result tuples
const [data, error] = await resultFromPromise(
	fetchUserData(userId),
	'fetchUserData',
	{ userId },
)

if (error) {
	// Error was automatically logged with structured context
	return createErrorResponse(500, 'Failed to fetch user data')
}
```

#### AppError Integration

Custom AppError instances are logged with appropriate severity levels:

```typescript
import { logAppError } from './utils/powertools-error-logging'

try {
	// some operation
} catch (error) {
	if (error instanceof AppError) {
		logAppError(error, 'processUserRequest', { userId: '123' })
		// Logs with WARN level for 4xx errors, ERROR level for 5xx errors
	}
}
```

### Health Checks

- `/health` endpoint for basic health checks
- Parameter Store connectivity validation
- Database connection verification
- Structured health check logging with operation context

## Troubleshooting

### Common Issues

1. **Parameter Store Access Denied**
   - Verify IAM role has `SSMReadOnlyAccess` policy
   - Check parameter names match exactly
   - Ensure parameters exist in correct AWS region

2. **Cold Start Timeouts**
   - Increase Lambda timeout setting
   - Check Parameter Store response times
   - Verify database connectivity

3. **Memory Issues**
   - Monitor CloudWatch memory metrics
   - Increase memory allocation if needed
   - Check for memory leaks in Express app

### Debug Mode

Set `NODE_ENV=development` for verbose logging:

- Request/response details
- Parameter Store cache statistics
- Memory usage information
- Execution time measurements

## Integration

### API Gateway

Configure API Gateway with proxy integration:

```yaml
Integration:
  Type: AWS_PROXY
  IntegrationHttpMethod: POST
  Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${MacroAILambda.Arn}/invocations'
```

### Cognito Authorization

Protected routes automatically use Cognito User Pool authorizer configured in API Gateway.

### CORS

CORS headers are automatically added by the Lambda function for all responses.

## Security

- **Parameter Store**: Secure parameter loading with encryption
- **IAM Roles**: Least privilege access patterns
- **VPC**: Optional VPC configuration for database access
- **Secrets**: No hardcoded secrets in code or environment variables

# Lambda Deployment Guide

This document explains how to deploy the Express API as an AWS Lambda function using the consolidated architecture.

## Overview

The Express API now supports dual deployment modes:

- **Express Server**: Traditional Node.js server (`pnpm start`)
- **AWS Lambda**: Serverless function using serverless-http wrapper

## Architecture

The consolidated architecture eliminates the need for a separate `apps/lambda-api` application by including the Lambda
handler directly in the Express API codebase:

```text
apps/express-api/
├── src/
│   ├── lambda.ts              # Lambda entry point
│   ├── utils/server.ts        # Shared Express server creation
│   └── ...                    # All other Express API code
├── dist/
│   ├── lambda.bundle.js       # Bundled Lambda function
│   └── lambda.bundle.js.map   # Source map
└── lambda-deployment.zip      # Deployment package
```

## Build Commands

### Lambda-specific commands

- `pnpm build:lambda` - Build and bundle Lambda function
- `pnpm bundle:lambda:dev` - Build Lambda with development settings (unminified)
- `pnpm package:lambda` - Create deployment ZIP file
- `pnpm clean:lambda` - Clean Lambda build artifacts

### Standard Express commands

- `pnpm build` - Build Express server
- `pnpm start` - Start Express server
- `pnpm dev` - Development mode with hot reload

## Lambda Handler

The Lambda handler (`src/lambda.ts`) provides:

- **Cold start optimization**: Express app initialization on first invocation
- **Container reuse**: Warm starts reuse existing Express app
- **AWS Powertools integration**: Structured logging with request context
- **Error handling**: Proper API Gateway error responses
- **Request/response transformation**: Lambda context injection into Express requests

### Key Features

1. **Simplified Architecture**: No complex Powertools coordination
2. **Essential Logging**: AWS Powertools Logger for structured logs
3. **Request Context**: Lambda event/context available in Express middleware
4. **Error Resilience**: Graceful error handling with proper HTTP responses

## Deployment

### 1. Build the Lambda package

```bash
pnpm package:lambda
```

This creates `lambda-deployment.zip` ready for AWS Lambda deployment.

### 2. Deploy to AWS Lambda

**Using AWS CLI:**

```bash
aws lambda update-function-code \
  --function-name your-function-name \
  --zip-file fileb://lambda-deployment.zip
```

**Using AWS Console:**

1. Go to AWS Lambda console
2. Select your function
3. Upload `lambda-deployment.zip`

**Using Infrastructure as Code:**

- Use the ZIP file with AWS CDK, Terraform, or CloudFormation
- Set handler to: `lambda.handler`
- Runtime: Node.js 20.x
- Architecture: x86_64 or arm64

### 3. Environment Variables

Ensure these environment variables are set in Lambda:

```env
NODE_ENV=production
LOG_LEVEL=INFO
# Add your application-specific environment variables
```

## Testing

### Unit Tests

```bash
pnpm test src/__tests__/lambda.test.ts
```

### Local Testing

The Lambda handler can be tested locally using tools like:

- AWS SAM CLI
- Serverless Framework
- Lambda Runtime Interface Emulator

## Bundle Size

The current bundle size is approximately 2.4MB (minified). This includes:

- Express server and all middleware
- All API routes and controllers
- Database and external service integrations
- AWS Powertools Logger

## Benefits of Consolidated Architecture

✅ **Simplified maintenance**: Single codebase for both deployment modes  
✅ **Eliminated import issues**: No cross-app dependencies  
✅ **Consistent TypeScript configuration**: Single tsconfig.json  
✅ **Reduced complexity**: No build orchestration between apps  
✅ **Better code sharing**: Direct access to all Express components  
✅ **Easier testing**: Unified test suite

## Migration from Separate lambda-api

If migrating from the previous separate `apps/lambda-api` application:

1. ✅ Lambda handler consolidated into `apps/express-api/src/lambda.ts`
2. ✅ Dependencies added to `apps/express-api/package.json`
3. ✅ Build scripts updated for dual deployment
4. ✅ Tests migrated to unified test suite
5. 🔄 Update deployment scripts to use new build artifacts
6. 🔄 Remove old `apps/lambda-api` directory (when ready)

## Next Steps

1. **Test deployment**: Deploy to a development Lambda environment
2. **Add observability**: Integrate AWS X-Ray tracing (optional)
3. **Performance optimization**: Monitor cold start times and bundle size
4. **Infrastructure as Code**: Update deployment scripts for new architecture

# Phase 2: API Analysis & Conversion Planning Report

**Date**: 2025-08-04  
**Status**: ✅ COMPLETE  
**Task**: API Analysis & Conversion Planning  
**Duration**: 40 minutes

---

## 🎯 Executive Summary

Comprehensive analysis of the Express API architecture completed for AWS Lambda conversion. The current monolithic Express
API application can be efficiently converted to a single Lambda function using the `serverless-http` wrapper approach with
minimal refactoring required.

**Key Findings**:

- ✅ Well-structured Express architecture ideal for serverless-http wrapper
- ✅ Go-style error handling patterns require no changes for Lambda
- ✅ Parameter Store integration already planned from Phase 1
- ✅ Existing middleware stack can be preserved with minimal modifications

---

## 🏗️ Current Architecture Analysis

### Express API Structure

```text
apps/express-api/src/
├── features/
│   ├── auth/          # Cognito integration, JWT handling
│   ├── chat/          # OpenAI integration, streaming, vectors
│   ├── user/          # User management, profile operations
│   └── utility/       # Health checks, system information
├── middleware/        # Auth, rate limiting, CORS, validation
├── data-access/       # PostgreSQL connection, Drizzle ORM
└── utils/            # Shared utilities, logging, crypto
```

### Current Middleware Stack

1. **CORS** - Multi-origin support with credentials
2. **Compression** - Conditional (disabled for streaming)
3. **Authentication** - JWT token verification via Cognito
4. **Rate Limiting** - Redis-backed with tiered limits
5. **Validation** - Zod schema validation
6. **Error Handling** - Centralized Go-style error processing

---

## 🎯 Single Lambda Function Architecture

### Serverless-HTTP Wrapper Approach

#### **Single Lambda Function** (Unified Complexity)

**Routes**: All Express routes (18 endpoints total)

- `/auth/*` - User authentication and registration (9 endpoints)
- `/users/*` - User profile management (2 endpoints)
- `/chats/*` - AI chat system with streaming (5 endpoints)
- `/health`, `/system-info` - Health checks and system status (2 endpoints)

**Implementation**: `serverless-http` wrapper around existing Express application
**Memory**: 1024MB | **Timeout**: 5 minutes
**Bundle Size**: ~5MB (includes all dependencies)
**Cold Start**: 2-3 seconds (Express app initialization)

**Dependencies**: All existing Express dependencies preserved

- Cognito SDK for authentication
- OpenAI SDK for AI chat functionality
- Database connection (Neon PostgreSQL)
- Redis connection (Upstash)
- All existing middleware and services

**Parameters Required**:

- `macro-ai-openai-key` (SecureString, Advanced)
- `macro-ai-database-url` (SecureString, Advanced)
- `macro-ai-redis-url` (SecureString, Standard)
- `macro-ai-cognito-user-pool-id` (String, Standard)
- `macro-ai-cognito-user-pool-client-id` (String, Standard)

### Implementation Approach

```typescript
// Lambda handler with serverless-http wrapper
import serverless from 'serverless-http'
import { createServer } from '../../express-api/src/utils/server.ts'
import { initializeParameterStore } from './parameter-store.ts'

let app: Express | null = null

export const handler = async (
	event: APIGatewayProxyEvent,
	context: Context,
) => {
	// Initialize Express app on cold start
	if (!app) {
		await initializeParameterStore()
		app = createServer()
	}

	// Handle request with serverless-http
	const serverlessHandler = serverless(app)
	return serverlessHandler(event, context)
}
```

---

## 🔐 Parameter Store Integration Strategy

### Parameter Access Pattern

```typescript
// Recommended: Direct Parameter Store access with caching
const parameterStore = new SSMClient({ region: 'us-east-1' })

class ParameterStoreService {
	private cache = new Map<string, { value: string; expires: number }>()

	async getParameter(name: string): Promise<string> {
		// 5-minute cache with automatic refresh
		// Secure parameter decryption
		// Error handling with fallbacks
	}
}
```

### Parameter Distribution

- **Single Lambda Function**: All parameters loaded on cold start
  - `macro-ai-database-url` - Neon PostgreSQL connection
  - `macro-ai-redis-url` - Upstash Redis connection
  - `macro-ai-openai-key` - OpenAI API authentication
  - `macro-ai-cognito-user-pool-id` - Cognito User Pool ID
  - `macro-ai-cognito-user-pool-client-id` - Cognito App Client ID

---

## 🌐 API Gateway Resource Mapping

### Route-to-Function Mapping

```yaml
API Gateway: "macro-ai-api"
└── /* → single-lambda (Proxy integration for all routes)
    ├── /auth/* (Cognito authorizer on protected routes)
    ├── /users/* (Cognito authorizer required)
    ├── /chats/* (Cognito authorizer required)
    └── /health, /system-info (Public access)
```

### Authentication Configuration

- **Cognito User Pool Authorizer** for protected routes
- **JWT token validation** via API Gateway
- **Public access** for registration, login, health checks

---

## 🚨 Migration Challenges & Solutions

### Challenge 1: Express App Initialization

**Current**: Express server starts once and runs continuously
**Solution**: Initialize Express app on Lambda cold start, reuse across invocations

### Challenge 2: Parameter Store Integration

**Current**: Environment variables loaded at startup
**Solution**: Load parameters from Parameter Store on cold start with caching

### Challenge 3: Database Connection Management

**Current**: Connection pool shared across all requests
**Solution**: Reuse database connections across Lambda invocations with proper cleanup

### Challenge 4: Streaming Responses

**Current**: Express `res.write()` streaming for AI responses
**Solution**: Lambda response streaming or chunked responses via API Gateway

---

## 📋 Implementation Roadmap

### Implementation Priority

1. **Single Lambda Setup** - Create project structure and serverless-http wrapper
2. **Parameter Store Integration** - Load configuration from Parameter Store
3. **Lambda Handler Implementation** - Wrap Express app with Lambda handler
4. **API Gateway Integration** - Configure proxy integration for all routes
5. **Testing & Validation** - Ensure all Express functionality works in Lambda

### Utilities Required

- Parameter Store service with caching
- Lambda handler with serverless-http wrapper
- Express app initialization for Lambda context
- Connection reuse and cleanup utilities

---

## 💰 Cost & Performance Optimization

### Memory Allocation Strategy

- **Single Lambda**: 1024MB (£0.000001667/100ms)
- **Monthly Cost**: ~£0.0005 for 1000 requests (within free tier)
- **Bundle Size**: ~5MB (all Express dependencies included)
- **Execution Time**: 100-500ms average per request

### Cold Start Mitigation

- **Parameter caching** with 5-minute TTL for faster subsequent requests
- **Connection reuse** across Lambda invocations
- **Express app initialization** only on cold start
- **Optimized bundle** with tree shaking and minification

---

## ✅ Analysis Outcomes

### Ready for Implementation

1. ✅ **Single Lambda architecture defined** with serverless-http wrapper
2. ✅ **Parameter Store integration planned** with security patterns
3. ✅ **API Gateway proxy integration** mapped for all routes
4. ✅ **Migration challenges identified** with practical solutions
5. ✅ **Cost optimization strategy** within free tier limits

### Next Steps

- **Task 2**: Single Lambda Setup - Project Structure & Configuration
- **Task 3**: Parameter Store Integration - Lambda Environment Setup
- **Task 4**: Lambda Handler Implementation - Express App Wrapper
- **Task 5**: API Gateway Setup - REST API Integration

---

**Analysis Status**: ✅ **COMPLETE**
**Ready for Phase 2 Implementation**: ✅ **YES**
**Estimated Conversion Time**: ~8 hours total (60% reduction from multi-lambda)

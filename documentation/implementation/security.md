# Security Implementation

## API Security Layer Implementation

### Express API Security Updates (`/apps/express-api`)

- [x] Implement API Key Authentication

  - [x] Create `src/middleware/apiKeyAuth.ts`
  - [x] Add API key validation middleware
  - [x] Update environment variables
  - [x] Add API key documentation

- [x] Enhanced Security Headers

  - [x] Create `src/middleware/securityHeaders.ts`
  - [x] Implement Helmet configuration
  - [x] Add custom security headers
  - [x] Configure CORS properly

- [x] Rate Limiting Implementation

  - [x] Add Express rate limiter middleware
  - [x] Configure rate limits per endpoint
  - [x] Add rate limit headers
  - [ ] Implement rate limit bypass for trusted clients

- [x] Request Validation Enhancement

  - [x] Add request validation middleware
  - [x] Implement input sanitization
  - [x] Add schema validation for all endpoints
  - [x] Create custom validation error responses

- [ ] Audit Logging System
  - [ ] Create `src/middleware/auditLogger.ts`
  - [ ] Log security-relevant events
  - [ ] Add request tracking IDs
  - [ ] Implement structured logging format

### Client UI Security Updates (`/apps/client-ui`)

- [ ] API Client Security

  - [x] Update Axios configuration with API key
  - [x] Add request/response interceptors
  - [x] Implement retry logic with backoff
  - [ ] Add request timeout handling

- [ ] Environment Configuration
  - [ ] Add security-related environment variables
  - [x] Implement environment validation
  - [x] Add environment type definitions

## Rate Limiting Implementation Details

### Rate Limiting Packages Evaluation

Several well-supported packages were evaluated for implementing rate limiting:

1. **express-rate-limit** (Selected)

   - Lightweight and focused on Express
   - Simple configuration
   - Memory store by default with support for Redis and other stores
   - Active maintenance and wide adoption

2. **rate-limiter-flexible**

   - More advanced features and flexibility
   - Multiple storage options (Redis, Memcached, MongoDB)
   - Support for distributed systems
   - Higher complexity for basic use cases

3. **express-brute**

   - Prevention of brute force attacks
   - Less active maintenance
   - More focused on authentication endpoints

4. **@nestjs/throttler**
   - Designed for NestJS but can be adapted
   - Decorator-based approach
   - Good for microservices architecture

### Implementation with express-rate-limit

The rate limiting middleware was implemented using `express-rate-limit` with the following configuration:

```typescript
// apps/express-api/src/middleware/rate-limit.middleware.ts
import { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { StatusCodes } from 'http-status-codes'

import { config } from '../../config/default.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

// Default rate limit configuration
const defaultRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // 100 requests per windowMs
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	message: {
		status: StatusCodes.TOO_MANY_REQUESTS,
		message: 'Too many requests, please try again later.',
	},
	handler: (req: Request, res: Response, next: NextFunction, options: any) => {
		logger.warn(
			`[middleware - rateLimit]: Rate limit exceeded for IP: ${req.ip}`,
		)
		res.status(options.statusCode).json(options.message)
	},
})

// Stricter rate limit for authentication endpoints
const authRateLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	limit: 10, // 10 requests per hour
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		status: StatusCodes.TOO_MANY_REQUESTS,
		message: 'Too many authentication attempts, please try again later.',
	},
	handler: (req: Request, res: Response, next: NextFunction, options: any) => {
		logger.warn(
			`[middleware - rateLimit]: Auth rate limit exceeded for IP: ${req.ip}`,
		)
		res.status(options.statusCode).json(options.message)
	},
})

// API rate limiter for endpoints that require API key
const apiRateLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	limit: 60, // 60 requests per minute
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		status: StatusCodes.TOO_MANY_REQUESTS,
		message: 'API rate limit exceeded, please try again later.',
	},
	handler: (req: Request, res: Response, next: NextFunction, options: any) => {
		logger.warn(
			`[middleware - rateLimit]: API rate limit exceeded for IP: ${req.ip}`,
		)
		res.status(options.statusCode).json(options.message)
	},
})

export { defaultRateLimiter, authRateLimiter, apiRateLimiter }
```

### Application to Authentication Routes

The rate limiting middleware was applied to authentication endpoints:

```typescript
// apps/express-api/src/features/auth/auth.routes.ts
import { Router } from 'express'
import { authRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import { authController } from './auth.controller.ts'

const authRouter = (router: Router) => {
	/**
	 * @swagger
	 * /auth/register:
	 *   post:
	 *     summary: Register a new user
	 *     description: Creates a new user account
	 *     tags: [Authentication]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/RegisterRequest'
	 *     responses:
	 *       201:
	 *         description: User registered successfully
	 *       400:
	 *         description: Invalid input
	 *       429:
	 *         description: Too many requests
	 *       500:
	 *         description: Internal server error
	 */
	router.post('/auth/register', authRateLimiter, authController.register)

	/**
	 * @swagger
	 * /auth/login:
	 *   post:
	 *     summary: Login user
	 *     description: Authenticates a user and returns tokens
	 *     tags: [Authentication]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/LoginRequest'
	 *     responses:
	 *       200:
	 *         description: Login successful
	 *       400:
	 *         description: Invalid credentials
	 *       429:
	 *         description: Too many requests
	 *       500:
	 *         description: Internal server error
	 */
	router.post('/auth/login', authRateLimiter, authController.login)

	/**
	 * @swagger
	 * /auth/forgot-password:
	 *   post:
	 *     summary: Forgot password
	 *     description: Initiates the password reset process
	 *     tags: [Authentication]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/ForgotPasswordRequest'
	 *     responses:
	 *       200:
	 *         description: Password reset initiated
	 *       400:
	 *         description: Invalid input
	 *       429:
	 *         description: Too many requests
	 *       500:
	 *         description: Internal server error
	 */
	router.post(
		'/auth/forgot-password',
		authRateLimiter,
		authController.forgotPassword,
	)

	// Other routes...
}

export { authRouter }
```

### Global Rate Limiting

Global rate limiting was applied to all routes in the Express application:

```typescript
// apps/express-api/src/utils/server.ts
import express from 'express'
import { defaultRateLimiter } from '../middleware/rate-limit.middleware.ts'

export const createServer = () => {
	const app = express()

	// Apply global rate limiting to all routes
	app.use(defaultRateLimiter)

	// Other middleware and route setup...

	return app
}
```

### Redis Store for Production

For production environments, a Redis store was configured to handle distributed rate limiting:

```typescript
// apps/express-api/src/middleware/rate-limit.middleware.ts
import { RedisStore } from 'rate-limit-redis'
import { createClient } from 'redis'

let store = undefined

// Set up Redis store for production environments
if (config.nodeEnv === 'production' && config.redisUrl) {
	const redisClient = createClient({
		url: config.redisUrl,
		socket: {
			connectTimeout: 50000,
		},
	})

	redisClient.connect().catch((err) => {
		logger.error(`[middleware - rateLimit]: Redis connection error: ${err}`)
	})

	store = new RedisStore({
		sendCommand: (...args: string[]) => redisClient.sendCommand(args),
	})

	logger.info('[middleware - rateLimit]: Using Redis store for rate limiting')
}

// Update rate limiters to use Redis store in production
const defaultRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: true,
	legacyHeaders: false,
	store: store, // Use Redis store if available
	// Other options...
})

// Similar updates for authRateLimiter and apiRateLimiter
```

### Environment Configuration

Environment variables were added to support rate limiting configuration:

```
# .env.example additions
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=3600000
AUTH_RATE_LIMIT_MAX_REQUESTS=10
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX_REQUESTS=60
REDIS_URL=redis://localhost:6379
```

### Future Enhancements

- [ ] Implement rate limit bypass for trusted clients
- [ ] Add dynamic rate limiting based on user roles
- [ ] Implement IP-based blocking after repeated violations
- [ ] Add monitoring and alerting for rate limit breaches

## Documentation Updates - API Security

- [ ] Security Documentation

  - [ ] Document API key usage

    - [ ] Create guide in `documentation/security/api-key-usage.md`
    - [ ] Document API key generation process
    - [ ] Document API key rotation procedures
    - [ ] Add examples of API key usage in different environments

  - [ ] List security headers and their purpose

    - [ ] Create guide in `documentation/security/headers.md`
    - [ ] Document each header's purpose and configuration
    - [ ] Add examples of security header implementation

  - [x] Describe rate limiting configuration

    - [x] Create guide in `documentation/security/rate-limiting.md`
    - [x] Document rate limit thresholds and algorithms
    - [ ] Explain bypass mechanisms for trusted clients

  - [ ] Add security best practices guide

    - [ ] Create guide in `documentation/security/best-practices.md`
    - [ ] Include authentication best practices
    - [ ] Include API security best practices
    - [ ] Include client-side security best practices

  - [ ] Document error handling procedures
    - [ ] Create guide in `documentation/security/error-handling.md`
    - [ ] Document error logging and monitoring
    - [ ] Document error response standardization
    - [ ] Include examples of secure error handling

## Testing Updates

- [ ] Security Testing (`/apps/express-api/tests/security`)
  - [ ] Add API key authentication tests
  - [ ] Add security headers tests
  - [x] Add rate limiting tests
  - [ ] Add input validation tests

## Deployment Updates - Production Environment

- [ ] Security Configuration for Production
  - [x] Configure production-specific security settings
  - [ ] Set up secure environment variable management
  - [ ] Configure production CORS settings

## Monitoring and Maintenance

- [ ] Security Monitoring Setup

  - [ ] Set up security event logging
  - [ ] Configure alerts for suspicious activities
  - [ ] Implement regular security audits

- [ ] Dependency Management
  - [ ] Set up automated dependency vulnerability scanning
  - [ ] Implement dependency update process
  - [ ] Document dependency security review procedures

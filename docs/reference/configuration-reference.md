# Configuration Reference

## Current Implementation Status ✅ PRODUCTION-READY

This document provides comprehensive configuration reference for the Macro AI application, including all
environment variables, configuration files, validation schemas, and deployment-specific settings. The
configuration system is **fully implemented and production-ready** with type-safe validation and
environment-specific configurations.

## 🔧 Configuration Overview

### Configuration Architecture ✅ IMPLEMENTED

```mermaid
flowchart TB
    subgraph "Configuration Sources"
        ENV_FILES[Environment Files]
        ENV_VARS[Environment Variables]
        DEFAULTS[Default Values]
    end

    subgraph "Validation Layer"
        ZOD_SCHEMAS[Zod Schemas]
        TYPE_SAFETY[TypeScript Types]
        RUNTIME_VALIDATION[Runtime Validation]
    end

    subgraph "Application Configuration"
        EXPRESS_CONFIG[Express API Config]
        CLIENT_CONFIG[Client UI Config]
        SHARED_CONFIG[Shared Configuration]
    end

    ENV_FILES --> ZOD_SCHEMAS
    ENV_VARS --> ZOD_SCHEMAS
    DEFAULTS --> ZOD_SCHEMAS

    ZOD_SCHEMAS --> TYPE_SAFETY
    ZOD_SCHEMAS --> RUNTIME_VALIDATION

    TYPE_SAFETY --> EXPRESS_CONFIG
    TYPE_SAFETY --> CLIENT_CONFIG
    TYPE_SAFETY --> SHARED_CONFIG
```

### Configuration Files Structure ✅ IMPLEMENTED

```text
macro-ai/
├── apps/
│   ├── express-api/
│   │   ├── .env.example              # Template for API configuration
│   │   ├── .env                      # Local API configuration
│   │   ├── config/default.ts         # Configuration loader
│   │   └── src/utils/env.schema.ts   # Environment validation schema
│   └── client-ui/
│       ├── .env.example              # Template for UI configuration
│       ├── .env                      # Local UI configuration
│       └── src/lib/schemas/environment.schema.ts  # UI validation schema
└── .env                              # Optional root-level shared variables
```

## 🚀 Express API Configuration

### Environment Variables ✅ IMPLEMENTED

#### API Configuration

| Variable      | Type   | Required | Default       | Description                                                             |
| ------------- | ------ | -------- | ------------- | ----------------------------------------------------------------------- |
| `API_KEY`     | string | ✅       | -             | API authentication key (min 32 chars)                                   |
| `NODE_ENV`    | enum   | ❌       | `development` | Environment: `development`, `production`, `test`                        |
| `APP_ENV`     | enum   | ❌       | `development` | Application environment: `development`, `staging`, `production`, `test` |
| `SERVER_PORT` | number | ❌       | `3040`        | Server port number                                                      |

**API_KEY Generation**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Environment Variable Strategy**:

Macro AI uses a **two-variable environment pattern** for enterprise-grade deployments:

- **`NODE_ENV`**: Controls third-party library behavior (Express, React, webpack optimizations)
- **`APP_ENV`**: Controls application-specific logic (URLs, feature flags, configurations)

**Why Two Variables?**

- **Library Optimizations**: Staging environments use `NODE_ENV=production` to get the same performance optimizations as
  production
- **Application Logic**: `APP_ENV=staging` allows staging-specific behavior while maintaining production-level library
  performance
- **Enterprise Best Practice**: Aligns with industry standards for multi-environment deployments

#### AWS Cognito Configuration

| Variable                           | Type   | Required | Default | Description                     |
| ---------------------------------- | ------ | -------- | ------- | ------------------------------- |
| `AWS_COGNITO_REGION`               | string | ✅       | -       | AWS region (e.g., `us-east-1`)  |
| `AWS_COGNITO_USER_POOL_ID`         | string | ✅       | -       | Cognito User Pool ID            |
| `AWS_COGNITO_USER_POOL_CLIENT_ID`  | string | ✅       | -       | Cognito User Pool Client ID     |
| `AWS_COGNITO_USER_POOL_SECRET_KEY` | string | ✅       | -       | Cognito User Pool Client Secret |
| `AWS_COGNITO_ACCESS_KEY`           | string | ✅       | -       | AWS Access Key ID               |
| `AWS_COGNITO_SECRET_KEY`           | string | ✅       | -       | AWS Secret Access Key           |
| `AWS_COGNITO_REFRESH_TOKEN_EXPIRY` | number | ❌       | `30`    | Refresh token expiry (days)     |

#### Cookie Configuration

| Variable                | Type   | Required | Default     | Description                          |
| ----------------------- | ------ | -------- | ----------- | ------------------------------------ |
| `COOKIE_DOMAIN`         | string | ❌       | `localhost` | Cookie domain for authentication     |
| `COOKIE_ENCRYPTION_KEY` | string | ✅       | -           | Cookie encryption key (min 32 chars) |

**Cookie Encryption Key Generation**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Database Configuration

| Variable                      | Type   | Required | Default | Description               |
| ----------------------------- | ------ | -------- | ------- | ------------------------- |
| `RELATIONAL_DATABASE_URL`     | string | ✅       | -       | PostgreSQL connection URL |
| `NON_RELATIONAL_DATABASE_URL` | string | ✅       | -       | Redis connection URL      |

**Database URL Formats**:

```bash
# PostgreSQL
RELATIONAL_DATABASE_URL=postgresql://username:password@host:port/database

# Redis
NON_RELATIONAL_DATABASE_URL=redis://username:password@host:port/database
```

#### OpenAI Configuration

| Variable         | Type   | Required | Default | Description                        |
| ---------------- | ------ | -------- | ------- | ---------------------------------- |
| `OPENAI_API_KEY` | string | ✅       | -       | OpenAI API key (starts with `sk-`) |

#### Rate Limiting Configuration

| Variable                       | Type   | Required | Default   | Description                       |
| ------------------------------ | ------ | -------- | --------- | --------------------------------- |
| `RATE_LIMIT_WINDOW_MS`         | number | ❌       | `900000`  | Global rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS`      | number | ❌       | `100`     | Max requests per window           |
| `AUTH_RATE_LIMIT_WINDOW_MS`    | number | ❌       | `3600000` | Auth rate limit window (1 hour)   |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | number | ❌       | `10`      | Max auth requests per window      |
| `API_RATE_LIMIT_WINDOW_MS`     | number | ❌       | `60000`   | API rate limit window (1 min)     |
| `API_RATE_LIMIT_MAX_REQUESTS`  | number | ❌       | `60`      | Max API requests per window       |
| `REDIS_URL`                    | string | ❌       | -         | Redis URL for rate limiting store |

### Environment Validation Schema ✅ IMPLEMENTED

```typescript
// apps/express-api/src/utils/env.schema.ts
import { z } from 'zod'

const envSchema = z.object({
	// API Configuration
	API_KEY: z
		.string({
			required_error: 'API key is required',
		})
		.min(32, 'API key must be at least 32 characters'),
	NODE_ENV: z
		.enum(['development', 'production', 'test'])
		.default('development'),
	SERVER_PORT: z.coerce.number().default(3040),

	// AWS Cognito
	AWS_COGNITO_REGION: z.string().min(1, 'AWS Cognito region is required'),
	AWS_COGNITO_USER_POOL_ID: z
		.string()
		.min(1, 'AWS Cognito user pool ID is required'),
	AWS_COGNITO_USER_POOL_CLIENT_ID: z
		.string()
		.min(1, 'AWS Cognito user pool client ID is required'),
	AWS_COGNITO_USER_POOL_SECRET_KEY: z
		.string()
		.min(1, 'AWS Cognito user pool secret key is required'),
	AWS_COGNITO_ACCESS_KEY: z
		.string()
		.min(1, 'AWS Cognito access key is required'),
	AWS_COGNITO_SECRET_KEY: z
		.string()
		.min(1, 'AWS Cognito secret key is required'),
	AWS_COGNITO_REFRESH_TOKEN_EXPIRY: z.coerce.number().default(30),

	// Cookie Settings
	COOKIE_DOMAIN: z.string().default('localhost'),
	COOKIE_ENCRYPTION_KEY: z
		.string({
			required_error: 'Cookie encryption key is required',
		})
		.min(32, 'Cookie encryption key must be at least 32 characters'),

	// Database
	NON_RELATIONAL_DATABASE_URL: z
		.string()
		.min(1, 'Non-relational database URL is required'),
	RELATIONAL_DATABASE_URL: z
		.string()
		.min(1, 'Relational database URL is required'),

	// OpenAI
	OPENAI_API_KEY: z
		.string()
		.min(1, 'OpenAI API key is required')
		.startsWith('sk-', 'OpenAI API key must start with sk-'),

	// Rate Limiting
	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
	RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
	AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000), // 1 hour
	AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),
	API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
	API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60),
	REDIS_URL: z.string().optional(),
})

export { envSchema }
```

### Configuration Loading ✅ IMPLEMENTED

```typescript
// apps/express-api/config/default.ts
import { loadConfig } from '../src/utils/load-config.ts'

const [env, error] = loadConfig()

if (error) {
	console.error('Failed to load configuration:', error.message)
	process.exit(1)
}

const config = {
	apiKey: env.API_KEY,
	nodeEnv: env.NODE_ENV,
	port: env.SERVER_PORT,
	awsCognitoRegion: env.AWS_COGNITO_REGION,
	awsCognitoUserPoolId: env.AWS_COGNITO_USER_POOL_ID,
	awsCognitoUserPoolClientId: env.AWS_COGNITO_USER_POOL_CLIENT_ID,
	awsCognitoUserPoolSecretKey: env.AWS_COGNITO_USER_POOL_SECRET_KEY,
	awsCognitoAccessKey: env.AWS_COGNITO_ACCESS_KEY,
	awsCognitoSecretKey: env.AWS_COGNITO_SECRET_KEY,
	awsCognitoRefreshTokenExpiry: env.AWS_COGNITO_REFRESH_TOKEN_EXPIRY,
	cookieDomain: env.COOKIE_DOMAIN,
	cookieEncryptionKey: env.COOKIE_ENCRYPTION_KEY,
	nonRelationalDatabaseUrl: env.NON_RELATIONAL_DATABASE_URL,
	relationalDatabaseUrl: env.RELATIONAL_DATABASE_URL,
	openaiApiKey: env.OPENAI_API_KEY,
	rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
	rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
	authRateLimitWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
	authRateLimitMaxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
	apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
	apiRateLimitMaxRequests: env.API_RATE_LIMIT_MAX_REQUESTS,
	redisUrl: env.REDIS_URL,
}

export { config }
```

## 🎨 Client UI Configuration

### Environment Variables ✅ IMPLEMENTED

| Variable       | Type   | Required | Default | Description                                 |
| -------------- | ------ | -------- | ------- | ------------------------------------------- |
| `VITE_API_URL` | string | ✅       | -       | Complete API URL including `/api` path      |
| `VITE_API_KEY` | string | ✅       | -       | API key matching Express API (min 32 chars) |

**Note**: All client-side environment variables must be prefixed with `VITE_` to be accessible in the browser.

### Environment Validation Schema ✅ IMPLEMENTED

```typescript
// apps/client-ui/src/lib/schemas/environment.schema.ts
import { z } from 'zod'

export const envSchema = z.object({
	VITE_API_URL: z
		.string({
			required_error: 'API URL is required',
		})
		.url('Invalid API URL'),
	VITE_API_KEY: z
		.string({
			required_error: 'API key is required',
		})
		.min(32, 'API key must be at least 32 characters long'),
})

export type TEnv = z.infer<typeof envSchema>
```

### Environment Validation ✅ IMPLEMENTED

```typescript
// apps/client-ui/src/lib/validation/environment.ts
import { standardizeError } from '../errors/standardize-error'
import { logger } from '../logger/logger'
import { envSchema } from '../schemas/environment.schema'

export const validateEnvironment = () => {
	try {
		const env = {
			VITE_API_URL: import.meta.env.VITE_API_URL,
			VITE_API_KEY: import.meta.env.VITE_API_KEY,
		}

		const result = envSchema.safeParse(env)

		if (!result.success) {
			const error = standardizeError(result.error)
			logger.error('Environment validation failed:', error.message)
			throw new Error(`Invalid environment configuration: ${error.message}`)
		}

		return result.data
	} catch (error) {
		const err = standardizeError(error)
		logger.error('Failed to validate environment:', err.message)
		throw new Error(`Environment validation failed: ${err.message}`)
	}
}
```

## 🌍 Environment-Specific Configurations

### Development Environment ✅ IMPLEMENTED

```bash
# Express API (.env)
NODE_ENV=development
APP_ENV=development
API_KEY=dev-32-character-key-for-local-development
SERVER_PORT=3040
COOKIE_DOMAIN=localhost
COOKIE_ENCRYPTION_KEY=dev-32-character-encryption-key-here
RELATIONAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/macro_ai_dev
NON_RELATIONAL_DATABASE_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-your-development-openai-key
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_YourPoolId
AWS_COGNITO_USER_POOL_CLIENT_ID=YourClientId
AWS_COGNITO_USER_POOL_SECRET_KEY=YourSecretKey
AWS_COGNITO_ACCESS_KEY=YourAccessKey
AWS_COGNITO_SECRET_KEY=YourSecretKey
AWS_COGNITO_REFRESH_TOKEN_EXPIRY=30

# Client UI (.env)
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=dev-32-character-key-for-local-development
```

## 🏗️ Infrastructure Scaling Strategy

Environments (staging/production) can operate at different infrastructure scales:

- **Hobby Scale**: Cost-optimized for <£10/month (Neon, Upstash, Lambda)
- **Enterprise Scale**: Production-ready for £100-300/month (RDS, ElastiCache, ECS)

### Environment + Scale Matrix

| Environment | Default Scale | Upgrade Path | Cost Target       |
| ----------- | ------------- | ------------ | ----------------- |
| staging     | hobby         | N/A          | <£5/month         |
| production  | hobby         | enterprise   | <£10 → £300/month |

### Staging Environment (Hobby Scale) 📋 PLANNED

```bash
# Express API
NODE_ENV=production    # Uses production for library optimizations
APP_ENV=staging        # Application knows it's staging
CDK_DEPLOY_SCALE=hobby # Infrastructure scale
API_KEY=staging-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=staging.macro-ai.com
COOKIE_ENCRYPTION_KEY=staging-32-character-encryption-key
RELATIONAL_DATABASE_URL=postgresql://staging_user:secure_pass@neon-staging:5432/macro_ai_staging?sslmode=require
NON_RELATIONAL_DATABASE_URL=redis://upstash-staging:6379/0
OPENAI_API_KEY=sk-your-staging-openai-key

# Client UI
VITE_API_URL=https://api-staging.macro-ai.com/api
VITE_API_KEY=staging-unique-32-character-key-here
```

### Production Environment (Hobby Scale → Enterprise Scale) 📋 PLANNED

#### Production (Hobby Scale)

```bash
# Express API
NODE_ENV=production
APP_ENV=production
CDK_DEPLOY_SCALE=hobby # Cost-optimized infrastructure
API_KEY=production-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=macro-ai.com
COOKIE_ENCRYPTION_KEY=production-32-character-encryption-key
RELATIONAL_DATABASE_URL=postgresql://prod_user:secure_pass@neon-prod:5432/macro_ai_prod?sslmode=require
NON_RELATIONAL_DATABASE_URL=redis://upstash-prod:6379/0
OPENAI_API_KEY=sk-your-production-openai-key

# Client UI
VITE_API_URL=https://api.macro-ai.com/api
VITE_API_KEY=production-unique-32-character-key-here
```

#### Production (Enterprise Scale)

```bash
# Express API
NODE_ENV=production
APP_ENV=production
CDK_DEPLOY_SCALE=enterprise # Full AWS managed services
API_KEY=production-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=macro-ai.com
COOKIE_ENCRYPTION_KEY=production-32-character-encryption-key
RELATIONAL_DATABASE_URL=postgresql://prod_user:very_secure_pass@rds-prod:5432/macro_ai_prod?sslmode=require
NON_RELATIONAL_DATABASE_URL=redis://elasticache-prod:6379/0
OPENAI_API_KEY=sk-your-production-openai-key

# Client UI
VITE_API_URL=https://api.macro-ai.com/api
VITE_API_KEY=production-unique-32-character-key-here
```

## 🔐 Security Configuration

### Cookie Security Settings ✅ IMPLEMENTED

```typescript
// Cookie configuration based on environment
const cookieOptions = {
	httpOnly: true,
	secure: config.nodeEnv === 'production',
	sameSite: 'strict' as const,
	domain: config.cookieDomain,
	maxAge: 60 * 60 * 1000, // 1 hour
	path: '/',
}
```

### Rate Limiting Configuration ✅ IMPLEMENTED

```typescript
// Rate limiting configuration
const rateLimitConfig = {
	// Global rate limit
	global: {
		windowMs: config.rateLimitWindowMs, // 15 minutes
		max: config.rateLimitMaxRequests, // 100 requests
	},

	// Authentication endpoints
	auth: {
		windowMs: config.authRateLimitWindowMs, // 1 hour
		max: config.authRateLimitMaxRequests, // 10 requests
	},

	// API endpoints
	api: {
		windowMs: config.apiRateLimitWindowMs, // 1 minute
		max: config.apiRateLimitMaxRequests, // 60 requests
	},
}
```

## 🧪 Configuration Testing

### Validation Testing ✅ IMPLEMENTED

```bash
# Test Express API configuration
cd apps/express-api
pnpm run config:validate

# Test Client UI configuration
cd apps/client-ui
pnpm run config:validate
```

### Configuration Validation Scripts ✅ IMPLEMENTED

```typescript
// Validation script example
import { envSchema } from './src/utils/env.schema.ts'

const validateConfig = () => {
	const result = envSchema.safeParse(process.env)

	if (!result.success) {
		console.error('❌ Configuration validation failed:')
		result.error.errors.forEach((error) => {
			console.error(`  - ${error.path.join('.')}: ${error.message}`)
		})
		process.exit(1)
	}

	console.log('✅ Configuration validation passed')
	return result.data
}

validateConfig()
```

## 📚 Related Documentation

- **[Environment Configuration](../getting-started/environment-configuration.md)** - Detailed setup guide for all environments
- **[Environment Setup](../deployment/environment-setup.md)** - Deployment-specific environment configuration
- **[Development Setup](../getting-started/development-setup.md)** - Local development environment setup
- **[Security Architecture](../architecture/security-architecture.md)** - Security configuration and best practices
- **[Database Operations](../operations/database-operations.md)** - Database configuration and connection management

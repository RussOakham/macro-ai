# Environment Configuration

## Current Implementation Status ✅ PRODUCTION-READY

This guide provides comprehensive documentation for configuring environment variables across all Macro AI applications.
The configuration system is **fully implemented and validated** with automatic environment validation and CI/CD
integration to ensure consistent deployments.

## 📋 Configuration Overview

### Environment Files Structure

```text
macro-ai/
├── apps/
│   ├── express-api/
│   │   ├── .env.example          # Template for API configuration
│   │   └── .env                  # Your local API configuration
│   └── client-ui/
│       ├── .env.example          # Template for UI configuration
│       └── .env                  # Your local UI configuration
└── .env                          # Optional root-level shared variables
```

### Configuration Validation

All environment variables are validated at application startup using Zod schemas to ensure type safety and prevent
runtime configuration errors.

## 🔧 Express API Configuration

### Complete Environment Setup

Create `apps/express-api/.env` from the template:

```bash
cp apps/express-api/.env.example apps/express-api/.env
```

### Required Configuration Variables

#### API Configuration

```bash
# API Configuration
API_KEY=your-32-character-api-key-here
SERVER_PORT=3040
```

**API_KEY Requirements:**

- Minimum 32 characters
- Used for API authentication and security
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**SERVER_PORT:**

- Default: 3040
- Must not conflict with other services
- Frontend expects API on this port

#### AWS Cognito Configuration

```bash
# AWS Cognito Configuration
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_COGNITO_USER_POOL_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# AWS credentials are no longer required - using IAM roles instead
AWS_COGNITO_REFRESH_TOKEN_EXPIRY=30
```

**Configuration Details:**

- **AWS_COGNITO_REGION**: AWS region where your Cognito User Pool is located
- **AWS_COGNITO_USER_POOL_ID**: Unique identifier for your Cognito User Pool
- **AWS_COGNITO_USER_POOL_CLIENT_ID**: App client ID from your User Pool
- **AWS_COGNITO_USER_POOL_SECRET_KEY**: App client secret (confidential clients only)
- **AWS_COGNITO_REFRESH_TOKEN_EXPIRY**: Token expiry in days (align with AWS settings)

**IAM Role Authentication:**

The application now uses AWS IAM roles instead of hardcoded credentials for enhanced security:

- ECS tasks automatically use the task role for AWS service authentication
- No need to manage or rotate access keys
- Follows AWS security best practices
- Eliminates credential storage in environment variables

#### Cookie Configuration

```bash
# Cookie Configuration
COOKIE_DOMAIN=localhost
COOKIE_ENCRYPTION_KEY=your-32-character-encryption-key-here
```

**Configuration Details:**

- **COOKIE_DOMAIN**: Domain for authentication cookies (localhost for development)
- **COOKIE_ENCRYPTION_KEY**: 32+ character key for cookie encryption
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### Database Configuration

```bash
# Database Configuration
RELATIONAL_DATABASE_URL=postgresql://username:password@localhost:5432/database_name
REDIS_URL=redis://localhost:6379
```

**PostgreSQL URL Format:**

```text
postgresql://[username]:[password]@[host]:[port]/[database]
```

**Example Configurations:**

```bash
# Local development
RELATIONAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/macro_ai_dev

# Docker development
RELATIONAL_DATABASE_URL=postgresql://postgres:password@postgres:5432/macro_ai_dev

# Production (with SSL)
RELATIONAL_DATABASE_URL=postgresql://user:pass@prod-host:5432/macro_ai_prod?sslmode=require
```

#### OpenAI Configuration

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Requirements:**

- Valid OpenAI API key starting with `sk-`
- Sufficient credits for development and testing
- Access to GPT-4 models (recommended)

#### Rate Limiting Configuration

```bash
# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=3600000
AUTH_RATE_LIMIT_MAX_REQUESTS=10
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX_REQUESTS=60
REDIS_URL=redis://localhost:6379
```

**Rate Limiting Tiers:**

1. **Global Rate Limiting:**
   - Window: 15 minutes (900000ms)
   - Max requests: 100 per window

2. **Authentication Rate Limiting:**
   - Window: 1 hour (3600000ms)
   - Max requests: 10 per window
   - Protects against brute force attacks

3. **API Rate Limiting:**
   - Window: 1 minute (60000ms)
   - Max requests: 60 per window
   - General API protection

**Redis Configuration:**

- Optional but recommended for production
- Used for distributed rate limiting
- Format: `redis://[password@]host:port[/database]`

### Environment Validation Schema

The Express API validates all environment variables using this Zod schema:

```typescript
const envSchema = z.object({
	// API Configuration
	API_KEY: z.string().min(32, 'API key must be at least 32 characters'),
	SERVER_PORT: z.coerce.number().default(3040),

	// AWS Cognito
	AWS_COGNITO_REGION: z.string().min(1),
	AWS_COGNITO_USER_POOL_ID: z.string().min(1),
	AWS_COGNITO_USER_POOL_CLIENT_ID: z.string().min(1),
	AWS_COGNITO_USER_POOL_SECRET_KEY: z.string().min(1),
	// AWS Cognito credentials removed - using IAM roles instead
	AWS_COGNITO_REFRESH_TOKEN_EXPIRY: z.coerce.number().default(30),

	// Cookies
	COOKIE_DOMAIN: z.string().default('localhost'),
	COOKIE_ENCRYPTION_KEY: z.string().min(32),

	// Database
	RELATIONAL_DATABASE_URL: z.url(),
	REDIS_URL: z.url().optional(),

	// OpenAI
	OPENAI_API_KEY: z.string().startsWith('sk-'),

	// Rate Limiting
	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
	RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
	AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000),
	AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),
	API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
	API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60),
	REDIS_URL: z.url().optional(),
})
```

## 🎨 Client UI Configuration

### Complete Environment Setup

Create `apps/client-ui/.env` from the template:

```bash
cp apps/client-ui/.env.example apps/client-ui/.env
```

### Required Configuration Variables

#### API Configuration

```bash
# API Configuration
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=your-32-character-api-key-here
```

**Configuration Details:**

- **VITE_API_URL**: Complete URL to the Express API including `/api` path
- **VITE_API_KEY**: Must match the API_KEY in Express API configuration
- Both variables are prefixed with `VITE_` to be accessible in the browser

**Environment-Specific URLs:**

```bash
# Development
VITE_API_URL=http://localhost:3040/api

# Staging
VITE_API_URL=https://api-staging.macro-ai.com/api

# Production
VITE_API_URL=https://api.macro-ai.com/api
```

### Environment Validation Schema

The Client UI validates environment variables using this Zod schema:

```typescript
const envSchema = z.object({
	VITE_API_URL: z.string().url('API URL must be a valid URL'),
	VITE_API_KEY: z.string().min(32, 'API key must be at least 32 characters'),
})
```

## 🔐 Security Best Practices

### Environment Variable Security

#### Development Environment

1. **Never commit `.env` files** to version control
2. **Use `.env.example` templates** for sharing configuration structure
3. **Generate unique keys** for each developer
4. **Rotate keys regularly** especially for shared development environments

#### Production Environment

1. **Use environment-specific configurations**
2. **Store secrets in secure secret management systems**
3. **Enable SSL/TLS** for all external connections
4. **Use strong, unique keys** for each environment
5. **Implement key rotation policies**

### Key Generation

#### Secure Random Key Generation

```bash
# Generate 32-character hex key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate 64-character hex key
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate base64 key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Key Requirements

- **API Keys**: Minimum 32 characters, alphanumeric + symbols
- **Encryption Keys**: Minimum 32 characters, high entropy
- **Database Passwords**: Minimum 16 characters, mixed case + numbers + symbols
- **JWT Secrets**: Minimum 64 characters for production

## 🌍 Environment-Specific Configurations

### Development Environment

```bash
# Express API (.env)
NODE_ENV=development
APP_ENV=development
API_KEY=dev-32-character-key-for-local-development
SERVER_PORT=3040
COOKIE_DOMAIN=localhost
RELATIONAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/macro_ai_dev
OPENAI_API_KEY=sk-your-development-openai-key

# Client UI (.env)
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=dev-32-character-key-for-local-development
```

### Staging Environment

```bash
# Express API
NODE_ENV=production    # Uses production for library optimizations
APP_ENV=staging        # Application knows it's staging
API_KEY=staging-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=staging.macro-ai.com
RELATIONAL_DATABASE_URL=postgresql://staging_user:secure_pass@staging-db:5432/macro_ai_staging
OPENAI_API_KEY=sk-your-staging-openai-key

# Client UI
VITE_API_URL=https://api-staging.macro-ai.com/api
VITE_API_KEY=staging-unique-32-character-key-here
```

### Production Environment

```bash
# Express API
NODE_ENV=production
APP_ENV=production
API_KEY=production-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=macro-ai.com
RELATIONAL_DATABASE_URL=postgresql://prod_user:very_secure_pass@prod-db:5432/macro_ai_prod?sslmode=require
OPENAI_API_KEY=sk-your-production-openai-key

# Client UI
VITE_API_URL=https://api.macro-ai.com/api
VITE_API_KEY=production-unique-32-character-key-here
```

## 🧪 Configuration Testing

### Validation Testing

Test your configuration before starting development:

```bash
# Test Express API configuration
cd apps/express-api
pnpm run config:validate

# Test database connection
pnpm run db:test-connection

# Test AWS Cognito connection
pnpm run auth:test-connection
```

### Environment Variable Debugging

```bash
# Check loaded environment variables (Express API)
cd apps/express-api
node -e "
require('dotenv').config();
console.log('API_KEY length:', process.env.API_KEY?.length);
console.log('Database URL set:', !!process.env.RELATIONAL_DATABASE_URL);
console.log('OpenAI key format:', process.env.OPENAI_API_KEY?.substring(0, 3));
"
```

### Common Configuration Issues

#### Missing Environment Variables

```bash
# Error: Missing required environment variable
Error: Environment validation failed:
  - API_KEY: Required
  - RELATIONAL_DATABASE_URL: Required

# Solution: Check .env file exists and contains all required variables
```

#### Invalid Environment Variables

```bash
# Error: Invalid API key length
Error: API key must be at least 32 characters

# Solution: Generate new key with proper length
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Database Connection Issues

```bash
# Error: Database connection failed
Error: connect ECONNREFUSED 127.0.0.1:5432

# Solution: Ensure PostgreSQL is running and URL is correct
brew services start postgresql@15  # macOS
sudo systemctl start postgresql    # Linux
```

## 🔄 Configuration Management

### Environment Synchronization

Keep environment configurations synchronized across team members:

1. **Update `.env.example` files** when adding new variables
2. **Document new variables** in this guide
3. **Communicate changes** to team members
4. **Version control** configuration schemas

### Configuration Backup

```bash
# Backup current configuration (excluding secrets)
cp apps/express-api/.env apps/express-api/.env.backup
cp apps/client-ui/.env apps/client-ui/.env.backup

# Create sanitized backup for sharing
sed 's/=.*/=REDACTED/' apps/express-api/.env > apps/express-api/.env.template
```

## 📚 Related Documentation

- **[Development Setup](./development-setup.md)** - Complete development environment setup
- **[Troubleshooting Guide](./troubleshooting.md)** - Configuration troubleshooting
- **[Database Design](../architecture/database-design.md)** - Database configuration details
- **[Authentication System](../features/authentication/README.md)** - AWS Cognito setup details
- **[Deployment Guide](../deployment/environment-setup.md)** - Production environment configuration

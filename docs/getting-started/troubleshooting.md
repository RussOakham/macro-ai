# Troubleshooting Guide

## Current Implementation Status ✅ PRODUCTION-READY

This guide provides comprehensive solutions for common development issues encountered while working with the Macro AI
application. The troubleshooting procedures are **tested and validated** through continuous integration and real-world
development scenarios.

## 🚨 Quick Diagnostic Commands

### System Health Check

```bash
# Check Node.js and pnpm versions
node --version && pnpm --version

# Check if development servers are running
lsof -i :3000  # Frontend
lsof -i :3030  # Backend API

# Test database connection
psql -U postgres -d macro_ai_dev -c "SELECT version();"

# Check environment variables are loaded
cd apps/express-api && node -e "require('dotenv').config(); console.log('Env loaded:', !!process.env.API_KEY)"
```

### Application Status Check

```bash
# Check API health endpoint
curl http://localhost:3030/api/health

# Check frontend accessibility
curl -I http://localhost:3000

# Verify API documentation
curl -I http://localhost:3030/api-docs
```

## 🔧 Installation and Setup Issues

### Node.js Version Issues

#### Problem: Wrong Node.js Version

```bash
# Error message
node: command not found
# OR
Your Node.js version (v18.x.x) is not supported. Please use Node.js 20.x or higher.
```

#### Solution

```bash
# Install Node Version Manager (if not installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source profile
source ~/.bashrc  # or ~/.zshrc

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version  # Should show v20.x.x
```

### pnpm Installation Issues

#### Problem: pnpm Command Not Found

```bash
# Error message
pnpm: command not found
```

#### Solution

```bash
# Install pnpm globally
npm install -g pnpm

# Alternative: Install via corepack (Node.js 16.10+)
corepack enable
corepack prepare pnpm@latest --activate

# Verify installation
pnpm --version  # Should show 9.x.x
```

#### Problem: pnpm Store Corruption

```bash
# Error message
ERR_PNPM_STORE_BROKEN_LOCKFILE
```

#### Solution: Clear pnpm Store

```bash
# Clear pnpm store and cache
pnpm store prune
rm -rf node_modules
rm pnpm-lock.yaml

# Reinstall dependencies
pnpm install
```

### Dependency Installation Issues

#### Problem: Package Installation Failures

```bash
# Error message
ERR_PNPM_PEER_DEP_ISSUES
# OR
EACCES: permission denied
```

#### Solution

```bash
# Fix permission issues (avoid sudo with npm/pnpm)
# Option 1: Change npm's default directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 2: Use pnpm (recommended)
npm install -g pnpm

# Clear and reinstall
rm -rf node_modules
pnpm install --frozen-lockfile
```

## 🗄️ Database Issues

### PostgreSQL Connection Issues

#### Problem: Database Connection Refused

```bash
# Error message
connect ECONNREFUSED 127.0.0.1:5432
# OR
FATAL: database "macro_ai_dev" does not exist
```

#### Solution

```bash
# Check if PostgreSQL is running
# macOS
brew services list | grep postgresql
brew services start postgresql@15

# Linux
sudo systemctl status postgresql
sudo systemctl start postgresql

# Create database if it doesn't exist
createdb macro_ai_dev

# Test connection
psql -U postgres -d macro_ai_dev -c "SELECT version();"
```

#### Problem: Authentication Failed

```bash
# Error message
FATAL: password authentication failed for user "postgres"
# OR
FATAL: role "username" does not exist
```

#### Solution: Reset PostgreSQL Authentication

```bash
# Reset PostgreSQL password (macOS)
brew services stop postgresql@15
postgres -D /opt/homebrew/var/postgresql@15 --single -E postgres
ALTER USER postgres PASSWORD 'newpassword';
# Press Ctrl+D to exit
brew services start postgresql@15

# Create user if doesn't exist
createuser -s postgres
createuser -s $USER

# Update .env file with correct credentials
RELATIONAL_DATABASE_URL=postgresql://postgres:newpassword@localhost:5432/macro_ai_dev
```

### pgvector Extension Issues

#### Problem: pgvector Extension Not Found

```bash
# Error message
ERROR: extension "vector" is not available
```

#### Solution

```bash
# Install pgvector extension
# macOS (Homebrew)
brew install pgvector

# Ubuntu/Debian
sudo apt install postgresql-15-pgvector

# Connect to database and enable extension
psql -U postgres -d macro_ai_dev
CREATE EXTENSION IF NOT EXISTS vector;

# Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
\q
```

### Database Migration Issues

#### Problem: Migration Failures

```bash
# Error message
Migration failed: relation "users" already exists
# OR
Migration failed: column "embedding" does not exist
```

#### Solution

```bash
# Reset database (development only)
cd apps/express-api
pnpm db:reset  # If available

# Or manually reset
psql -U postgres -c "DROP DATABASE IF EXISTS macro_ai_dev;"
psql -U postgres -c "CREATE DATABASE macro_ai_dev;"
psql -U postgres -d macro_ai_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
pnpm db:push
```

## 🔐 Authentication and AWS Issues

### AWS Cognito Configuration Issues

#### Problem: Invalid Cognito Configuration

```bash
# Error message
InvalidParameterException: Invalid UserPoolId format
# OR
NotAuthorizedException: Unable to verify secret hash for client
```

#### Solution

```bash
# Verify AWS Cognito configuration in .env
# Check format of User Pool ID (should be: region_xxxxxxxxx)
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx

# Verify client secret is correct
# Go to AWS Console > Cognito > User Pools > App Clients
# Copy the exact client secret

# Test AWS credentials
aws sts get-caller-identity  # If AWS CLI is configured
```

#### Problem: AWS Credentials Issues

```bash
# Error message
CredentialsError: Missing credentials in config
# OR
AccessDenied: User is not authorized to perform cognito-idp:AdminCreateUser
```

#### Solution: Verify AWS Permissions

```bash
# Verify IAM user has correct permissions
# Required permissions for Cognito operations:
# - cognito-idp:AdminCreateUser
# - cognito-idp:AdminGetUser
# - cognito-idp:ListUsers
# - cognito-idp:SignUp
# - cognito-idp:ConfirmSignUp
# - cognito-idp:InitiateAuth
# - cognito-idp:ForgotPassword
# - cognito-idp:ConfirmForgotPassword
# - cognito-idp:GlobalSignOut

# Update .env with correct credentials
AWS_COGNITO_ACCESS_KEY=AKIAXXXXXXXXXXXXXXXX
AWS_COGNITO_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### OpenAI API Issues

#### Problem: OpenAI API Key Issues

```bash
# Error message
OpenAI API error: Incorrect API key provided
# OR
OpenAI API error: You exceeded your current quota
```

#### Solution

```bash
# Verify API key format (should start with sk-)
echo $OPENAI_API_KEY | head -c 3  # Should show "sk-"

# Check API key validity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[0].id'

# Check usage and billing at https://platform.openai.com/usage
# Add payment method if quota exceeded
```

## 🌐 Development Server Issues

### Port Conflicts

#### Problem: Port Already in Use

```bash
# Error message
Error: listen EADDRINUSE: address already in use :::3000
# OR
Error: listen EADDRINUSE: address already in use :::3030
```

#### Solution

```bash
# Find process using the port
lsof -i :3000  # Frontend
lsof -i :3030  # Backend

# Kill the process
kill -9 <PID>

# Or use different ports
# Update .env files
SERVER_PORT=3031  # Express API
# Update Vite config for frontend port
```

### Frontend Build Issues

#### Problem: Vite Build Failures

```bash
# Error message
[vite]: Rollup failed to resolve import
# OR
Module not found: Can't resolve '@/components/...'
```

#### Solution

```bash
# Check path aliases in vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}

# Clear Vite cache
rm -rf node_modules/.vite
pnpm dev
```

### Backend API Issues

#### Problem: API Routes Not Found

```bash
# Error message
Cannot GET /api/health
# OR
404 Not Found
```

#### Solution

```bash
# Check if Express server is running
curl http://localhost:3030/api/health

# Check server logs for errors
cd apps/express-api
pnpm dev  # Check console output

# Verify route registration in routes/index.ts
# Ensure middleware is properly configured
```

## 🧪 Testing Issues

### Test Execution Failures

#### Problem: Tests Not Running

```bash
# Error message
No test files found
# OR
ReferenceError: vi is not defined
```

#### Solution

```bash
# Ensure Vitest is properly configured
# Check vitest.config.ts exists and is properly configured

# Install test dependencies
pnpm install --dev

# Run tests with verbose output
pnpm test --reporter=verbose

# Check test file naming (should end with .test.ts or .spec.ts)
```

### Mock Issues

#### Problem: Mock Functions Not Working

```bash
# Error message
TypeError: Cannot read property 'mockResolvedValue' of undefined
```

#### Solution

```bash
# Ensure proper mock setup in test files
import { vi } from 'vitest'

// Mock before importing modules that use the mocked dependency
vi.mock('../path/to/module', () => ({
  default: vi.fn(),
  namedExport: vi.fn(),
}))

# Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
```

## 🔍 Debugging Strategies

### Backend Debugging

#### Enable Debug Logging

```bash
# Add to .env
DEBUG=express:*,app:*
LOG_LEVEL=debug

# Or set environment variable
DEBUG=* pnpm dev
```

#### Database Query Debugging

```bash
# Enable Drizzle query logging
# In db.ts
const db = drizzle(pool, {
  logger: true,  // Enable query logging
})
```

### Frontend Debugging

#### Browser Developer Tools

```bash
# Enable React DevTools
# Install React Developer Tools browser extension

# Check Network tab for API calls
# Check Console for JavaScript errors
# Use Sources tab for breakpoint debugging
```

#### Vite Development

```bash
# Enable verbose logging
pnpm dev --debug

# Check for TypeScript errors
pnpm type-check
```

## 🚀 Performance Issues

### Slow Development Server

#### Problem: Slow Hot Reload

```bash
# Symptoms: Changes take long to reflect
# OR: High CPU usage during development
```

#### Solution

```bash
# Exclude unnecessary files from watching
# In vite.config.ts
server: {
  watch: {
    ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
  }
}

# Increase file watcher limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Memory Issues

#### Problem: Out of Memory Errors

```bash
# Error message
FATAL ERROR: Ineffective mark-compacts near heap limit
```

#### Solution

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or add to package.json scripts
"dev": "NODE_OPTIONS='--max-old-space-size=4096' turbo run dev"

# Clear caches
pnpm store prune
rm -rf node_modules/.cache
```

## 📞 Getting Additional Help

### Log Collection

When reporting issues, include:

```bash
# System information
node --version
pnpm --version
psql --version

# Application logs
cd apps/express-api && pnpm dev 2>&1 | tee api.log
cd apps/client-ui && pnpm dev 2>&1 | tee ui.log

# Environment check (sanitized)
cd apps/express-api
node -e "
require('dotenv').config();
console.log('Node version:', process.version);
console.log('API_KEY length:', process.env.API_KEY?.length);
console.log('DB URL set:', !!process.env.RELATIONAL_DATABASE_URL);
console.log('OpenAI key format:', process.env.OPENAI_API_KEY?.substring(0, 3));
"
```

### Support Channels

1. **GitHub Issues**: Create detailed issue with logs and system info
2. **Documentation**: Check related documentation sections
3. **Community**: Join project discussions and forums

### Issue Reporting Template

```markdown
## Issue Description

Brief description of the problem

## Environment

- OS: [macOS/Linux/Windows]
- Node.js version: [output of `node --version`]
- pnpm version: [output of `pnpm --version`]

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Logs

```text
[Paste relevant logs here]
```

## Additional Context

Any other relevant information

## 📚 Related Documentation

- **[Development Setup](./development-setup.md)** - Initial setup instructions
- **[Environment Configuration](./environment-configuration.md)** - Environment variable setup
- **[Database Design](../architecture/database-design.md)** - Database configuration details
- **[Testing Strategy](../development/testing-strategy.md)** - Testing setup and execution
- **[Authentication System](../features/authentication/README.md)** - AWS Cognito troubleshooting

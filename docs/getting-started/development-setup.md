# Development Setup

## Current Implementation Status ✅ PRODUCTION-READY

This guide provides comprehensive instructions for setting up the Macro AI development environment. The setup process
is **fully documented and tested** with automated CI/CD validation to ensure consistency across development environments.

## 📋 Prerequisites

### Required Software

- **Node.js**: Version 20.x or higher
- **pnpm**: Version 9.x (package manager)
- **PostgreSQL**: Version 15+ with pgvector extension
- **Git**: Version control system

### Required Accounts and Services

- **AWS Account**: For Cognito authentication services
- **OpenAI Account**: For AI chat functionality (API key required)
- **GitHub Account**: For repository access and CI/CD

### System Requirements

- **Operating System**: macOS, Linux, or Windows with WSL2
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: At least 2GB free space for dependencies and database
- **Network**: Stable internet connection for package installation and API services

## 🚀 Quick Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/RussOakham/macro-ai.git
cd macro-ai
```

### 2. Install Dependencies

```bash
# Install pnpm globally if not already installed
npm install -g pnpm

# Install all workspace dependencies
pnpm install
```

### 3. Environment Configuration

```bash
# Copy environment templates
cp apps/express-api/.env.example apps/express-api/.env
cp apps/client-ui/.env.example apps/client-ui/.env

# Edit environment files with your configuration
# See Environment Configuration guide for detailed setup
```

### 4. Database Setup

```bash
# Set up PostgreSQL with pgvector (see Database Setup section)
# Run database migrations
pnpm db:push:express-api
```

### 5. Start Development

```bash
# Start all development servers
pnpm dev
```

**Access Points:**

- **Frontend**: <http://localhost:3000>
- **Backend API**: <http://localhost:3040>
- **API Documentation**: <http://localhost:3040/api-docs>

## 🛠️ Detailed Setup Instructions

### Node.js and pnpm Installation

#### Node.js Installation

**Option 1: Using Node Version Manager (Recommended)**

```bash
# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source profile
source ~/.bashrc

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20
```

**Option 2: Direct Installation**

Download and install Node.js 20.x from [nodejs.org](https://nodejs.org/)

**Verification:**

```bash
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x or higher
```

#### pnpm Installation

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version  # Should show 9.x.x
```

### Database Setup (PostgreSQL + pgvector)

#### PostgreSQL Installation

**macOS (using Homebrew):**

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database user
createuser -s postgres
```

**Ubuntu/Debian:**

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user and create database
sudo -u postgres createuser -s $USER
sudo -u postgres createdb macro_ai_dev
```

**Windows (using WSL2):**

Follow the Ubuntu/Debian instructions within your WSL2 environment.

#### pgvector Extension Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and enable pgvector
CREATE DATABASE macro_ai_dev;
\c macro_ai_dev;
CREATE EXTENSION IF NOT EXISTS vector;

# Verify pgvector installation
SELECT * FROM pg_extension WHERE extname = 'vector';

# Exit psql
\q
```

#### Database Configuration

Update your `apps/express-api/.env` file:

```bash
# Database Configuration
RELATIONAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/macro_ai_dev
```

**Test Database Connection:**

```bash
# Navigate to express-api directory
cd apps/express-api

# Test database connection and run migrations
pnpm db:push
```

### AWS Cognito Configuration

#### 1. Create AWS Cognito User Pool

**AWS Console Setup:**

1. Navigate to AWS Cognito in the AWS Console
2. Create a new User Pool with these settings:
   - **Sign-in options**: Email
   - **Password policy**: Custom (8-15 characters, mixed case, numbers, symbols)
   - **MFA**: Optional (recommended for production)
   - **User account recovery**: Email only

3. Configure App Client:
   - **App type**: Confidential client
   - **Authentication flows**: ALLOW_USER_PASSWORD_AUTH
   - **Generate client secret**: Yes

#### 2. Configure Environment Variables

Update `apps/express-api/.env`:

```bash
# AWS Cognito Configuration
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
AWS_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_COGNITO_USER_POOL_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# AWS credentials are no longer required - using IAM roles instead
# AWS_COGNITO_ACCESS_KEY=AKIAXXXXXXXXXXXXXXXX
# AWS_COGNITO_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_COGNITO_REFRESH_TOKEN_EXPIRY=30
```

#### 3. IAM Role Setup (Production/ECS)

For production and ECS deployments, the application uses IAM roles instead of hardcoded credentials:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"cognito-idp:AdminCreateUser",
				"cognito-idp:AdminDeleteUser",
				"cognito-idp:AdminGetUser",
				"cognito-idp:AdminUpdateUserAttributes",
				"cognito-idp:ListUsers",
				"cognito-idp:SignUp",
				"cognito-idp:ConfirmSignUp",
				"cognito-idp:InitiateAuth",
				"cognito-idp:RespondToAuthChallenge",
				"cognito-idp:ForgotPassword",
				"cognito-idp:ConfirmForgotPassword",
				"cognito-idp:GlobalSignOut"
			],
			"Resource": "arn:aws:cognito-idp:*:*:userpool/*"
		}
	]
}
```

**Local Development:**

For local development, you can still use IAM user credentials by setting the appropriate
environment variables, but this is not required for production deployments.

### OpenAI API Configuration

#### 1. Obtain API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key

#### 2. Configure Environment

Update `apps/express-api/.env`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Additional Environment Configuration

#### Express API Environment

Complete `apps/express-api/.env` configuration:

```bash
# API Configuration
API_KEY=your-32-character-api-key-here
SERVER_PORT=3040

# Cookie Configuration
COOKIE_DOMAIN=localhost
COOKIE_ENCRYPTION_KEY=your-32-character-encryption-key-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=3600000
AUTH_RATE_LIMIT_MAX_REQUESTS=10
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX_REQUESTS=60

# Redis (optional - for rate limiting)
REDIS_URL=redis://localhost:6379
```

#### Client UI Environment

Complete `apps/client-ui/.env` configuration:

```bash
# API Configuration
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=your-32-character-api-key-here
```

#### Generate Secure Keys

```bash
# Generate API key (32 characters minimum)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate cookie encryption key (32 characters minimum)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔧 IDE Setup and Recommendations

### Visual Studio Code (Recommended)

#### Required Extensions

```json
{
	"recommendations": [
		"ms-vscode.vscode-typescript-next",
		"esbenp.prettier-vscode",
		"dbaeumer.vscode-eslint",
		"bradlc.vscode-tailwindcss",
		"ms-vscode.vscode-json",
		"vitest.explorer"
	]
}
```

#### VS Code Settings

Create `.vscode/settings.json`:

```json
{
	"typescript.preferences.importModuleSpecifier": "relative",
	"editor.formatOnSave": true,
	"editor.defaultFormatter": "esbenp.prettier-vscode",
	"editor.codeActionsOnSave": {
		"source.fixAll.eslint": "explicit"
	},
	"files.associations": {
		"*.css": "tailwindcss"
	},
	"tailwindCSS.experimental.classRegex": [
		["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
		["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
	]
}
```

#### Workspace Configuration

Create `.vscode/launch.json` for debugging:

```json
{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Debug Express API",
			"type": "node",
			"request": "launch",
			"program": "${workspaceFolder}/apps/express-api/src/index.ts",
			"outFiles": ["${workspaceFolder}/apps/express-api/dist/**/*.js"],
			"runtimeArgs": ["--loader", "tsx/esm"],
			"env": {
				"NODE_ENV": "development"
			},
			"console": "integratedTerminal",
			"internalConsoleOptions": "neverOpen"
		}
	]
}
```

### Alternative IDEs

#### WebStorm

- Install Node.js plugin
- Configure TypeScript service
- Set up ESLint and Prettier integration
- Configure run configurations for development servers

#### Vim/Neovim

- Install TypeScript language server (tsserver)
- Configure ESLint and Prettier plugins
- Set up file navigation for monorepo structure

## 🚀 Development Workflow

### Available Scripts

#### Root Level Scripts

```bash
# Development
pnpm dev                    # Start all development servers
pnpm build                  # Build all applications
pnpm lint                   # Lint all code
pnpm lint:md               # Lint markdown files
pnpm test                  # Run all tests

# Database operations
pnpm db:generate:express-api  # Generate database migrations
pnpm db:push:express-api     # Apply database changes

# API client generation
pnpm generate:types         # Generate API client types
pnpm build:types           # Build API client package
```

#### Application-Specific Scripts

**Express API** (`apps/express-api`):

```bash
pnpm dev                   # Start development server
pnpm build                 # Build for production
pnpm start                 # Start production server
pnpm test                  # Run tests
pnpm test:coverage         # Run tests with coverage
pnpm generate-swagger      # Generate OpenAPI specification
```

**Client UI** (`apps/client-ui`):

```bash
pnpm dev                   # Start development server
pnpm build                 # Build for production
pnpm preview               # Preview production build
pnpm test                  # Run tests
pnpm lint                  # Lint code
```

### Development Server Startup

```bash
# Start all services (recommended)
pnpm dev

# Or start services individually
pnpm --filter @repo/express-api dev    # Backend only
pnpm --filter @repo/client-ui dev       # Frontend only
```

### Verification Steps

#### 1. Backend Verification

```bash
# Check API health
curl http://localhost:3040/api/health

# Check Swagger documentation
open http://localhost:3040/api-docs
```

#### 2. Frontend Verification

```bash
# Check frontend
open http://localhost:3000

# Verify API connection in browser console
# Should see successful API calls in Network tab
```

#### 3. Database Verification

```bash
# Connect to database
psql -U postgres -d macro_ai_dev

# Check tables exist
\dt

# Verify pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## 🐳 Docker Setup (Optional)

### Docker Compose for Development

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: macro_ai_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

volumes:
  postgres_data:
```

### Start Docker Services

```bash
# Start database services
docker-compose -f docker-compose.dev.yml up -d

# Stop services
docker-compose -f docker-compose.dev.yml down
```

## 🔍 Troubleshooting

### Common Issues

#### Node.js Version Issues

```bash
# Check Node.js version
node --version

# If wrong version, use nvm
nvm use 20
```

#### pnpm Installation Issues

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Test connection
psql -U postgres -d macro_ai_dev -c "SELECT version();"
```

#### Port Conflicts

```bash
# Check what's using port 3000/3040
lsof -i :3000
lsof -i :3040

# Kill processes if needed
kill -9 <PID>
```

### Getting Help

- **Documentation**: Check [Troubleshooting Guide](./troubleshooting.md)
- **Issues**: Create GitHub issue with setup details
- **Community**: Join project discussions

## 📚 Next Steps

After completing the development setup:

1. **[Environment Configuration](./environment-configuration.md)** - Detailed environment variable setup
2. **[Development Guidelines](../development/README.md)** - Coding standards and best practices
3. **[Testing Strategy](../development/testing-strategy.md)** - Running and writing tests
4. **[API Documentation](../features/api-client/README.md)** - Understanding the API structure

## 🔗 Related Documentation

- **[Environment Configuration](./environment-configuration.md)** - Comprehensive environment setup
- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and solutions
- **[Database Design](../architecture/database-design.md)** - Database schema and operations
- **[Authentication System](../features/authentication/README.md)** - AWS Cognito integration details

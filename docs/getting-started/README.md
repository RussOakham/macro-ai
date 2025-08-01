# Getting Started with Macro AI

Welcome to **Macro AI** - a modern, full-stack AI-powered chat application! This comprehensive guide will get you
up and running with the complete development environment in under 30 minutes.

## 🎯 What You'll Build

By following this guide, you'll have a fully functional local development environment with:

- **🤖 AI-Powered Chat**: Real-time streaming conversations with OpenAI integration
- **🔐 Secure Authentication**: AWS Cognito with JWT tokens and session management
- **🎨 Modern UI**: React frontend with Tailwind CSS and shadcn/ui components
- **🚀 Type-Safe API**: Auto-generated TypeScript client with runtime validation
- **🔍 Semantic Search**: Vector embeddings with PostgreSQL + pgvector
- **📊 Full Observability**: Comprehensive logging, monitoring, and error handling

## ⚡ 5-Minute Quick Start

**For experienced developers who want to get running immediately:**

```bash
# 1. Clone and install
git clone https://github.com/RussOakham/macro-ai.git && cd macro-ai && pnpm install

# 2. Set up environment files
cp apps/express-api/.env.example apps/express-api/.env
cp apps/client-ui/.env.example apps/client-ui/.env

# 3. Configure your .env files (see Environment Configuration guide)
# 4. Set up PostgreSQL with pgvector (see Database Setup section)
# 5. Configure AWS Cognito (see AWS Setup section)

# 6. Start development
pnpm dev
```

**🌐 Access Points:**

- Frontend: `http://localhost:3000`
- API: `http://localhost:3040/api`
- API Docs: `http://localhost:3040/api-docs`

## 📋 Prerequisites

### Required Software

- **Node.js 20+**: [Download from nodejs.org](https://nodejs.org/)
- **pnpm**: Install with `npm install -g pnpm`
- **PostgreSQL 15+**: [Download from postgresql.org](https://www.postgresql.org/download/)
- **Git**: For version control

### Required Services

- **AWS Account**: For Cognito authentication ([AWS Free Tier](https://aws.amazon.com/free/))
- **OpenAI API Key**: For AI functionality ([OpenAI Platform](https://platform.openai.com/))

### Optional Tools

- **Docker**: For containerized database setup
- **VS Code**: Recommended IDE with extensions
- **Postman**: For API testing

## 🚀 Step-by-Step Setup

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/RussOakham/macro-ai.git
cd macro-ai

# Install all dependencies
pnpm install
```

### Step 2: Database Setup

**Option A: Local PostgreSQL**

```bash
# Install PostgreSQL and pgvector extension
# See detailed instructions in Development Setup guide

# Create database
createdb macro_ai_dev

# Enable pgvector extension
psql -d macro_ai_dev -c "CREATE EXTENSION vector;"
```

**Option B: Docker PostgreSQL**

```bash
# Run PostgreSQL with pgvector in Docker
docker run -d \
  --name macro-ai-postgres \
  -e POSTGRES_DB=macro_ai_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  pgvector/pgvector:pg15
```

### Step 3: Environment Configuration

```bash
# Copy environment templates
cp apps/express-api/.env.example apps/express-api/.env
cp apps/client-ui/.env.example apps/client-ui/.env
```

**Configure Express API (.env):**

```bash
# API Configuration
API_KEY=your-32-character-api-key-here  # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SERVER_PORT=3040

# Database
RELATIONAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/macro_ai_dev

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# AWS Cognito (configure in Step 4)
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=your-pool-id
AWS_COGNITO_USER_POOL_CLIENT_ID=your-client-id
# ... (see Environment Configuration guide for complete list)
```

**Configure Client UI (.env):**

```bash
# API Configuration
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=your-32-character-api-key-here  # Same as Express API
```

### Step 4: AWS Cognito Setup

1. **Create User Pool** in AWS Cognito Console
2. **Configure App Client** with appropriate settings
3. **Update environment variables** with pool details

**📖 Detailed Instructions**: [Environment Configuration Guide](./environment-configuration.md)

### Step 5: Start Development Servers

```bash
# Start all development servers
pnpm dev

# Or start individually
pnpm --filter @repo/express-api dev    # Backend API
pnpm --filter @repo/client-ui dev      # Frontend UI
```

### Step 6: Verify Setup

1. **Frontend**: Visit `http://localhost:3000` - should show login page
2. **API Health**: Visit `http://localhost:3040/api/health` - should return `{"status": "healthy"}`
3. **API Docs**: Visit `http://localhost:3040/api-docs` - should show Swagger UI
4. **Database**: Check connection in API logs

## 📚 Essential Documentation

### Detailed Setup Guides

- **[Development Setup](./development-setup.md)** - Complete development environment setup

  - Node.js and pnpm installation
  - Database setup (PostgreSQL + pgvector)
  - AWS Cognito configuration
  - IDE setup and recommended extensions
  - Docker setup (optional)

- **[Environment Configuration](./environment-configuration.md)** - Environment variables and configuration

  - Required environment variables
  - Configuration validation with Zod
  - Development vs production settings
  - Secrets management

- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
  - Installation problems
  - Database connection issues
  - Authentication setup problems
  - Build and development server issues

## 🛠️ Development Commands

```bash
# Development
pnpm dev              # Start all development servers
pnpm build            # Build all packages and applications
pnpm test             # Run all tests
pnpm lint             # Run ESLint across the codebase
pnpm format           # Check code formatting
pnpm format:fix       # Fix formatting issues

# Database
pnpm db:generate:express-api    # Generate database migrations
pnpm db:push:express-api        # Apply migrations to database

# API Client
pnpm --filter @repo/macro-ai-api-client generate    # Regenerate API client

# Commits
pnpm commit           # Use commitizen for standardized commits
```

## 🏗️ Project Architecture

```mermaid
graph TB
    subgraph "Frontend (Port 3000)"
        UI[React + Vite + TanStack Router]
        CLIENT[Auto-Generated API Client]
    end

    subgraph "Backend (Port 3040)"
        API[Express.js + TypeScript]
        AUTH[AWS Cognito Integration]
        AI[OpenAI Integration]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL + pgvector)]
        REDIS[(Redis Cache)]
    end

    UI --> CLIENT
    CLIENT --> API
    API --> AUTH
    API --> AI
    API --> PG
    API --> REDIS
```

### Repository Structure

```bash
macro-ai/
├── apps/
│   ├── client-ui/              # React frontend with Vite and TanStack Router
│   └── express-api/            # Express.js API with OpenAPI and Zod validation
├── packages/
│   ├── ui-library/             # Shared UI components and design system
│   ├── macro-ai-api-client/    # Auto-generated TypeScript API client
│   ├── config-typescript/      # Shared TypeScript configurations
│   └── config-eslint/          # Shared ESLint configurations
└── docs/                       # Comprehensive documentation
```

## 🎯 Next Steps

### Immediate Next Steps

1. **[Complete Development Setup](./development-setup.md)** - Detailed environment configuration
2. **[Configure Environment Variables](./environment-configuration.md)** - Set up all required services
3. **[Explore the Architecture](../architecture/system-architecture.md)** - Understand the system design

### Learning Path

1. **Architecture Understanding**

   - [System Architecture](../architecture/system-architecture.md) - High-level system design
   - [Data Flow](../architecture/data-flow.md) - Request/response cycles
   - [Technology Stack](../architecture/technology-stack.md) - Technology choices

2. **Development Workflow**

   - [Development Guidelines](../development/README.md) - Development best practices
   - [API Development](../development/api-development.md) - API development patterns
   - [Testing Strategy](../development/testing-strategy.md) - Testing approaches

3. **Feature Deep Dives**
   - [Authentication System](../features/authentication/README.md) - AWS Cognito integration
   - [Chat System](../features/chat-system/README.md) - AI-powered conversations
   - [API Client](../features/api-client/README.md) - Auto-generated TypeScript client

## 🆘 Getting Help

### Common Issues

- **Setup Problems**: [Troubleshooting Guide](./troubleshooting.md)
- **Environment Issues**: [Environment Configuration](./environment-configuration.md)
- **Database Problems**: [Database Operations](../operations/database-operations.md)
- **Authentication Issues**: [Authentication Troubleshooting](../features/authentication/README.md#troubleshooting)

### Documentation Resources

- **[Complete Documentation Index](../README.md)** - All documentation sections
- **[API Reference](../reference/api-reference.md)** - Complete API documentation
- **[Configuration Reference](../reference/configuration-reference.md)** - All configuration options
- **[Glossary](../reference/glossary.md)** - Terms and definitions

### Support Channels

- **GitHub Issues**: [Create an issue](https://github.com/RussOakham/macro-ai/issues)
- **Architecture Questions**: Review [ADRs](../adr/README.md)
- **Development Questions**: Check [Development Guidelines](../development/README.md)

---

**🚀 Ready to start?** → [Development Setup Guide](./development-setup.md)

**⚡ Quick reference?** → [Environment Configuration](./environment-configuration.md)

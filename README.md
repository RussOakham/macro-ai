# Macro AI

[![Build Status](https://github.com/RussOakham/macro-ai/workflows/Hygiene%20Checks/badge.svg)](https://github.com/RussOakham/macro-ai/actions/workflows/hygiene-checks.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/RussOakham/COVERAGE_GIST_ID/raw/macro-ai-coverage.json)](https://github.com/RussOakham/macro-ai/actions/workflows/hygiene-checks.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8+-orange.svg)](https://pnpm.io/)

**Macro AI** is a modern, full-stack AI-powered chat application built with enterprise-grade architecture and
best practices. This monorepo contains a complete ecosystem including a React frontend, Express.js API,
auto-generated TypeScript clients, and comprehensive documentation.

Despite this being a personal project, the application has been developed, tested, secured, deployed and documented
with the same attention to detail and quality as any enterprise application.

## 🚀 Quick Start

Get up and running in minutes:

```bash
# Clone and install
git clone https://github.com/RussOakham/macro-ai.git
cd macro-ai
pnpm install

# Set up environment
cp apps/express-api/.env.example apps/express-api/.env
cp apps/client-ui/.env.example apps/client-ui/.env
# Edit .env files with your configuration

# Start development servers
pnpm dev
```

**📚 [Complete Setup Guide →](./docs/getting-started/development-setup.md)**

## ✨ Features

- **🤖 AI-Powered Chat**: Real-time streaming conversations with OpenAI integration
- **🔐 Secure Authentication**: AWS Cognito with JWT tokens and refresh rotation
- **🎯 Type-Safe API**: Auto-generated TypeScript clients with runtime validation
- **🔍 Semantic Search**: Vector embeddings with PostgreSQL + pgvector
- **📱 Modern UI**: React with Tailwind CSS and shadcn/ui components
- **🚀 Production Ready**: Comprehensive monitoring, logging, and error handling
- **📚 Full Documentation**: Complete guides, API references, and architectural decisions

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Frontend"
        UI[React Client UI]
        CLIENT[Auto-Generated API Client]
    end

    subgraph "Backend"
        API[Express.js API]
        AUTH[AWS Cognito]
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

**📖 [Detailed Architecture →](./docs/architecture/system-architecture.md)**

## 🗄️ Database Branching (Hybrid Approach)

**Macro AI** features a sophisticated hybrid database branching strategy that combines manual control with GitHub Actions
automation:

### Branching Strategy

| Environment        | Branch Pattern                | Management | Cost         |
| ------------------ | ----------------------------- | ---------- | ------------ |
| **Production**     | `main-production-branch`      | Manual     | £10-15/month |
| **Staging**        | `auto-branch-from-production` | Hybrid     | £8-12/month  |
| **PR Preview**     | `preview/pr-{number}`         | Automated  | Free         |
| **Feature Branch** | `feature/{name}`              | Automated  | Free         |

### GitHub Integration

**🎯 Automated Database Environments**

- **PR Opened**: Automatically creates `preview/pr-{number}` database branch
- **PR Updated**: Validates schema and runs migrations
- **PR Merged**: Automatically cleans up database branch
- **Cost Optimized**: Free tier with automatic cleanup prevents cost accumulation

**🔧 Manual Control**

- Production deployments require explicit confirmation
- Staging supports both manual and automated deployments
- Full cost control and security for critical environments

### Quick Setup

```bash
# 1. Configure GitHub Secrets
# Repository Settings → Secrets and variables → Actions
NEON_API_KEY=<your-api-key>
NEON_PROJECT_ID=<your-project-id>

# 2. Install Neon GitHub App
# Neon Console → Integrations → GitHub → Connect repository

# 3. Create PR to trigger automated branching
git checkout -b feature/my-feature
git commit -m "feat: add my feature"
git push origin feature/my-feature
# Create PR → GitHub Actions automatically creates database environment
```

**📖 [Complete Branching Setup →](./docs/neon-branching-setup.md)**

## 📁 Repository Structure

### Applications

- **`apps/client-ui/`** - React frontend with Vite, TypeScript, and Tailwind CSS
- **`apps/express-api/`** - Express.js API with OpenAPI specification and Zod validation

### Packages

- **`packages/ui-library/`** - Shared UI components and design system
- **`packages/macro-ai-api-client/`** - Auto-generated TypeScript API client
- **`packages/config-typescript/`** - Shared TypeScript configurations
- **`packages/config-eslint/`** - Shared ESLint configurations

### Documentation

- **`docs/`** - Comprehensive documentation including guides, references, and ADRs

## 📖 Documentation

Our comprehensive documentation covers everything from getting started to advanced deployment strategies:

### 🚀 Getting Started

- **[Development Setup](./docs/getting-started/development-setup.md)** - Complete environment setup guide
- **[Environment Configuration](./docs/getting-started/environment-configuration.md)** - Configuration management
- **[Troubleshooting](./docs/getting-started/troubleshooting.md)** - Common issues and solutions

### 🏗️ Architecture & Design

- **[System Architecture](./docs/architecture/system-architecture.md)** - High-level system design
- **[Data Flow](./docs/architecture/data-flow.md)** - Request/response cycles and streaming
- **[Database Design](./docs/architecture/database-design.md)** - PostgreSQL schema and pgvector integration
- **[Security Architecture](./docs/architecture/security-architecture.md)** - Security patterns and best practices
- **[Technology Stack](./docs/architecture/technology-stack.md)** - Technology choices and rationale

### 💻 Development

- **[API Development](./docs/development/api-development.md)** - OpenAPI and Zod integration
- **[Error Handling](./docs/development/error-handling.md)** - Go-style error handling patterns
- **[Testing Strategy](./docs/development/testing-strategy.md)** - Unit testing with Vitest
- **[Coding Standards](./docs/development/coding-standards.md)** - Code style and best practices
- **[Monorepo Management](./docs/development/monorepo-management.md)** - Workspace organization

### 🚀 Deployment & Operations

- **[AWS Deployment](./docs/deployment/aws-deployment.md)** - Infrastructure as Code with CDK
- **[CI/CD Pipeline](./docs/deployment/ci-cd-pipeline.md)** - GitHub Actions automation
- **[Neon Database Branching](./docs/neon-branching-setup.md)** - Hybrid branching strategy
- **[Environment Setup](./docs/deployment/environment-setup.md)** - Production configuration
- **[Monitoring & Logging](./docs/deployment/monitoring-logging.md)** - Observability strategies

### 🔧 Operations

- **[Release Process](./docs/operations/release-process.md)** - Semantic versioning and releases
- **[Database Operations](./docs/operations/database-operations.md)** - Schema management and maintenance
- **[Incident Response](./docs/operations/incident-response.md)** - Troubleshooting and emergency procedures
- **[Merge Strategy](./docs/operations/merge-strategy.md)** - Git flow-based development workflow

### 🎯 Features

- **[Authentication System](./docs/features/authentication/README.md)** - AWS Cognito integration
- **[Chat System](./docs/features/chat-system/README.md)** - AI-powered conversations with streaming
- **[API Client](./docs/features/api-client/README.md)** - Auto-generated TypeScript clients
- **[User Management](./docs/features/user-management/README.md)** - Profile and data management

### 📚 Reference

- **[API Reference](./docs/reference/api-reference.md)** - Complete API documentation
- **[Configuration Reference](./docs/reference/configuration-reference.md)** - Environment variables and settings
- **[Database Schema](./docs/reference/database-schema.md)** - Complete schema documentation
- **[Glossary](./docs/reference/glossary.md)** - Terms and definitions

### 🏛️ Architecture Decision Records (ADRs)

- **[ADR-001: Error Handling Strategy](./docs/adr/001-error-handling-strategy.md)** - Go-style error handling
- **[ADR-002: Authentication Approach](./docs/adr/002-authentication-approach.md)** - AWS Cognito selection
- **[ADR-003: Database Technology](./docs/adr/003-database-technology.md)** - PostgreSQL + pgvector
- **[ADR-004: API Client Generation](./docs/adr/004-api-client-generation.md)** - Automated client generation

## 🛠️ Development Commands

The monorepo includes several scripts for efficient development:

```bash
# Development
pnpm dev              # Start all development servers
pnpm build            # Build all packages and applications
pnpm test             # Run all tests
pnpm lint             # Run ESLint across the codebase
pnpm format           # Check code formatting
pnpm format:fix       # Fix formatting issues

# Commits
pnpm commit           # Use commitizen for standardized commits

# Package-specific development servers
pnpm ui               # Start React frontend development server
pnpm api              # Start Express API development server
```

## 🔧 Troubleshooting

### Database Connection Issues

```bash
# Check environment variables
echo "APP_ENV: $APP_ENV"
echo "GITHUB_ACTIONS: $GITHUB_ACTIONS"
echo "DATABASE_URL: $DATABASE_URL"

# Test Neon branching utility
cd apps/express-api
npm run ts-node -e "
import { getEnvironmentType, getNeonBranchConfig } from './src/utils/neon-branching.ts';
console.log('Environment:', getEnvironmentType());
console.log('Branch:', getNeonBranchConfig());
"

# Verify database connection
psql "$DATABASE_URL" -c "SELECT version();"
```

### GitHub Actions Branching Issues

```bash
# Check GitHub secrets are configured
# Repository Settings → Secrets and variables → Actions
NEON_API_KEY=<your-api-key>
NEON_PROJECT_ID=<your-project-id>

# Verify Neon GitHub App is connected
# Neon Console → Integrations → GitHub → Check repository

# Check workflow permissions
# Repository Settings → Actions → General → Workflow permissions
```

### Common Issues

- **Branch creation fails**: Check Neon API key permissions
- **Database connection fails**: Verify branch exists in Neon console
- **Environment detection issues**: Check `APP_ENV` and `GITHUB_ACTIONS` variables
- **Cost accumulation**: Monitor Neon console for unused branches

**📖 [Complete Troubleshooting Guide →](./docs/neon-branching-setup.md#troubleshooting)**

## 🤝 Contributing

We welcome contributions! Please read our contributing guidelines:

1. **[Development Setup](./docs/getting-started/development-setup.md)** - Set up your development environment
2. **[Coding Standards](./docs/development/coding-standards.md)** - Follow our code style guidelines
3. **[Testing Strategy](./docs/development/testing-strategy.md)** - Write comprehensive tests
4. **[Merge Strategy](./docs/operations/merge-strategy.md)** - Follow our Git Flow workflow

### Code Quality Standards

- ✅ TypeScript with strict mode enabled
- ✅ ESLint and Prettier for code formatting
- ✅ Comprehensive unit tests with Vitest
- ✅ Go-style error handling patterns
- ✅ Semantic commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **[Documentation](./docs/README.md)** - Complete documentation index
- **[API Documentation](http://localhost:3040/api-docs)** - Interactive Swagger UI (when running locally)
- **[GitHub Actions](https://github.com/RussOakham/macro-ai/actions)** - CI/CD pipeline status
- **[Issues](https://github.com/RussOakham/macro-ai/issues)** - Bug reports and feature requests

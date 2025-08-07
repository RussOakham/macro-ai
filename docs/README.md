# Macro AI Documentation

Welcome to the comprehensive documentation for the Macro AI monorepo. This documentation provides everything you need to
understand, develop, deploy, and maintain the Macro AI application, including our strategic evolution toward multi-model
AI capabilities and research-grade source attribution.

## 🎯 Strategic Overview

Macro AI is evolving from a ChatGPT-style interface to a comprehensive multi-model AI platform with research-grade
source attribution capabilities. Our strategic initiatives establish competitive differentiation in the AI assistance
market:

### Current Strategic Initiatives

- **[Multi-Model Chat Platform](./product/requirements/prds/multi-model-chat.md)** (Q2 2025) - Seamless integration of
  multiple AI models with intelligent routing and cost optimization
- **[Response Sources Sidebar](./product/requirements/prds/response-sources-sidebar.md)** (Q3 2025) - Research-grade
  source attribution and verification capabilities
- **[Product Roadmap](./product/strategy/product-roadmap.md)** - Complete strategic timeline and feature prioritization

### Key Success Metrics

- **40% Multi-Model Adoption** by Q2 2025
- **80% Source Attribution Coverage** by Q3 2025
- **8.5/10 User Satisfaction** across all strategic features

## 🚀 Quick Start

New to Macro AI? Start here:

- **[Getting Started Guide](./getting-started/README.md)** - Set up your development environment
- **[Development Setup](./getting-started/development-setup.md)** - Detailed environment configuration
- **[System Architecture](./architecture/system-architecture.md)** - Understand the overall system design
- **[Product Strategy](./product/strategy/README.md)** - Understand our strategic direction and competitive positioning

## 📚 Documentation Structure

### 🏁 Getting Started

**[`./getting-started/`](./getting-started/README.md)**

- [Development Setup](./getting-started/development-setup.md) - Environment setup and prerequisites
- [Environment Configuration](./getting-started/environment-configuration.md) - Configuration variables and validation
- [Troubleshooting](./getting-started/troubleshooting.md) - Common issues and solutions

### 🏗️ Architecture

**[`./architecture/`](./architecture/README.md)**

- [System Architecture](./architecture/system-architecture.md) - High-level system overview and diagrams
- [Data Flow](./architecture/data-flow.md) - Request/response flows and system interactions
- [Database Design](./architecture/database-design.md) - Database schema and relationships
- [Security Architecture](./architecture/security-architecture.md) - Security model and integrations
- [Technology Stack](./architecture/technology-stack.md) - Technology decisions and rationale

### 💻 Development

**[`./development/`](./development/README.md)**

- [Coding Standards](./development/coding-standards.md) - Code style and conventions
- [Testing Strategy](./development/testing-strategy.md) - Testing approach and patterns
- [Error Handling](./development/error-handling.md) - Go-style error handling patterns
- [API Development](./development/api-development.md) - API development guidelines
- [Monorepo Management](./development/monorepo-management.md) - Workspace and dependency management

### 🚀 Deployment

**[`./deployment/`](./deployment/README.md)**

- [AWS Deployment](./deployment/aws-deployment.md) - AWS infrastructure and deployment strategies
- [Environment Setup](./deployment/environment-setup.md) - Production environment configuration
- [CI/CD Pipeline](./deployment/ci-cd-pipeline.md) - GitHub Actions and automation
- [Monitoring & Logging](./deployment/monitoring-logging.md) - Observability and maintenance

### ⚙️ Features

**[`./features/`](./features/README.md)**

- [Authentication](./features/authentication/README.md) - AWS Cognito integration and auth flows
- [Chat System](./features/chat-system/README.md) - AI-powered chat with streaming responses
- [User Management](./features/user-management/README.md) - User profiles and data access patterns
- [API Client](./features/api-client/README.md) - Auto-generated TypeScript client

### 🔧 Operations

**[`./operations/`](./operations/README.md)**

- [Merge Strategy](./operations/merge-strategy.md) - Git flow-based development workflow
- [Release Process](./operations/release-process.md) - Versioning and release procedures
- [Database Operations](./operations/database-operations.md) - Migrations and maintenance
- [Incident Response](./operations/incident-response.md) - Troubleshooting and support

### 🎯 Product Management

**[`./product/`](./product/README.md)** - ✅ **Strategic Framework Complete**

#### Strategic Foundation

- **[Product Roadmap](./product/strategy/product-roadmap.md)** - Q2 2025 multi-model, Q3 2025 response sources milestones
- **[User Personas](./product/strategy/user-personas.md)** - Alex the Optimizer, Dr. Sarah the Verifier, Marcus the Strategist
- **[Success Metrics](./product/strategy/success-metrics.md)** - 40% multi-model adoption, 80% source coverage targets
- **[Competitive Analysis](./product/strategy/competitive-analysis.md)** - Multi-model leadership and research differentiation

#### Strategic Initiatives

- **[Multi-Model Chat PRD](./product/requirements/prds/multi-model-chat.md)** - Comprehensive multi-model platform requirements
- **[Response Sources PRD](./product/requirements/prds/response-sources-sidebar.md)** - Research-grade source
  attribution requirements
- **[Implementation Plans](./product/planning/implementation-plans/README.md)** - Development coordination and resource allocation
- **[Feature Flags Strategy](./product/planning/feature-flags/strategy.md)** - Strategic rollout and risk management

#### Communication & Analysis

- **[Release Notes](./product/communication/release-notes/README.md)** - v1.2.0 Chat V2 and v2.0.0 Multi-model templates
- **[Stakeholder Updates](./product/communication/stakeholder-updates/README.md)** - Executive summaries and monthly reporting
- **[Dashboard Metrics](./product/analysis/metrics/dashboard-metrics.md)** - Real-time KPI tracking and success measurement
- **[User Engagement](./product/analysis/metrics/user-engagement.md)** - Multi-model and response sources engagement tracking

### 📖 Reference

**[`./reference/`](./reference/README.md)**

- [API Reference](./reference/api-reference.md) - Complete API endpoint documentation
- [Configuration Reference](./reference/configuration-reference.md) - All configuration options
- [Database Schema](./reference/database-schema.md) - Complete schema reference
- [Glossary](./reference/glossary.md) - Terms and definitions

### 📋 Architecture Decision Records

**[`./adr/`](./adr/README.md)**

- [001: Error Handling Strategy](./adr/001-error-handling-strategy.md) - Go-style error handling approach
- [002: Authentication Approach](./adr/002-authentication-approach.md) - AWS Cognito integration decision
- [003: Database Technology](./adr/003-database-technology.md) - PostgreSQL and pgvector choice
- [004: API Client Generation](./adr/004-api-client-generation.md) - OpenAPI auto-generation strategy

## 🎯 Key Features

- **🔐 Authentication**: AWS Cognito integration with secure token management
- **💬 AI Chat**: OpenAI integration with streaming responses and persistence
- **📊 Database**: PostgreSQL with pgvector for embeddings and semantic search
- **🔄 Auto-Generated API Client**: Type-safe client with automatic OpenAPI generation
- **🧪 Comprehensive Testing**: Vitest with Go-style error handling patterns
- **🚀 Monorepo Architecture**: pnpm workspaces with TurboRepo for efficient builds

## 🛠️ Technology Stack

- **Frontend**: React + Vite + TanStack Router + Tailwind CSS
- **Backend**: Express.js + TypeScript + Drizzle ORM
- **Database**: PostgreSQL + pgvector
- **Authentication**: AWS Cognito
- **AI Integration**: OpenAI + Vercel AI SDK
- **Testing**: Vitest + Playwright
- **Build System**: TurboRepo + pnpm workspaces
- **Deployment**: AWS (planned)

## 🎯 Strategic Quick Access

For stakeholders and team members looking for specific strategic information:

### Executive Level

- **[Executive Summaries](./product/communication/stakeholder-updates/executive-summaries.md)** - Strategic progress
  and decision support
- **[Product Roadmap](./product/strategy/product-roadmap.md)** - Strategic timeline and competitive positioning
- **[Success Metrics](./product/strategy/success-metrics.md)** - KPIs and strategic measurement framework

### Product Management

- **[Multi-Model Chat PRD](./product/requirements/prds/multi-model-chat.md)** - Core strategic initiative requirements
- **[Response Sources PRD](./product/requirements/prds/response-sources-sidebar.md)** - Research differentiation requirements
- **[Implementation Plans](./product/planning/implementation-plans/README.md)** - Development coordination and timelines

### Development Teams

- **[Multi-Model Architecture](./product/requirements/technical-designs/multi-model-architecture.md)** - Technical
  design for strategic features
- **[Feature Flags Strategy](./product/planning/feature-flags/strategy.md)** - Rollout approach and risk management
- **[Chat System Features](./features/chat-system/README.md)** - Current production infrastructure

## 🤝 Contributing

Before contributing, please read:

- [Development Guidelines](./development/README.md)
- [Coding Standards](./development/coding-standards.md)
- [Testing Strategy](./development/testing-strategy.md)
- [Merge Strategy](./operations/merge-strategy.md)

## 📞 Support

- **Issues**: Create an issue in the GitHub repository
- **Questions**: Check the [Troubleshooting Guide](./getting-started/troubleshooting.md)
- **Architecture Questions**: Review [Architecture Decision Records](./adr/README.md)

---

**Last Updated**: July 2025  
**Documentation Version**: 1.0.0

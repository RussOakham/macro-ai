# Getting Started with Macro AI

Welcome to Macro AI! This guide will help you set up your development environment and get the application running locally.

## 🚀 Quick Start

1. **Prerequisites**: Ensure you have Node.js 20+ and pnpm installed
2. **Clone & Install**: Clone the repository and install dependencies
3. **Environment Setup**: Configure your environment variables
4. **Database Setup**: Set up PostgreSQL with pgvector
5. **AWS Configuration**: Configure AWS Cognito for authentication
6. **Start Development**: Run the development servers

## 📋 Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Package manager (`npm install -g pnpm`)
- **PostgreSQL**: Database with pgvector extension
- **AWS Account**: For Cognito authentication services
- **OpenAI API Key**: For AI chat functionality

## 📚 Documentation

### Essential Setup Guides

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

## ⚡ Quick Setup Commands

```bash
# Clone the repository
git clone https://github.com/RussOakham/macro-ai.git
cd macro-ai

# Install dependencies
pnpm install

# Set up environment files (see Environment Configuration guide)
cp apps/express-api/.env.example apps/express-api/.env
cp apps/client-ui/.env.example apps/client-ui/.env

# Start development servers
pnpm dev
```

## 🏗️ Project Structure

```bash
macro-ai/
├── apps/
│   ├── client-ui/          # React frontend application
│   └── express-api/        # Express.js backend API
├── packages/
│   ├── ui-library/         # Shared UI components
│   ├── config-typescript/  # TypeScript configurations
│   ├── config-eslint/      # ESLint configurations
│   └── macro-ai-api-client/ # Auto-generated API client
└── docs/                   # Documentation (you are here!)
```

## 🔗 Next Steps

After completing the setup:

1. **Explore the Architecture**: Read the [System Architecture](../architecture/system-architecture.md) guide
2. **Understand Development Workflow**: Review [Development Guidelines](../development/README.md)
3. **Learn About Features**: Explore [Features Documentation](../features/README.md)
4. **Set Up Your IDE**: Follow IDE-specific setup in [Development Setup](./development-setup.md)

## 🆘 Need Help?

- **Common Issues**: Check the [Troubleshooting Guide](./troubleshooting.md)
- **Environment Problems**: Review [Environment Configuration](./environment-configuration.md)
- **Architecture Questions**: See [Architecture Documentation](../architecture/README.md)
- **Development Questions**: Check [Development Guidelines](../development/README.md)

---

**Next**: [Development Setup](./development-setup.md) →

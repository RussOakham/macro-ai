# Macro AI Express API

Modern Express.js backend API for the Macro AI platform, built with TypeScript, Zod validation, and OpenAPI specification.

## 🚀 Features

- **Modern Express.js**: TypeScript-first API with comprehensive middleware
- **OpenAPI Integration**: Auto-generated API documentation with Swagger UI
- **Type-Safe Validation**: Zod schemas for request/response validation
- **AWS Cognito Auth**: Secure authentication with JWT tokens
- **AI Integration**: OpenAI GPT integration with streaming responses
- **Database Integration**: PostgreSQL with Drizzle ORM and pgvector
- **Auto-Generated Clients**: TypeScript clients generated from OpenAPI spec
- **Comprehensive Testing**: Unit tests with Vitest and high coverage

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm package manager
- PostgreSQL 15+ with pgvector extension
- AWS Cognito User Pool
- OpenAI API key

### Getting Started

```bash
# Install dependencies (from monorepo root)
pnpm install

# Set up environment variables
cp env.local.example .env.local
# Edit .env.local with your configuration
# See ENVIRONMENT_TEMPLATE.md for comprehensive configuration options

# Generate database migrations
pnpm db:generate

# Apply migrations to database
pnpm db:push

# Start development server
pnpm --filter @repo/express-api dev

# Or from this directory
pnpm dev
```

### Available Scripts

```bash
pnpm dev                 # Start development server with hot reload
pnpm build               # Build for production
pnpm start               # Start production server
pnpm test                # Run tests
pnpm test:ui             # Run tests with UI
pnpm test:coverage       # Run tests with coverage
pnpm lint                # Lint code
pnpm type-check          # TypeScript type checking
pnpm db:generate         # Generate database migrations
pnpm db:push             # Apply migrations to database
pnpm generate-swagger    # Generate OpenAPI specification
```

## 🏗️ Architecture

### Technology Stack

- **Express.js**: Web framework with TypeScript
- **Zod**: Schema validation and type inference
- **Drizzle ORM**: Type-safe database operations
- **PostgreSQL**: Primary database with pgvector extension
- **Redis**: Caching and session storage
- **AWS Cognito**: User authentication and management
- **OpenAI**: AI chat functionality
- **Swagger/OpenAPI**: API documentation and client generation

### Project Structure

```text
src/
├── controllers/         # Request handlers and business logic
├── middleware/          # Express middleware functions
├── routes/              # API route definitions
├── services/            # Business logic and external integrations
├── utils/               # Utility functions and helpers
├── types/               # TypeScript type definitions
├── db/                  # Database schema and migrations
└── index.ts             # Application entry point
```

### API Endpoints

- **Authentication**: `/auth/*` - User registration, login, password reset
- **Chat System**: `/chats/*` - Chat CRUD operations and streaming
- **User Management**: `/users/*` - User profile operations
- **System**: `/health`, `/system-info` - Health checks and system status

## 🔧 Configuration

### Environment Variables

For comprehensive environment configuration, see [ENVIRONMENT_TEMPLATE.md](./ENVIRONMENT_TEMPLATE.md).

**Quick Setup:**
```bash
# Copy the local development template
cp env.local.example .env.local

# Edit with your configuration values
nano .env.local
```

**Key Variables:**
- `API_KEY`: 32-character API key for authentication
- `SERVER_PORT`: Express server port (default: 3040)
- `RELATIONAL_DATABASE_URL`: PostgreSQL connection string
- `AWS_COGNITO_*`: AWS Cognito authentication configuration
- `OPENAI_API_KEY`: OpenAI API key for AI chat functionality

### Database Schema

The API uses PostgreSQL with the following main tables:

- `users` - User account information
- `chats` - Chat conversation metadata
- `chat_messages` - Individual chat messages
- `chat_vectors` - Vector embeddings for semantic search
- `user_sessions` - Active user sessions

## 📚 API Documentation

### Interactive Documentation

When running locally, access the interactive API documentation:

- **Swagger UI**: `http://localhost:3040/api-docs`
- **OpenAPI Spec**: `http://localhost:3040/swagger.json`

### Authentication

The API supports two authentication methods:

1. **Cookie Authentication** (Primary): HttpOnly cookies with JWT tokens
2. **API Key Authentication**: X-API-KEY header for programmatic access

### Rate Limiting

- **Global**: 100 requests per 15 minutes
- **Authentication**: 10 requests per hour
- **API Key**: 60 requests per minute

## 🧪 Testing

The API includes comprehensive test coverage with Vitest:

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage

# Run specific test file
pnpm test auth.controller.test.ts
```

### Test Coverage

Current test coverage: **92.34%** with 997 passing tests covering:

- Controllers and route handlers
- Service layer business logic
- Middleware functions
- Database operations
- Authentication flows
- Error handling

## 📚 Documentation

For comprehensive documentation and development guides:

- **[API Reference](../../docs/reference/api-reference.md)** - Complete API endpoint documentation
- **[API Development](../../docs/development/api-development.md)** - API development patterns and guidelines
- **[Database Design](../../docs/architecture/database-design.md)** - Database schema and relationships
- **[Authentication System](../../docs/features/authentication/README.md)** - Auth implementation details
- **[Chat System](../../docs/features/chat-system/README.md)** - AI chat functionality
- **[Error Handling](../../docs/development/error-handling.md)** - Error handling patterns
- **[Testing Strategy](../../docs/development/testing-strategy.md)** - Testing approaches and patterns

## 🔄 Database Operations

### Migrations

```bash
# Generate new migration
pnpm db:generate

# Apply migrations
pnpm db:push

# Reset database (development only)
pnpm db:reset
```

### Schema Changes

1. Modify schema in `src/db/schema.ts`
2. Generate migration: `pnpm db:generate`
3. Review generated migration files
4. Apply migration: `pnpm db:push`

## 📦 Related Packages

- `@repo/macro-ai-api-client` - Auto-generated TypeScript client
- `@repo/config-typescript` - Shared TypeScript configurations
- `@repo/config-eslint` - Shared ESLint configurations

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/RussOakham/macro-ai/issues)
- **Documentation**: [Complete Documentation](../../docs/README.md)
- **Development Guide**: [Getting Started](../../docs/getting-started/README.md)
- **API Reference**: [API Documentation](../../docs/reference/api-reference.md)

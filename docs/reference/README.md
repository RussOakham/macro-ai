# Reference Documentation

This section provides comprehensive reference materials for the Macro AI application, including API
documentation, configuration options, database schemas, and terminology.

## 📚 Reference Materials

### API & Integration Reference

- **[API Reference](./api-reference.md)** - Complete API endpoint documentation
  - Authentication endpoints and flows
  - Chat system API with streaming support
  - User management operations
  - Request/response schemas and examples
  - Error codes and handling
  - Rate limiting and usage guidelines

- **[Configuration Reference](./configuration-reference.md)** - Complete configuration documentation
  - Environment variable reference
  - Application configuration options
  - Database connection settings
  - AWS service configurations
  - Security and authentication settings
  - Development vs production configurations

### Data & Schema Reference

- **[Database Schema](./database-schema.md)** - Complete database schema reference
  - Table definitions and relationships
  - Index strategies and performance considerations
  - pgvector configuration for embeddings
  - Migration history and procedures
  - Data types and constraints
  - Backup and recovery procedures

- **[Glossary](./glossary.md)** - Terms, definitions, and concepts
  - Technical terminology and acronyms
  - Business domain concepts
  - Architecture patterns and principles
  - Development workflow terminology
  - AWS service definitions
  - Third-party integration concepts

## 🔌 API Reference Overview

### Authentication API

```bash
POST /auth/register     - User registration
POST /auth/login        - User authentication
POST /auth/logout       - User logout
POST /auth/refresh      - Token refresh
POST /auth/reset        - Password reset
```

### Chat API

```bash
GET    /chat           - List user chats
POST   /chat           - Create new chat
GET    /chat/:id       - Get chat details
POST   /chat/:id/message - Send message (streaming)
DELETE /chat/:id       - Delete chat
```

### User API

```bash
GET    /user/profile   - Get user profile
PUT    /user/profile   - Update user profile
```

## ⚙️ Configuration Overview

### Required Environment Variables

```bash
# API Configuration
API_KEY=your-api-key
SERVER_PORT=3030

# Database
RELATIONAL_DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# AWS Cognito
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_...
AWS_COGNITO_USER_POOL_CLIENT_ID=...
AWS_COGNITO_USER_POOL_SECRET_KEY=...

# OpenAI
OPENAI_API_KEY=sk-...
```

## 🗄️ Database Schema Overview

### Core Tables

- **users**: User profiles and authentication data
- **chats**: Chat conversations and metadata
- **messages**: Individual chat messages with embeddings
- **user_sessions**: Active user sessions and tokens

### Relationships

```bash
users (1) ←→ (many) chats
chats (1) ←→ (many) messages
users (1) ←→ (many) user_sessions
```

## 📖 Quick Reference

### HTTP Status Codes

- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Error Response Format

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Invalid request data",
		"details": {
			"field": "email",
			"issue": "Invalid email format"
		}
	}
}
```

### Rate Limits

- **Global**: 100 requests per 15 minutes
- **Authentication**: 10 requests per hour
- **API**: 60 requests per minute
- **Chat Streaming**: 10 concurrent streams per user

## 🔗 External References

### Third-Party Documentation

- **[AWS Cognito](https://docs.aws.amazon.com/cognito/)** - Authentication service
- **[OpenAI API](https://platform.openai.com/docs)** - AI integration
- **[PostgreSQL](https://www.postgresql.org/docs/)** - Database system
- **[pgvector](https://github.com/pgvector/pgvector)** - Vector similarity search
- **[Drizzle ORM](https://orm.drizzle.team/)** - Database ORM
- **[Zod](https://zod.dev/)** - Schema validation

### Development Tools

- **[TypeScript](https://www.typescriptlang.org/docs/)** - Type system
- **[Vitest](https://vitest.dev/)** - Testing framework
- **[TurboRepo](https://turbo.build/repo/docs)** - Monorepo build system
- **[pnpm](https://pnpm.io/)** - Package manager

## 🎯 Reference Usage

### For Developers

- **API Integration**: Use API Reference for endpoint details
- **Configuration**: Reference Configuration guide for setup
- **Database Queries**: Check Database Schema for table structures
- **Troubleshooting**: Consult Glossary for terminology clarification

### For Operations

- **Monitoring**: Reference error codes and status meanings
- **Configuration**: Use Configuration Reference for environment setup
- **Database**: Reference schema for backup and maintenance procedures
- **Incident Response**: Use API Reference for debugging API issues

## 🔍 Search & Navigation

### Finding Information

1. **API Details**: Check API Reference for endpoint specifications
2. **Configuration Issues**: Consult Configuration Reference
3. **Database Questions**: Review Database Schema documentation
4. **Term Definitions**: Look up concepts in the Glossary

### Cross-References

- **[Getting Started](../getting-started/README.md)** - Initial setup and configuration
- **[Architecture](../architecture/README.md)** - System design and patterns
- **[Features](../features/README.md)** - Feature-specific implementation details
- **[Development](../development/README.md)** - Development guidelines and standards

---

**Quick Access**: [API Reference](./api-reference.md) | [Configuration](./configuration-reference.md) |
[Database Schema](./database-schema.md) | [Glossary](./glossary.md)

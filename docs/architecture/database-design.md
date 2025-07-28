# Database Design and Architecture

This document provides comprehensive documentation of the database design, schema architecture, and data access patterns for the Macro AI application.

## 🔧 Current Implementation Status: ✅ PRODUCTION-READY

The database system is **fully implemented and production-ready** with Drizzle ORM, PostgreSQL, pgvector support, and comprehensive Go-style error handling throughout the data access layer.

## 🏗️ Database Architecture Overview

### Core Database Features ✅ COMPLETE

- **Drizzle ORM Integration** - Type-safe database operations with PostgreSQL
- **Drizzle-Zod Integration** - Automatic schema validation and type generation
- **pgvector Support** - Vector storage for AI/ML embeddings (1536 dimensions)
- **Go-Style Error Handling** - Consistent `[data, error]` tuple patterns
- **Migration Management** - Automated schema migrations with Drizzle Kit
- **OpenAPI Integration** - Database schemas automatically registered for API documentation

### Technology Stack

- **Database**: PostgreSQL 15+ with pgvector extension
- **ORM**: Drizzle ORM with TypeScript integration
- **Validation**: Zod schemas with Drizzle-Zod integration
- **Connection**: Node.js pg pool with connection management
- **Migrations**: Drizzle Kit for schema versioning

## 📊 Database Schema

### 1. Users Table ✅ COMPLETE

The users table provides comprehensive user profile management:

```sql
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false,
  "first_name" varchar(255),
  "last_name" varchar(255),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "last_login" timestamp
);

-- Indexes for performance
CREATE UNIQUE INDEX "email_idx" ON "users" ("email");
```

**TypeScript Schema Definition:**

```typescript
const usersTable = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false),
		firstName: varchar('first_name', { length: 255 }),
		lastName: varchar('last_name', { length: 255 }),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
		lastLogin: timestamp('last_login'),
	},
	(users) => [uniqueIndex('email_idx').on(users.email)],
)
```

### 2. Chat Vectors Table ✅ IMPLEMENTED

Vector storage table for AI embeddings with pgvector:

```sql
CREATE TABLE "chat_vectors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "vector" vector(1536),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

ALTER TABLE "chat_vectors" ADD CONSTRAINT "chat_vectors_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
```

**TypeScript Schema Definition:**

```typescript
const chatVectorsTable = pgTable('chat_vectors', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => usersTable.id),
	embedding: vector('vector', { dimensions: 1536 }),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
})
```

### 3. Planned Tables 📋 FUTURE

**Chats Table (Planned):**

```sql
CREATE TABLE "chats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" varchar(255),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
```

**Messages Table (Planned):**

```sql
CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chat_id" uuid NOT NULL REFERENCES "chats"("id"),
  "role" varchar(20) NOT NULL, -- 'user' or 'assistant'
  "content" text NOT NULL,
  "embedding" vector(1536),
  "created_at" timestamp DEFAULT now()
);
```

## 🔧 Database Configuration

### Connection Setup ✅ COMPLETE

```typescript
// Database connection with connection pooling
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '../../config/default.ts'

const pool = new Pool({
	connectionString: config.relationalDatabaseUrl,
	max: 20, // Maximum connections
	idleTimeoutMillis: 30000, // Close idle connections after 30s
	connectionTimeoutMillis: 2000, // Connection timeout
})

const db = drizzle({ client: pool })
export { db }
```

### Environment Configuration ✅ COMPLETE

```typescript
// Environment validation with Zod
const envSchema = z.object({
	RELATIONAL_DATABASE_URL: z
		.string()
		.min(1, 'Relational database URL is required'),
	NON_RELATIONAL_DATABASE_URL: z
		.string()
		.min(1, 'Non-relational database URL is required'),
})

// Configuration object
const config = {
	relationalDatabaseUrl: env.RELATIONAL_DATABASE_URL,
	nonRelationalDatabaseUrl: env.NON_RELATIONAL_DATABASE_URL,
}
```

### Drizzle Configuration ✅ COMPLETE

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import { config } from './config/default.ts'

export default defineConfig({
	schema: './src/data-access/schema.ts',
	out: './src/data-access/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: config.relationalDatabaseUrl,
	},
})
```

## 🔄 Migration Management

### Migration Commands ✅ COMPLETE

```bash
# Workspace commands (from root)
pnpm db:generate:express-api    # Generate migrations
pnpm db:push:express-api        # Apply migrations

# Local commands (from apps/express-api)
pnpm db:generate               # Generate migrations
pnpm db:push                   # Apply migrations
```

### Migration History ✅ COMPLETE

- **0000_big_tomas.sql** - Initial schema with users and chat_vectors tables
- **0001_dry_romulus.sql** - Added email_verified column to users table
- **Migration metadata** - Complete tracking in `meta/_journal.json`

### Schema Barrel File ✅ COMPLETE

```typescript
// Centralized schema exports
// apps/express-api/src/data-access/schema.ts
import { usersTable } from '../features/user/user.schemas.ts'
import { chatVectorsTable } from '../features/chat/chat-vectors.schemas.ts'

export { usersTable, chatVectorsTable }
```

## 🎯 Data Access Patterns

### Repository Pattern Implementation ✅ COMPLETE

The database layer uses a clean repository pattern with comprehensive error handling:

```typescript
class UserRepository implements IUserRepository {
	private readonly db: typeof db

	constructor(database: typeof db = db) {
		this.db = database
	}

	public async findUserByEmail({
		email,
	}: {
		email: string
	}): Promise<Result<TUser | undefined>> {
		const [users, error] = await tryCatch(
			this.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.limit(1),
			'userRepository - findUserByEmail',
		)

		if (error) {
			return [null, error]
		}

		if (!users.length) return [undefined, null]

		// Validate with Zod schema
		const [validationResult, validationError] = safeValidateSchema(
			users[0],
			selectUserSchema,
			'userRepository - findUserByEmail',
		)

		if (validationError) {
			return [null, validationError]
		}

		return [validationResult, null]
	}
}
```

### Key Data Access Features

- **Go-Style Error Handling** - All methods return `[data, error]` tuples
- **Comprehensive Validation** - Zod schema validation for all operations
- **Type Safety** - Full TypeScript integration with Drizzle-generated types
- **Repository Pattern** - Clean separation with dependency injection support
- **Automatic Logging** - Context-aware error logging with `tryCatch` utility

## 🔍 Vector Search with pgvector

### pgvector Extension ✅ READY

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector similarity search example
SELECT id, embedding <-> '[0.1,0.2,0.3,...]' AS distance
FROM chat_vectors
ORDER BY embedding <-> '[0.1,0.2,0.3,...]'
LIMIT 5;
```

### Planned Vector Operations 📋 FUTURE

```typescript
// Planned vector repository methods
class ChatVectorRepository {
	public async storeEmbedding({
		userId,
		embedding,
	}: {
		userId: string
		embedding: number[]
	}): Promise<Result<TChatVector>> {
		// Store embedding vector
	}

	public async findSimilarVectors({
		embedding,
		limit = 5,
	}: {
		embedding: number[]
		limit?: number
	}): Promise<Result<TChatVector[]>> {
		// Find similar vectors using cosine distance
		return await tryCatch(
			this.db
				.select()
				.from(chatVectorsTable)
				.orderBy(sql`embedding <-> ${embedding}`)
				.limit(limit),
			'chatVectorRepository - findSimilarVectors',
		)
	}
}
```

## 📈 Performance Considerations

### Database Optimization

- **Connection Pooling** - Configured pg pool with optimal settings
- **Indexes** - Strategic indexes on frequently queried columns
- **Query Optimization** - Efficient Drizzle ORM query patterns
- **Vector Indexes** - pgvector HNSW indexes for similarity search

### Scalability Features

- **Connection Management** - Pool-based connection handling
- **Query Batching** - Efficient bulk operations where applicable
- **Caching Strategy** - Ready for Redis integration
- **Read Replicas** - Architecture supports read replica scaling

## 🔗 Related Documentation

- **[Data Access Patterns](../features/user-management/data-access-patterns.md)** - Repository pattern implementation
- **[System Architecture](./system-architecture.md)** - Overall system design
- **[Security Architecture](./security-architecture.md)** - Database security measures
- **[User Management](../features/user-management/README.md)** - User data management

---

**Implementation Status**: ✅ Complete and Production Ready  
**Last Updated**: July 2025

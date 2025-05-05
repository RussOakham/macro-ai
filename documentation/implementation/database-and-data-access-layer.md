# Database Integration & Data Access Layer Implementation (Neon + Drizzle + pgvector)

## Overview

This document outlines the implementation of our database architecture using Neon-hosted PostgreSQL with Drizzle ORM and pgvector for vector storage. The architecture follows a clean separation of concerns with a dedicated data access layer that abstracts database operations from business logic.

---

## Database Architecture

### Core Components

- **PostgreSQL (Neon)**: Primary relational database for structured data
  - Hosted on Neon for serverless scaling and built-in pgvector support
  - Uses connection pooling for efficient resource management
  
- **Drizzle ORM**: Type-safe database toolkit
  - Provides schema definition, migrations, and query building
  - Integrates with TypeScript for full type safety
  
- **pgvector**: PostgreSQL extension for vector operations
  - Enables efficient storage and similarity search of embeddings
  - Used for semantic search capabilities

### Database Schema

| Table | Purpose | Key Fields | Relationships |
|-------|---------|------------|--------------|
| `users` | User profiles and auth info | `id` (UUID, PK), `email`, `emailVerified` | Referenced by `chat_vectors` |
| `sessions` | User session tracking | `id` (UUID, PK), `userId` (FK), `expiresAt` | References `users` |
| `chats` | Chat metadata | `id` (UUID, PK), `userId` (FK), `title`, `createdAt` | References `users` |
| `chat_vectors` | Message embeddings | `id` (UUID, PK), `userId` (FK), `embedding` (vector) | References `users` |

### Additional Storage Options

- **Redis**: Optional caching layer for sessions and rate limiting
- **DynamoDB**: Optional scalable storage for chat messages

---

## Implementation Details

### 1. Database Connection Setup

The database connection is established using a connection pool for efficient resource management:

```typescript
// apps/express-api/src/data-access/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '../../config/default.ts'

const pool = new Pool({
  connectionString: config.relationalDatabaseUrl,
})

const db = drizzle({ client: pool })

export { db }
```

### 2. Schema Definition

Database tables are defined using Drizzle's schema definition language:

```typescript
// apps/express-api/src/data-access/schema.ts
import {
  boolean,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from 'drizzle-orm/pg-core'

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

const chatVectorsTable = pgTable('chat_vectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => usersTable.id),
  embedding: vector('vector', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export { usersTable, chatVectorsTable }
```

### 3. Data Access Layer Pattern

Each feature has its own data access module that encapsulates database operations:

```typescript
// apps/express-api/src/features/user/user.data-access.ts
import { eq } from 'drizzle-orm'
import { db } from '../../data-access/db.ts'
import { usersTable } from '../../data-access/schema.ts'

const findUserByEmail = async (email: string) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  return user
}

const findUserById = async (id: string) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  return user
}

const createUser = async (
  id: string,
  email: string,
  firstName?: string,
  lastName?: string,
) => {
  return await db
    .insert(usersTable)
    .values({
      id,
      email,
      firstName,
      lastName,
    })
    .returning()
    .then((rows) => rows[0] ?? null)
}

const updateLastLogin = async (email: string) => {
  return db
    .update(usersTable)
    .set({
      lastLogin: new Date(),
    })
    .where(eq(usersTable.email, email))
    .returning()
    .then((rows) => rows[0] ?? null)
}

export { findUserByEmail, findUserById, createUser, updateLastLogin }
```

### 4. Database Migrations

Migrations are managed using Drizzle Kit:

```bash
# Generate migrations based on schema changes
pnpm db:generate

# Apply migrations to the database
pnpm db:push
```

Migration files are stored in `apps/express-api/src/data-access/migrations/` and tracked in version control.

### 5. Integration with Business Logic

The data access layer is consumed by service classes that implement business logic:

```typescript
// apps/express-api/src/features/user/user.services.ts
import { findUserById, createUser, updateLastLogin } from './user.data-access.ts'

class UserService {
  async registerOrLoginUserById(id: string, email: string) {
    let user = await findUserById(id)

    if (!user) {
      user = await createUser(id, email)
    } else {
      user = await updateLastLogin(email)
    }

    return user
  }

  async getUserByAccessToken(accessToken: string) {
    // Get user ID from Cognito using access token
    const cognitoUser = await cognitoService.getCognitoUser(accessToken)
    
    if (!cognitoUser || !cognitoUser.Username) {
      return null
    }
    
    // Use ID to get user from database
    const user = await findUserById(cognitoUser.Username)
    return user
  }
}
```

---

## Vector Storage with pgvector

### 1. Setting Up pgvector

The pgvector extension must be enabled in the PostgreSQL database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Storing Embeddings

Embeddings are stored in the `chat_vectors` table using the vector type:

```typescript
// Example of storing an embedding
const storeEmbedding = async (userId: string, embedding: number[]) => {
  return await db
    .insert(chatVectorsTable)
    .values({
      userId,
      embedding,
    })
    .returning()
    .then((rows) => rows[0] ?? null)
}
```

### 3. Similarity Search

Similarity searches can be performed using pgvector's operators:

```typescript
// Example of similarity search
import { sql } from 'drizzle-orm'

const findSimilarVectors = async (embedding: number[], limit = 5) => {
  return await db
    .select()
    .from(chatVectorsTable)
    .orderBy(sql`embedding <-> ${embedding}`)
    .limit(limit)
}
```

---

## Environment Configuration

Database connection strings and other configuration are stored in environment variables:

```typescript
// apps/express-api/config/default.ts
const config = {
  // ...other config
  relationalDatabaseUrl: env.RELATIONAL_DATABASE_URL,
}
```

Environment variables are validated using Zod:

```typescript
// apps/express-api/src/utils/env.schema.ts
const envSchema = z.object({
  // ...other env vars
  RELATIONAL_DATABASE_URL: z
    .string()
    .min(1, 'Relational database URL is required'),
})
```

---

## Testing Strategy

### 1. Unit Tests

Unit tests for data access functions use a test database or mocks:

```typescript
// Example unit test for findUserById
describe('findUserById', () => {
  it('should return a user when found', async () => {
    // Arrange
    const mockUser = { id: 'test-id', email: 'test@example.com' }
    // Mock db or use test database
    
    // Act
    const result = await findUserById('test-id')
    
    // Assert
    expect(result).toEqual(mockUser)
  })
})
```

### 2. Integration Tests

Integration tests verify the interaction between the data access layer and the database:

```typescript
// Example integration test
describe('User data access integration', () => {
  beforeAll(async () => {
    // Set up test database
  })
  
  afterAll(async () => {
    // Clean up test database
  })
  
  it('should create and retrieve a user', async () => {
    // Create user
    const created = await createUser('test-id', 'test@example.com')
    
    // Retrieve user
    const found = await findUserById('test-id')
    
    // Verify
    expect(found).toEqual(created)
  })
})
```

---

## Future Enhancements

### 1. Additional Tables

- [ ] Implement `chats` table for chat metadata
- [ ] Implement `messages` table for chat messages
- [ ] Implement `sessions` table for user sessions

### 2. Performance Optimizations

- [ ] Add database indexes for common query patterns
- [ ] Implement connection pooling configuration tuning
- [ ] Add caching layer with Redis for frequently accessed data

### 3. Advanced Features

- [ ] Implement row-level security for multi-tenant data isolation
- [ ] Add audit logging for database changes
- [ ] Implement soft delete functionality

---

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Neon PostgreSQL Documentation](https://neon.tech/docs/introduction)
- [Node-Postgres Documentation](https://node-postgres.com/)

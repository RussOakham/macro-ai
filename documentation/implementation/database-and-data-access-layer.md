# Database and Data Access Layer Implementation

## Database Schema Implementation

### 1. Schema Definition with Drizzle ORM

The database schema is defined using Drizzle ORM with PostgreSQL:

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
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

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

// Generate Zod schemas for type validation
const insertUserSchema = createInsertSchema(usersTable)
const selectUserSchema = createSelectSchema(usersTable)

const insertChatVectorSchema = createInsertSchema(chatVectorsTable)
const selectChatVectorSchema = createSelectSchema(chatVectorsTable)

// Define types using Zod schemas
export type InsertUser = z.infer<typeof insertUserSchema>
export type User = z.infer<typeof selectUserSchema>
export type InsertChatVector = z.infer<typeof insertChatVectorSchema>
export type ChatVector = z.infer<typeof selectChatVectorSchema>

export {
 usersTable,
 chatVectorsTable,
 insertUserSchema,
 selectUserSchema,
 insertChatVectorSchema,
 selectChatVectorSchema,
}
```

### 2. Database Connection Setup

The database connection is established using Drizzle with PostgreSQL:

```typescript
// apps/express-api/src/data-access/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../config/env'

const pool = new Pool({
 connectionString: env.DATABASE_URL,
 ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export const db = drizzle(pool)
```

### 3. Data Access Layer with Zod Validation

Each feature has its own data access module that encapsulates database operations with Zod validation:

```typescript
// apps/express-api/src/features/user/user.data-access.ts
import { eq } from 'drizzle-orm'
import { db } from '../../data-access/db.ts'
import {
 usersTable,
 insertUserSchema,
 selectUserSchema,
 type InsertUser,
 type User,
} from '../../data-access/schema.ts'

const findUserByEmail = async (email: string): Promise<User | undefined> => {
 const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, email))
  .limit(1)

 return users[0]
}

const findUserById = async (id: string): Promise<User | undefined> => {
 const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.id, id))
  .limit(1)

 return users[0]
}

const createUser = async (userData: InsertUser): Promise<User> => {
 const [user] = await db.insert(usersTable).values(userData).returning()

 return user
}

const updateLastLogin = async ({
 id,
}: {
 id: string
}): Promise<User | undefined> => {
 const [user] = await db
  .update(usersTable)
  .set({ lastLogin: new Date() })
  .where(eq(usersTable.id, id))
  .returning()

 return user
}

export { createUser, findUserByEmail, findUserById, updateLastLogin }
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
import {
 findUserById,
 createUser,
 updateLastLogin,
} from './user.data-access.ts'

class UserService {
 async registerOrLoginUserById(id: string, email: string) {
  let user = await findUserById(id)

  if (!user) {
   user = await createUser({ id, email })
  } else {
   user = await updateLastLogin({ id })
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

### 2. Storing Embeddings with Zod Validation

Embeddings are stored in the `chat_vectors` table using the vector type with Zod validation:

```typescript
// Example of storing an embedding with Zod validation
import {
 insertChatVectorSchema,
 selectChatVectorSchema,
} from '../../data-access/schema.ts'
import { z } from 'zod'

type InsertChatVector = z.infer<typeof insertChatVectorSchema>
type ChatVector = z.infer<typeof selectChatVectorSchema>

const storeEmbedding = async (
 data: Omit<InsertChatVector, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ChatVector | null> => {
 // Validate input data
 const validatedData = insertChatVectorSchema.parse(data)

 return await db
  .insert(chatVectorsTable)
  .values(validatedData)
  .returning()
  .then((rows) => selectChatVectorSchema.parse(rows[0] ?? null))
}
```

### 3. Similarity Search

Similarity searches can be performed using pgvector's operators:

```typescript
// Example of similarity search with Zod validation
import { sql } from 'drizzle-orm'

const findSimilarVectors = async (
 embedding: number[],
 limit = 5,
): Promise<ChatVector[]> => {
 const results = await db
  .select()
  .from(chatVectorsTable)
  .orderBy(sql`embedding <-> ${embedding}`)
  .limit(limit)

 return results.map((result) => selectChatVectorSchema.parse(result))
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

### 1. Unit Tests with Zod Validation

Unit tests for data access functions use a test database or mocks with Zod validation:

```typescript
// Example unit test for findUserById with Zod validation
import { selectUserSchema } from '../../data-access/schema.ts'

describe('findUserById', () => {
 it('should return a valid user when found', async () => {
  // Arrange
  const mockUser = {
   id: 'test-id',
   email: 'test@example.com',
   emailVerified: false,
   createdAt: new Date(),
   updatedAt: new Date(),
  }
  // Mock db or use test database

  // Act
  const result = await findUserById('test-id')

  // Assert
  expect(result).not.toBeNull()
  expect(() => selectUserSchema.parse(result)).not.toThrow()
  expect(result?.id).toEqual(mockUser.id)
 })
})
```

### 2. Integration Tests

Integration tests verify the interaction between the data access layer and the database:

```typescript
// Example integration test with Zod validation
describe('User data access integration', () => {
 beforeAll(async () => {
  // Set up test database
 })

 afterAll(async () => {
  // Clean up test database
 })

 it('should create and retrieve a user with valid schema', async () => {
  // Create user
  const userData = {
   id: 'test-id',
   email: 'test@example.com',
  }
  const created = await createUser(userData)

  // Validate created user
  expect(() => selectUserSchema.parse(created)).not.toThrow()

  // Retrieve user
  const found = await findUserById('test-id')

  // Verify
  expect(found).not.toBeNull()
  expect(() => selectUserSchema.parse(found)).not.toThrow()
  expect(found?.id).toEqual(userData.id)
 })
})
```

---

## Implementation Status

- [x] Define database schema with Drizzle ORM
- [x] Set up database connection
- [x] Implement data access layer with Zod validation
- [x] Set up database migrations
- [x] Integrate with business logic
- [x] Implement Drizzle-Zod integration for schema validation
- [ ] Implement unit tests for data access layer
- [ ] Implement integration tests for database operations

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
- [x] Add Zod schema validation for all database operations

---

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle-Zod Documentation](https://orm.drizzle.team/docs/zod)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Neon PostgreSQL Documentation](https://neon.tech/docs/introduction)
- [Node-Postgres Documentation](https://node-postgres.com/)
- [Zod Documentation](https://zod.dev/)

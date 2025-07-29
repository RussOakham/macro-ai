# Database Operations

## Current Implementation Status ✅ PRODUCTION-READY

This document provides comprehensive guidance for database operations in the Macro AI application, including schema
management, migrations, backup procedures, performance optimization, and maintenance tasks. The database operations
are **fully implemented and production-ready** with PostgreSQL 15+, Drizzle ORM, and pgvector extension support.

## 🗄️ Database Architecture

### Technology Stack ✅ IMPLEMENTED

- **Database**: PostgreSQL 15+ with pgvector extension
- **ORM**: Drizzle ORM with TypeScript integration
- **Connection**: Node.js pg pool with connection management
- **Migrations**: Drizzle Kit for schema versioning
- **Validation**: Zod schemas with Drizzle-Zod integration
- **Vector Search**: pgvector for AI/ML embeddings (1536 dimensions)

### Database Schema Overview ✅ COMPLETE

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        boolean email_verified
        varchar first_name
        varchar last_name
        timestamp created_at
        timestamp updated_at
        timestamp last_login
    }

    chats {
        uuid id PK
        uuid user_id FK
        varchar title
        timestamp created_at
        timestamp updated_at
    }

    chat_messages {
        uuid id PK
        uuid chat_id FK
        varchar role
        text content
        jsonb metadata
        vector embedding
        timestamp created_at
    }

    chat_vectors {
        uuid id PK
        uuid user_id FK
        uuid chat_id FK
        uuid message_id FK
        text content
        vector embedding
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    users ||--o{ chats : "owns"
    chats ||--o{ chat_messages : "contains"
    chat_messages ||--o| chat_vectors : "has_embedding"
    users ||--o{ chat_vectors : "owns"
```

## 🔧 Database Configuration

### Connection Management ✅ IMPLEMENTED

#### Connection Pool Configuration

```typescript
// apps/express-api/src/data-access/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '../../config/default.ts'

const pool = new Pool({
	connectionString: config.relationalDatabaseUrl,
	max: 20, // Maximum connections in pool
	idleTimeoutMillis: 30000, // Close idle connections after 30s
	connectionTimeoutMillis: 2000, // Connection timeout
	ssl:
		process.env.NODE_ENV === 'production'
			? { rejectUnauthorized: false }
			: false,
})

// Handle pool errors
pool.on('error', (err) => {
	console.error('Unexpected error on idle client', err)
	process.exit(-1)
})

const db = drizzle({ client: pool })
export { db, pool }
```

#### Environment Configuration

```bash
# Development
RELATIONAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/macro_ai_dev

# Staging
RELATIONAL_DATABASE_URL=postgresql://staging_user:secure_pass@staging-db:5432/macro_ai_staging

# Production
RELATIONAL_DATABASE_URL=postgresql://prod_user:very_secure_pass@prod-db:5432/macro_ai_prod?sslmode=require
```

### Drizzle Configuration ✅ IMPLEMENTED

```typescript
// apps/express-api/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import { config } from './config/default.ts'

export default defineConfig({
	schema: './src/data-access/schema.ts',
	out: './src/data-access/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: config.relationalDatabaseUrl,
	},
	// Disable breakpoints to prevent interactive prompts during CI/CD
	breakpoints: false,
})
```

## 🔄 Migration Management

### Migration Commands ✅ AVAILABLE

#### Workspace Commands (from root)

```bash
# Generate migrations based on schema changes
pnpm db:generate:express-api

# Apply migrations to database
pnpm db:push:express-api

# Reset database (development only)
pnpm db:reset:express-api
```

#### Local Commands (from apps/express-api)

```bash
# Generate migrations
pnpm db:generate

# Apply migrations
pnpm db:push

# View migration status
pnpm db:status

# Drop database (development only)
pnpm db:drop
```

### Migration Workflow ✅ IMPLEMENTED

#### 1. Schema Changes

```typescript
// Example: Adding new column to users table
export const usersTable = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false),
		firstName: varchar('first_name', { length: 255 }),
		lastName: varchar('last_name', { length: 255 }),
		// New column
		phoneNumber: varchar('phone_number', { length: 20 }),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
		lastLogin: timestamp('last_login'),
	},
	(users) => [uniqueIndex('email_idx').on(users.email)],
)
```

#### 2. Generate Migration

```bash
# Generate migration file
pnpm db:generate

# Output: New migration file created
# 0002_add_phone_number_to_users.sql
```

#### 3. Review Migration

```sql
-- Generated migration file
ALTER TABLE "users" ADD COLUMN "phone_number" varchar(20);
```

#### 4. Apply Migration

```bash
# Apply to development
pnpm db:push

# Apply to staging (via CI/CD)
# Apply to production (via CI/CD with approval)
```

### Migration History ✅ TRACKED

Current migrations in `apps/express-api/src/data-access/migrations/`:

- **0000_big_tomas.sql** - Initial schema with users and chat_vectors tables
- **0001_dry_romulus.sql** - Added email_verified column to users table
- **Migration metadata** - Complete tracking in `meta/_journal.json`

### Production Migration Strategy ✅ PLANNED

#### Safe Migration Process

```bash
#!/bin/bash
# Production migration script

echo "🚀 Starting production migration..."

# 1. Create database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Test migration on backup
createdb macro_ai_migration_test
psql macro_ai_migration_test < backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Apply migration to test database
cd apps/express-api
DATABASE_URL="postgresql://localhost/macro_ai_migration_test" pnpm db:push

# 4. Verify migration success
if [ $? -eq 0 ]; then
  echo "✅ Migration test successful"

  # 5. Apply to production
  pnpm db:push

  echo "✅ Production migration completed"
else
  echo "❌ Migration test failed - aborting production migration"
  exit 1
fi

# 6. Cleanup test database
dropdb macro_ai_migration_test
```

## 💾 Backup and Recovery

### Automated Backup Strategy ✅ PLANNED

#### Daily Backups

```bash
#!/bin/bash
# Daily backup script

BACKUP_DIR="/backups/macro-ai"
DATE=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="postgresql://prod_user:password@prod-db:5432/macro_ai_prod"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/full_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/full_backup_$DATE.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/full_backup_$DATE.sql.gz s3://macro-ai-backups/daily/

# Cleanup local backups older than 7 days
find $BACKUP_DIR -name "full_backup_*.sql.gz" -mtime +7 -delete

echo "✅ Daily backup completed: full_backup_$DATE.sql.gz"
```

#### Point-in-Time Recovery Setup

```sql
-- Enable WAL archiving for point-in-time recovery
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'aws s3 cp %p s3://macro-ai-wal-archive/%f';
ALTER SYSTEM SET max_wal_senders = 3;

-- Restart PostgreSQL to apply changes
SELECT pg_reload_conf();
```

### Recovery Procedures ✅ DOCUMENTED

#### Full Database Restore

```bash
#!/bin/bash
# Database restore script

BACKUP_FILE=$1
TARGET_DB="macro_ai_restored"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

echo "🔄 Starting database restore..."

# 1. Create new database
createdb $TARGET_DB

# 2. Restore from backup
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c $BACKUP_FILE | psql $TARGET_DB
else
  psql $TARGET_DB < $BACKUP_FILE
fi

# 3. Verify restore
psql $TARGET_DB -c "SELECT COUNT(*) FROM users;"

echo "✅ Database restore completed: $TARGET_DB"
```

#### Point-in-Time Recovery

```bash
#!/bin/bash
# Point-in-time recovery script

RECOVERY_TIME=$1  # Format: '2024-01-15 14:30:00'
BASE_BACKUP=$2

echo "🔄 Starting point-in-time recovery to $RECOVERY_TIME..."

# 1. Stop PostgreSQL
sudo systemctl stop postgresql

# 2. Restore base backup
rm -rf /var/lib/postgresql/15/main/*
tar -xzf $BASE_BACKUP -C /var/lib/postgresql/15/main/

# 3. Create recovery configuration
cat > /var/lib/postgresql/15/main/postgresql.auto.conf << EOF
restore_command = 'aws s3 cp s3://macro-ai-wal-archive/%f %p'
recovery_target_time = '$RECOVERY_TIME'
recovery_target_action = 'promote'
EOF

# 4. Start PostgreSQL in recovery mode
sudo systemctl start postgresql

echo "✅ Point-in-time recovery initiated"
```

## 🚀 Performance Optimization

### Index Management ✅ IMPLEMENTED

#### Current Indexes

```sql
-- Users table indexes
CREATE UNIQUE INDEX email_idx ON users (email);

-- Chats table indexes
CREATE INDEX idx_chats_user_id ON chats (user_id);
CREATE INDEX idx_chats_updated_at ON chats (updated_at);

-- Chat messages indexes
CREATE INDEX idx_chat_messages_chat_id ON chat_messages (chat_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages (created_at);

-- Chat vectors indexes (pgvector)
CREATE INDEX idx_chat_vectors_user_id ON chat_vectors (user_id);
CREATE INDEX idx_chat_vectors_chat_id ON chat_vectors (chat_id);
CREATE INDEX idx_chat_vectors_embedding ON chat_vectors USING ivfflat (embedding vector_cosine_ops);
```

#### Index Monitoring

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';
```

### Query Optimization ✅ IMPLEMENTED

#### Efficient Query Patterns

```typescript
// ✅ Good: Use indexes effectively
const getUserChats = async (userId: string) => {
	return await db
		.select()
		.from(chatsTable)
		.where(eq(chatsTable.userId, userId))
		.orderBy(desc(chatsTable.updatedAt))
		.limit(20)
}

// ✅ Good: Join optimization
const getChatWithMessages = async (chatId: string) => {
	return await db
		.select()
		.from(chatsTable)
		.leftJoin(chatMessagesTable, eq(chatsTable.id, chatMessagesTable.chatId))
		.where(eq(chatsTable.id, chatId))
}

// ✅ Good: Batch operations
const createMultipleMessages = async (messages: TInsertChatMessage[]) => {
	return await db.insert(chatMessagesTable).values(messages).returning()
}
```

#### Query Performance Monitoring

```sql
-- Enable query logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM chats
WHERE user_id = 'user-uuid'
ORDER BY updated_at DESC
LIMIT 10;
```

### Connection Pool Optimization ✅ CONFIGURED

```typescript
// Optimized connection pool settings
const pool = new Pool({
	connectionString: config.relationalDatabaseUrl,

	// Connection limits
	max: 20, // Max connections (adjust based on load)
	min: 2, // Min connections to maintain

	// Timeout settings
	idleTimeoutMillis: 30000, // Close idle connections after 30s
	connectionTimeoutMillis: 2000, // Connection timeout
	acquireTimeoutMillis: 60000, // Max time to wait for connection

	// Health checks
	allowExitOnIdle: true, // Allow process to exit when idle
})

// Monitor pool health
setInterval(() => {
	console.log('Pool status:', {
		totalCount: pool.totalCount,
		idleCount: pool.idleCount,
		waitingCount: pool.waitingCount,
	})
}, 60000) // Log every minute
```

## 🔍 Monitoring and Maintenance

### Database Health Monitoring ✅ IMPLEMENTED

#### Health Check Queries

```typescript
// Database health check implementation
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
	const startTime = Date.now()

	try {
		// Test basic connectivity
		await db.execute(sql`SELECT 1`)

		// Check connection pool status
		const poolStatus = {
			totalCount: pool.totalCount,
			idleCount: pool.idleCount,
			waitingCount: pool.waitingCount,
		}

		// Check table accessibility
		const userCount = await db.select({ count: count() }).from(usersTable)

		return {
			status: 'healthy',
			responseTime: Date.now() - startTime,
			details: {
				connectionPool: poolStatus,
				tableAccess: userCount[0]?.count !== undefined,
			},
		}
	} catch (error) {
		return {
			status: 'unhealthy',
			responseTime: Date.now() - startTime,
			error: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}
```

#### Performance Metrics Collection

```sql
-- Database performance metrics
SELECT
  datname,
  numbackends,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit,
  tup_returned,
  tup_fetched,
  tup_inserted,
  tup_updated,
  tup_deleted
FROM pg_stat_database
WHERE datname = 'macro_ai_prod';

-- Table-specific metrics
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables;
```

### Maintenance Tasks ✅ SCHEDULED

#### Daily Maintenance

```bash
#!/bin/bash
# Daily maintenance script

echo "🔧 Starting daily database maintenance..."

# 1. Update table statistics
psql $DATABASE_URL -c "ANALYZE;"

# 2. Check for bloated tables
psql $DATABASE_URL -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 3. Monitor connection usage
psql $DATABASE_URL -c "
SELECT
  state,
  COUNT(*) as connections
FROM pg_stat_activity
WHERE datname = 'macro_ai_prod'
GROUP BY state;
"

echo "✅ Daily maintenance completed"
```

#### Weekly Maintenance

```bash
#!/bin/bash
# Weekly maintenance script

echo "🔧 Starting weekly database maintenance..."

# 1. Vacuum and reindex
psql $DATABASE_URL -c "VACUUM ANALYZE;"
psql $DATABASE_URL -c "REINDEX DATABASE macro_ai_prod;"

# 2. Check for unused indexes
psql $DATABASE_URL -c "
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';
"

# 3. Archive old data (if applicable)
# psql $DATABASE_URL -c "DELETE FROM chat_vectors WHERE created_at < NOW() - INTERVAL '1 year';"

echo "✅ Weekly maintenance completed"
```

## 🔐 Security Operations

### Access Control ✅ IMPLEMENTED

#### Database User Management

```sql
-- Create application user with limited privileges
CREATE USER macro_ai_app WITH PASSWORD 'secure_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE macro_ai_prod TO macro_ai_app;
GRANT USAGE ON SCHEMA public TO macro_ai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO macro_ai_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO macro_ai_app;

-- Create read-only user for analytics
CREATE USER macro_ai_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE macro_ai_prod TO macro_ai_readonly;
GRANT USAGE ON SCHEMA public TO macro_ai_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO macro_ai_readonly;
```

#### SSL Configuration

```sql
-- Enforce SSL connections
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/etc/ssl/certs/server.crt';
ALTER SYSTEM SET ssl_key_file = '/etc/ssl/private/server.key';
SELECT pg_reload_conf();
```

### Data Protection ✅ IMPLEMENTED

#### Sensitive Data Handling

```typescript
// Data sanitization for logs
export function sanitizeUserData(user: any): Partial<typeof user> {
	return {
		id: user.id,
		firstName: user.firstName,
		// Exclude sensitive fields like email, phone, etc.
	}
}

// Audit logging
export async function logDatabaseOperation(
	operation: string,
	table: string,
	userId?: string,
	details?: Record<string, unknown>,
) {
	console.log({
		type: 'database_operation',
		operation,
		table,
		userId,
		details: sanitizeUserData(details),
		timestamp: new Date().toISOString(),
	})
}
```

## 📚 Related Documentation

- **[Database Design](../architecture/database-design.md)** - Schema design and relationships
- **[System Architecture](../architecture/system-architecture.md)** - Overall system database integration
- **[Release Process](./release-process.md)** - Database migration in releases
- **[Monitoring and Logging](../deployment/monitoring-logging.md)** - Database monitoring integration
- **[Environment Setup](../deployment/environment-setup.md)** - Database configuration for deployments

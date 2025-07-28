# ADR-003: Database Technology Selection

## Status

✅ **ACCEPTED** - Implemented and in production use

## Context

The Macro AI application requires a robust data storage solution to handle user data, chat conversations, AI-generated content, and vector embeddings for semantic search. We needed to select database technologies that could support:

1. **Relational Data**: User profiles, chat metadata, structured application data
2. **Unstructured Content**: Chat messages, AI responses, variable-length text
3. **Vector Data**: AI embeddings for semantic search and similarity matching
4. **Caching**: Session data, frequently accessed content, rate limiting
5. **Performance**: Low-latency reads, efficient writes, concurrent access
6. **Scalability**: Growth from hundreds to millions of users

## Decision

We will use a **multi-database architecture** with:

1. **PostgreSQL 15+** as the primary relational database with **pgvector extension** for vector storage
2. **Redis** for caching, session storage, and rate limiting
3. **Drizzle ORM** for type-safe database operations and migrations

## Rationale

### Why PostgreSQL with pgvector?

#### ✅ Advantages

- **ACID Compliance**: Full transactional integrity for critical user data
- **JSON Support**: Native JSONB for flexible metadata storage
- **Vector Extension**: pgvector provides native vector similarity search
- **Performance**: Excellent performance for both relational and vector queries
- **Ecosystem**: Mature ecosystem with extensive tooling and community
- **Scalability**: Proven scalability patterns (read replicas, partitioning)
- **Cost-Effective**: Open source with predictable hosting costs
- **Full-Text Search**: Built-in full-text search capabilities

#### ❌ Disadvantages

- **Vector Limitations**: pgvector less mature than specialized vector databases
- **Complexity**: Managing both relational and vector data in one system
- **Scaling Vectors**: Vector operations can be resource-intensive

### Why Redis for Caching?

#### ✅ Advantages

- **Performance**: Sub-millisecond response times for cached data
- **Data Structures**: Rich data types (strings, hashes, lists, sets)
- **Persistence**: Optional persistence for critical cached data
- **Atomic Operations**: Built-in atomic operations for counters, rate limiting
- **Memory Efficiency**: Optimized memory usage and compression
- **Clustering**: Built-in clustering for horizontal scaling

#### ❌ Disadvantages

- **Memory Cost**: Higher cost per GB compared to disk storage
- **Volatility**: Data loss risk if not properly configured for persistence
- **Complexity**: Additional system to monitor and maintain

### Why Drizzle ORM?

#### ✅ Advantages

- **Type Safety**: Full TypeScript integration with compile-time type checking
- **Performance**: Minimal runtime overhead, close to raw SQL performance
- **SQL-Like Syntax**: Familiar query builder syntax for SQL developers
- **Migration System**: Robust schema migration and versioning
- **Zero Runtime Dependencies**: No runtime reflection or decorators
- **Tree Shaking**: Only includes used query builders in final bundle

#### ❌ Disadvantages

- **Learning Curve**: Different from traditional ORMs like TypeORM or Prisma
- **Ecosystem**: Smaller ecosystem compared to more established ORMs
- **Documentation**: Less comprehensive documentation than mature alternatives

## Implementation Details

### Database Schema Design

```typescript
// Core schema with pgvector integration
export const usersTable = pgTable(
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

export const chatsTable = pgTable(
	'chats',
	{
		id: uuid('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => usersTable.id),
		title: varchar('title', { length: 255 }).notNull(),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(chats) => [
		index('idx_chats_user_id').on(chats.userId),
		index('idx_chats_updated_at').on(chats.updatedAt),
	],
)

export const chatMessagesTable = pgTable(
	'chat_messages',
	{
		id: uuid('id').primaryKey(),
		chatId: uuid('chat_id')
			.notNull()
			.references(() => chatsTable.id),
		role: varchar('role', { length: 50 }).notNull(), // 'user' | 'assistant' | 'system'
		content: text('content').notNull(),
		metadata: jsonb('metadata'),
		createdAt: timestamp('created_at').defaultNow(),
	},
	(messages) => [
		index('idx_chat_messages_chat_id').on(messages.chatId),
		index('idx_chat_messages_created_at').on(messages.createdAt),
	],
)

// Vector storage for semantic search
export const chatVectorsTable = pgTable(
	'chat_vectors',
	{
		id: uuid('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => usersTable.id),
		chatId: uuid('chat_id')
			.notNull()
			.references(() => chatsTable.id),
		messageId: uuid('message_id').references(() => chatMessagesTable.id),
		content: text('content').notNull(),
		embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embedding dimensions
		metadata: jsonb('metadata'),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(vectors) => [
		index('idx_chat_vectors_user_id').on(vectors.userId),
		index('idx_chat_vectors_chat_id').on(vectors.chatId),
		// HNSW index for vector similarity search
		index('idx_chat_vectors_embedding_hnsw').using(
			'hnsw',
			vectors.embedding.op('vector_cosine_ops'),
		),
	],
)
```

### Vector Search Implementation

```typescript
// Semantic search using pgvector
export class VectorSearchService {
	async semanticSearch(
		queryEmbedding: number[],
		userId: string,
		options: {
			limit?: number
			threshold?: number
			chatId?: string
		} = {},
	): Promise<Result<SemanticSearchResult[]>> {
		const { limit = 10, threshold = 0.7, chatId } = options

		const whereConditions = [eq(chatVectorsTable.userId, userId)]
		if (chatId) {
			whereConditions.push(eq(chatVectorsTable.chatId, chatId))
		}

		const [results, error] = await tryCatch(
			db.execute(sql`
        SELECT 
          ${chatVectorsTable.id},
          ${chatVectorsTable.content},
          ${chatVectorsTable.chatId},
          ${chatVectorsTable.messageId},
          ${chatVectorsTable.metadata},
          ${chatVectorsTable.createdAt},
          1 - (${chatVectorsTable.embedding} <=> ${queryEmbedding}) as similarity
        FROM ${chatVectorsTable}
        WHERE ${chatVectorsTable.userId} = ${userId}
          ${chatId ? sql`AND ${chatVectorsTable.chatId} = ${chatId}` : sql``}
          AND 1 - (${chatVectorsTable.embedding} <=> ${queryEmbedding}) >= ${threshold}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `),
			'VectorSearchService.semanticSearch',
		)

		if (error) {
			return [null, error]
		}

		return [results.map(this.mapToSearchResult), null]
	}
}
```

### Caching Strategy

```typescript
// Multi-level caching with Redis
export class CacheService {
	private memoryCache = new Map<string, { data: any; expires: number }>()
	private redis: Redis

	async get<T>(key: string): Promise<T | null> {
		// L1: Memory cache
		const memoryItem = this.memoryCache.get(key)
		if (memoryItem && memoryItem.expires > Date.now()) {
			return memoryItem.data
		}

		// L2: Redis cache
		try {
			const redisValue = await this.redis.get(key)
			if (redisValue) {
				const data = JSON.parse(redisValue)

				// Update memory cache
				this.memoryCache.set(key, {
					data,
					expires: Date.now() + 300000, // 5 minutes
				})

				return data
			}
		} catch (error) {
			logger.error('Redis cache error:', error)
		}

		return null
	}

	async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
		try {
			// Set in Redis with TTL
			await this.redis.setex(key, ttl, JSON.stringify(value))

			// Set in memory cache with shorter TTL
			this.memoryCache.set(key, {
				data: value,
				expires: Date.now() + Math.min(ttl * 1000, 300000), // Max 5 minutes
			})
		} catch (error) {
			logger.error('Cache set error:', error)
		}
	}
}
```

## Alternatives Considered

### 1. MongoDB + Pinecone

#### ✅ Advantages

- **Document Model**: Natural fit for chat messages and metadata
- **Specialized Vector DB**: Pinecone optimized for vector operations
- **Scalability**: Both systems designed for horizontal scaling

#### ❌ Disadvantages

- **Complexity**: Managing two separate database systems
- **Cost**: Pinecone pricing can be expensive at scale
- **Consistency**: Potential consistency issues between systems
- **ACID**: MongoDB lacks full ACID compliance for critical operations

**Decision**: Rejected due to complexity and cost concerns

### 2. PostgreSQL + Weaviate

#### ✅ Advantages

- **Specialized Vector DB**: Weaviate built specifically for vector operations
- **GraphQL API**: Modern API interface for vector queries
- **ML Integration**: Built-in ML model integration

#### ❌ Disadvantages

- **Additional System**: Another database to manage and monitor
- **Learning Curve**: Team needs to learn Weaviate-specific concepts
- **Data Synchronization**: Keeping data in sync between systems

**Decision**: Rejected due to operational complexity

### 3. Single PostgreSQL (without vectors)

#### ✅ Advantages

- **Simplicity**: Single database system to manage
- **ACID Compliance**: Full transactional integrity
- **Mature Ecosystem**: Well-established tooling and practices

#### ❌ Disadvantages

- **No Semantic Search**: Missing vector similarity capabilities
- **Limited AI Features**: Reduced AI-powered functionality
- **Future Limitations**: Harder to add vector features later

**Decision**: Rejected due to missing AI capabilities

### 4. Supabase (PostgreSQL + Vector)

#### ✅ Advantages

- **Managed Service**: Fully managed PostgreSQL with pgvector
- **Built-in Features**: Authentication, real-time, storage included
- **Developer Experience**: Excellent tooling and documentation

#### ❌ Disadvantages

- **Vendor Lock-in**: Tied to Supabase platform
- **Cost**: More expensive than self-managed PostgreSQL
- **Control**: Less control over database configuration

**Decision**: Rejected due to vendor lock-in concerns

## Performance Considerations

### Database Optimization

```sql
-- Optimized indexes for performance
CREATE INDEX CONCURRENTLY idx_chats_user_id_updated_at
ON chats (user_id, updated_at DESC);

CREATE INDEX CONCURRENTLY idx_chat_messages_chat_id_created_at
ON chat_messages (chat_id, created_at ASC);

-- Vector similarity index with optimal parameters
CREATE INDEX CONCURRENTLY idx_chat_vectors_embedding_hnsw
ON chat_vectors USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY idx_active_chats
ON chats (user_id, updated_at DESC)
WHERE updated_at > NOW() - INTERVAL '30 days';
```

### Connection Management

```typescript
// Optimized connection pool configuration
const pool = new Pool({
	connectionString: config.relationalDatabaseUrl,
	max: 20, // Maximum connections
	min: 2, // Minimum connections
	idleTimeoutMillis: 30000, // Close idle connections
	connectionTimeoutMillis: 2000, // Connection timeout
	acquireTimeoutMillis: 60000, // Max wait for connection
})
```

## Monitoring and Maintenance

### Key Metrics

```typescript
// Database performance monitoring
export class DatabaseMetrics {
	async collectMetrics(): Promise<DatabaseHealth> {
		const [connectionCount] = await db.execute(sql`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `)

		const [slowQueries] = await db.execute(sql`
      SELECT count(*) as slow_queries
      FROM pg_stat_statements 
      WHERE mean_exec_time > 1000
    `)

		const [cacheHitRatio] = await db.execute(sql`
      SELECT 
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
      FROM pg_statio_user_tables
    `)

		return {
			activeConnections: connectionCount.active_connections,
			slowQueries: slowQueries.slow_queries,
			cacheHitRatio: cacheHitRatio.cache_hit_ratio,
			timestamp: new Date(),
		}
	}
}
```

### Backup Strategy

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/macro-ai"
DATE=$(date +%Y%m%d_%H%M%S)

# Full database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/full_backup_$DATE.sql

# Compress and upload to S3
gzip $BACKUP_DIR/full_backup_$DATE.sql
aws s3 cp $BACKUP_DIR/full_backup_$DATE.sql.gz s3://macro-ai-backups/daily/

# Cleanup old backups
find $BACKUP_DIR -name "full_backup_*.sql.gz" -mtime +7 -delete
```

## Migration Strategy

### Schema Evolution

```typescript
// Migration example with vector support
export async function up(db: Database) {
	// Enable pgvector extension
	await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)

	// Create chat_vectors table
	await db.execute(sql`
    CREATE TABLE chat_vectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      chat_id UUID NOT NULL REFERENCES chats(id),
      message_id UUID REFERENCES chat_messages(id),
      content TEXT NOT NULL,
      embedding VECTOR(1536),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

	// Create vector similarity index
	await db.execute(sql`
    CREATE INDEX idx_chat_vectors_embedding_hnsw 
    ON chat_vectors USING hnsw (embedding vector_cosine_ops)
  `)
}
```

## Success Metrics

### Performance Targets

- **Query Response Time**: < 100ms for 95th percentile
- **Vector Search**: < 500ms for similarity queries
- **Cache Hit Ratio**: > 90% for frequently accessed data
- **Connection Pool**: < 80% utilization under normal load
- **Backup Success**: 100% successful daily backups

### Monitoring Implementation

- **Database Performance**: Continuous monitoring with alerts
- **Vector Query Performance**: Specialized metrics for vector operations
- **Cache Effectiveness**: Redis hit/miss ratios and memory usage
- **Storage Growth**: Tracking data growth patterns and projections

## Review and Updates

This ADR should be reviewed:

- **Quarterly**: Performance analysis and optimization opportunities
- **Before Scaling**: When approaching performance or storage limits
- **Technology Updates**: When new database features or alternatives emerge
- **Cost Reviews**: During budget planning and cost optimization

**Last Reviewed**: 2024-01-15
**Next Review**: 2024-04-15
**Reviewers**: Architecture Team, Database Team, DevOps Team

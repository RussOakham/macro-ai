# System Architecture

## Current Implementation Status ✅ PRODUCTION-READY

This document provides a comprehensive overview of the Macro AI system architecture, including high-level component
relationships, data flow patterns, and architectural decisions. The system architecture is **fully implemented and
production-ready** with a modern, scalable design supporting AI-powered chat functionality.

## 🏗️ High-Level Architecture

### System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile Browser]
    end

    subgraph "CDN & Load Balancing"
        CDN[CloudFront CDN]
        ALB[Application Load Balancer]
    end

    subgraph "Application Layer"
        UI[Client UI - React]
        API[Express API - Node.js]
    end

    subgraph "Service Layer"
        AUTH[Authentication Service]
        CHAT[Chat Service]
        AI[AI Service]
        VECTOR[Vector Service]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL + pgvector)]
        REDIS[(Redis Cache)]
        S3[(S3 Storage)]
    end

    subgraph "External Services"
        COGNITO[AWS Cognito]
        OPENAI[OpenAI API]
    end

    WEB --> CDN
    MOBILE --> CDN
    CDN --> UI
    WEB --> ALB
    MOBILE --> ALB
    ALB --> API

    UI --> API
    API --> AUTH
    API --> CHAT
    API --> AI
    API --> VECTOR

    AUTH --> COGNITO
    CHAT --> POSTGRES
    CHAT --> REDIS
    AI --> OPENAI
    VECTOR --> POSTGRES

    API --> S3
```

### Architecture Principles ✅ IMPLEMENTED

1. **Separation of Concerns**: Clear boundaries between UI, API, and data layers
2. **Microservice-Ready**: Service-oriented architecture within the monolith
3. **Scalability**: Horizontal scaling capabilities with stateless design
4. **Resilience**: Error handling, retry mechanisms, and graceful degradation
5. **Security**: Authentication, authorization, and data protection
6. **Observability**: Comprehensive logging, monitoring, and tracing

## 🎯 Component Architecture

### Frontend Architecture ✅ PRODUCTION-READY

#### React Application Structure

```mermaid
graph TB
    subgraph "React Application"
        APP[App Component]
        ROUTER[TanStack Router]
        QUERY[TanStack Query]

        subgraph "Feature Components"
            AUTH_UI[Authentication UI]
            CHAT_UI[Chat Interface]
            PROFILE[User Profile]
        end

        subgraph "Shared Components"
            UI_LIB[Shadcn/ui Components]
            FORMS[Form Components]
            LAYOUT[Layout Components]
        end

        subgraph "Services"
            API_CLIENT[API Client]
            AUTH_SERVICE[Auth Service]
            CHAT_SERVICE[Chat Service]
        end
    end

    APP --> ROUTER
    APP --> QUERY
    ROUTER --> AUTH_UI
    ROUTER --> CHAT_UI
    ROUTER --> PROFILE

    AUTH_UI --> UI_LIB
    CHAT_UI --> UI_LIB
    PROFILE --> UI_LIB

    AUTH_UI --> API_CLIENT
    CHAT_UI --> API_CLIENT
    PROFILE --> API_CLIENT

    API_CLIENT --> AUTH_SERVICE
    API_CLIENT --> CHAT_SERVICE
```

**Key Technologies**:

- **React 19**: Latest React with React Compiler optimization
- **TanStack Router**: Type-safe routing with data preloading
- **TanStack Query**: Server state management and caching
- **Vercel AI SDK**: Streaming chat responses
- **Shadcn/ui**: Modern component library with theme support
- **Tailwind CSS**: Utility-first CSS framework

#### State Management Strategy

```typescript
// Global state management approach
interface ApplicationState {
	// Server state managed by TanStack Query
	serverState: {
		user: UserData
		chats: ChatData[]
		messages: MessageData[]
	}

	// Client state managed by React hooks
	clientState: {
		theme: 'light' | 'dark' | 'system'
		sidebarOpen: boolean
		currentChatId: string | null
	}

	// Streaming state managed by AI SDK
	streamingState: {
		isStreaming: boolean
		currentMessage: string
		error: Error | null
	}
}
```

### Backend Architecture ✅ PRODUCTION-READY

#### Express API Structure

```mermaid
graph TB
    subgraph "Express API"
        SERVER[Express Server]
        MIDDLEWARE[Middleware Stack]
        ROUTES[Route Handlers]

        subgraph "Controllers"
            AUTH_CTRL[Auth Controller]
            CHAT_CTRL[Chat Controller]
            USER_CTRL[User Controller]
        end

        subgraph "Services"
            AUTH_SVC[Auth Service]
            CHAT_SVC[Chat Service]
            AI_SVC[AI Service]
            VECTOR_SVC[Vector Service]
        end

        subgraph "Data Access"
            AUTH_DA[Auth Data Access]
            CHAT_DA[Chat Data Access]
            MESSAGE_DA[Message Data Access]
            VECTOR_DA[Vector Data Access]
        end

        subgraph "External Integrations"
            COGNITO_CLIENT[Cognito Client]
            OPENAI_CLIENT[OpenAI Client]
        end
    end

    SERVER --> MIDDLEWARE
    MIDDLEWARE --> ROUTES
    ROUTES --> AUTH_CTRL
    ROUTES --> CHAT_CTRL
    ROUTES --> USER_CTRL

    AUTH_CTRL --> AUTH_SVC
    CHAT_CTRL --> CHAT_SVC
    CHAT_CTRL --> AI_SVC
    CHAT_CTRL --> VECTOR_SVC

    AUTH_SVC --> AUTH_DA
    CHAT_SVC --> CHAT_DA
    CHAT_SVC --> MESSAGE_DA
    VECTOR_SVC --> VECTOR_DA

    AUTH_SVC --> COGNITO_CLIENT
    AI_SVC --> OPENAI_CLIENT
```

**Architectural Layers**:

1. **Controller Layer**: HTTP request/response handling and validation
2. **Service Layer**: Business logic and orchestration
3. **Data Access Layer**: Database operations and queries
4. **Integration Layer**: External service communication

#### Service Architecture Pattern

```typescript
// Service interface pattern
interface IChatService {
	createChat(userId: string, title: string): Promise<Result<Chat>>
	getChatById(chatId: string, userId: string): Promise<Result<ChatWithMessages>>
	sendMessage(
		chatId: string,
		message: string,
		userId: string,
	): Promise<Result<void>>
	generateStreamingResponse(
		chatId: string,
		message: string,
	): AsyncGenerator<string>
}

// Implementation with dependency injection
class ChatService implements IChatService {
	constructor(
		private chatDataAccess: IChatDataAccess,
		private messageDataAccess: IMessageDataAccess,
		private aiService: IAIService,
		private vectorService: IVectorService,
	) {}

	async createChat(userId: string, title: string): Promise<Result<Chat>> {
		// Business logic implementation
	}
}
```

## 🔄 Data Flow Architecture

### Request/Response Flow

```mermaid
sequenceDiagram
    participant Client as Client UI
    participant API as Express API
    participant Auth as Auth Service
    participant Chat as Chat Service
    participant AI as AI Service
    participant DB as PostgreSQL
    participant OpenAI as OpenAI API

    Client->>API: POST /api/chats/:id/stream
    API->>Auth: Validate JWT token
    Auth-->>API: User authenticated
    API->>Chat: Process chat message
    Chat->>DB: Save user message
    Chat->>AI: Generate AI response
    AI->>OpenAI: Stream completion request
    OpenAI-->>AI: Streaming response
    AI-->>Chat: Streaming response
    Chat->>DB: Save AI message
    Chat-->>API: Streaming response
    API-->>Client: Server-Sent Events
```

### Data Persistence Flow

```mermaid
graph LR
    subgraph "Write Operations"
        CREATE[Create Chat] --> VALIDATE[Validate Input]
        VALIDATE --> SAVE_CHAT[Save Chat to DB]
        SAVE_CHAT --> GENERATE_VECTOR[Generate Embeddings]
        GENERATE_VECTOR --> SAVE_VECTOR[Save to Vector DB]
    end

    subgraph "Read Operations"
        QUERY[Query Request] --> CHECK_CACHE[Check Redis Cache]
        CHECK_CACHE --> CACHE_HIT{Cache Hit?}
        CACHE_HIT -->|Yes| RETURN_CACHED[Return Cached Data]
        CACHE_HIT -->|No| QUERY_DB[Query PostgreSQL]
        QUERY_DB --> UPDATE_CACHE[Update Cache]
        UPDATE_CACHE --> RETURN_DATA[Return Data]
    end
```

### Streaming Architecture

```mermaid
graph TB
    subgraph "Client Side"
        CHAT_UI[Chat Interface]
        USE_CHAT[useChat Hook]
        STREAM_HANDLER[Stream Handler]
    end

    subgraph "Server Side"
        STREAM_ENDPOINT[/api/chats/:id/stream]
        CHAT_SERVICE[Chat Service]
        AI_SERVICE[AI Service]
        OPENAI_STREAM[OpenAI Stream]
    end

    CHAT_UI --> USE_CHAT
    USE_CHAT --> STREAM_HANDLER
    STREAM_HANDLER --> STREAM_ENDPOINT

    STREAM_ENDPOINT --> CHAT_SERVICE
    CHAT_SERVICE --> AI_SERVICE
    AI_SERVICE --> OPENAI_STREAM

    OPENAI_STREAM -.->|Streaming Response| AI_SERVICE
    AI_SERVICE -.->|Streaming Response| CHAT_SERVICE
    CHAT_SERVICE -.->|Streaming Response| STREAM_ENDPOINT
    STREAM_ENDPOINT -.->|Server-Sent Events| STREAM_HANDLER
```

## 🗄️ Database Architecture

### PostgreSQL Schema Design ✅ IMPLEMENTED

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string cognito_user_id UK
        timestamp created_at
        timestamp updated_at
    }

    chats {
        uuid id PK
        uuid user_id FK
        string title
        timestamp created_at
        timestamp updated_at
    }

    chat_messages {
        uuid id PK
        uuid chat_id FK
        string role
        text content
        jsonb metadata
        timestamp created_at
    }

    chat_vectors {
        uuid id PK
        uuid message_id FK
        vector embedding
        timestamp created_at
    }

    users ||--o{ chats : "owns"
    chats ||--o{ chat_messages : "contains"
    chat_messages ||--|| chat_vectors : "has_embedding"
```

### Data Access Patterns

#### Repository Pattern Implementation

```typescript
// Base repository interface
interface IRepository<T> {
	findById(id: string): Promise<Result<T | null>>
	create(data: Partial<T>): Promise<Result<T>>
	update(id: string, data: Partial<T>): Promise<Result<T>>
	delete(id: string): Promise<Result<void>>
}

// Chat repository implementation
class ChatDataAccess implements IRepository<Chat> {
	constructor(private db: Database) {}

	async findById(id: string): Promise<Result<Chat | null>> {
		const [result, error] = await tryCatch(
			this.db.select().from(chats).where(eq(chats.id, id)).limit(1),
			'ChatDataAccess.findById',
		)

		if (error) return [null, error]
		return [result[0] || null, null]
	}

	async findByUserIdWithMessages(
		userId: string,
	): Promise<Result<ChatWithMessages[]>> {
		// Complex query with joins and relationships
	}
}
```

#### Caching Strategy

```typescript
// Redis caching layer
class CacheService {
	constructor(private redis: Redis) {}

	async get<T>(key: string): Promise<T | null> {
		const cached = await this.redis.get(key)
		return cached ? JSON.parse(cached) : null
	}

	async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
		await this.redis.setex(key, ttl, JSON.stringify(value))
	}

	async invalidate(pattern: string): Promise<void> {
		const keys = await this.redis.keys(pattern)
		if (keys.length > 0) {
			await this.redis.del(...keys)
		}
	}
}

// Usage in service layer
class ChatService {
	async getChatById(chatId: string): Promise<Result<Chat | null>> {
		// Check cache first
		const cached = await this.cache.get<Chat>(`chat:${chatId}`)
		if (cached) return [cached, null]

		// Query database
		const [chat, error] = await this.chatDataAccess.findById(chatId)
		if (error) return [null, error]

		// Update cache
		if (chat) {
			await this.cache.set(`chat:${chatId}`, chat, 1800) // 30 minutes
		}

		return [chat, null]
	}
}
```

## 🔐 Security Architecture

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant API as Express API
    participant Cognito as AWS Cognito
    participant DB as Database

    Client->>Cognito: Login request
    Cognito-->>Client: JWT tokens (access + refresh)
    Client->>API: API request with JWT
    API->>API: Validate JWT signature
    API->>Cognito: Verify token (if needed)
    Cognito-->>API: Token valid
    API->>DB: Query with user context
    DB-->>API: User-scoped data
    API-->>Client: Authorized response
```

### Security Layers

1. **Transport Security**: HTTPS/TLS encryption
2. **Authentication**: AWS Cognito JWT tokens
3. **Authorization**: Role-based access control
4. **Input Validation**: Zod schema validation
5. **Rate Limiting**: Request throttling and abuse prevention
6. **Data Protection**: Encryption at rest and in transit

## 🚀 Scalability Architecture

### Horizontal Scaling Strategy

```mermaid
graph TB
    subgraph "Load Balancer"
        ALB[Application Load Balancer]
    end

    subgraph "Application Tier"
        API1[API Instance 1]
        API2[API Instance 2]
        API3[API Instance N]
    end

    subgraph "Data Tier"
        POSTGRES_PRIMARY[(PostgreSQL Primary)]
        POSTGRES_REPLICA[(PostgreSQL Replica)]
        REDIS_CLUSTER[(Redis Cluster)]
    end

    ALB --> API1
    ALB --> API2
    ALB --> API3

    API1 --> POSTGRES_PRIMARY
    API2 --> POSTGRES_PRIMARY
    API3 --> POSTGRES_PRIMARY

    API1 --> POSTGRES_REPLICA
    API2 --> POSTGRES_REPLICA
    API3 --> POSTGRES_REPLICA

    API1 --> REDIS_CLUSTER
    API2 --> REDIS_CLUSTER
    API3 --> REDIS_CLUSTER

    POSTGRES_PRIMARY -.->|Replication| POSTGRES_REPLICA
```

### Performance Optimization

#### Caching Strategy

```typescript
// Multi-level caching
interface CachingStrategy {
	// Level 1: In-memory application cache
	applicationCache: Map<string, any>

	// Level 2: Redis distributed cache
	distributedCache: Redis

	// Level 3: CDN edge cache
	edgeCache: CloudFront
}

// Cache-aside pattern implementation
async function getChatWithCache(chatId: string): Promise<Chat | null> {
	// L1: Check application cache
	if (applicationCache.has(chatId)) {
		return applicationCache.get(chatId)
	}

	// L2: Check Redis cache
	const cached = await redis.get(`chat:${chatId}`)
	if (cached) {
		const chat = JSON.parse(cached)
		applicationCache.set(chatId, chat)
		return chat
	}

	// L3: Query database
	const chat = await database.getChatById(chatId)
	if (chat) {
		// Update all cache levels
		applicationCache.set(chatId, chat)
		await redis.setex(`chat:${chatId}`, 1800, JSON.stringify(chat))
	}

	return chat
}
```

#### Database Optimization

```sql
-- Optimized indexes for common queries
CREATE INDEX CONCURRENTLY idx_chats_user_id_created_at
ON chats (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_chat_messages_chat_id_created_at
ON chat_messages (chat_id, created_at ASC);

CREATE INDEX CONCURRENTLY idx_chat_vectors_embedding_cosine
ON chat_vectors USING ivfflat (embedding vector_cosine_ops);

-- Partitioning strategy for large tables
CREATE TABLE chat_messages_2024 PARTITION OF chat_messages
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

## 🔍 Monitoring & Observability

### Observability Stack

```mermaid
graph TB
    subgraph "Application"
        APP[Application Code]
        METRICS[Custom Metrics]
        LOGS[Structured Logs]
        TRACES[Distributed Traces]
    end

    subgraph "Collection"
        CLOUDWATCH[CloudWatch]
        XRAY[X-Ray]
        CUSTOM_METRICS[Custom Metrics API]
    end

    subgraph "Analysis"
        DASHBOARDS[CloudWatch Dashboards]
        ALARMS[CloudWatch Alarms]
        INSIGHTS[CloudWatch Insights]
    end

    subgraph "Alerting"
        SNS[SNS Topics]
        SLACK[Slack Notifications]
        PAGERDUTY[PagerDuty]
    end

    APP --> METRICS
    APP --> LOGS
    APP --> TRACES

    METRICS --> CLOUDWATCH
    LOGS --> CLOUDWATCH
    TRACES --> XRAY
    METRICS --> CUSTOM_METRICS

    CLOUDWATCH --> DASHBOARDS
    CLOUDWATCH --> ALARMS
    CLOUDWATCH --> INSIGHTS
    XRAY --> DASHBOARDS

    ALARMS --> SNS
    SNS --> SLACK
    SNS --> PAGERDUTY
```

### Health Check Architecture

```typescript
// Comprehensive health check system
interface HealthCheckSystem {
	checks: {
		database: DatabaseHealthCheck
		redis: RedisHealthCheck
		cognito: CognitoHealthCheck
		openai: OpenAIHealthCheck
		dependencies: DependencyHealthCheck[]
	}

	aggregateHealth(): HealthStatus
	generateReport(): HealthReport
}

// Implementation with circuit breaker pattern
class HealthCheckService {
	private circuitBreakers = new Map<string, CircuitBreaker>()

	async performHealthCheck(): Promise<HealthReport> {
		const checks = await Promise.allSettled([
			this.checkDatabase(),
			this.checkRedis(),
			this.checkCognito(),
			this.checkOpenAI(),
		])

		return this.aggregateResults(checks)
	}
}
```

## 📚 Related Documentation

### Technical Architecture

- **[Database Design](./database-design.md)** - Detailed database schema and relationships
- **[Data Flow](./data-flow.md)** - Data movement and processing patterns
- **[Technology Stack](./technology-stack.md)** - Technology choices and rationale
- **[Security Architecture](./security-architecture.md)** - Security implementation details
- **[AWS Deployment](../deployment/aws-deployment.md)** - Cloud infrastructure architecture

### Product Strategy

- **[Multi-Model Architecture Design](../product/requirements/technical-designs/multi-model-architecture.md)** - Strategic
  multi-model technical requirements
- **[Response Sources Implementation](../product/requirements/technical-designs/response-sources-implementation.md)** -
  Source attribution technical design
- **[Product Roadmap](../product/strategy/product-roadmap.md)** - Strategic context for architecture evolution
- **[Success Metrics](../product/strategy/success-metrics.md)** - Performance targets for system architecture

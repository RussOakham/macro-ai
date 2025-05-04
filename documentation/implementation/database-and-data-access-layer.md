# Database Integration & Data Access Layer Implementation (Neon + Drizzle + pgvector)

## Overview

This document outlines the steps to integrate a Neon-hosted PostgreSQL database into the application, using Drizzle ORM and the pgvector extension for vector storage. The initial focus is on the `users` table, with future extensibility for sessions, chats, chat_vectors, and more.

---

## Database Design

- **PostgreSQL (Neon)**
  - `users`: Stores user profiles and authentication info.
  - `sessions`: (Optional) Tracks user sessions.
  - `chats`: Stores chat metadata.
  - `chat_vectors`: Stores message embeddings (using pgvector).
- **Redis (optional):** For session caching and rate limiting.
- **DynamoDB:** For scalable chat message storage (optional, can be replaced by Postgres if desired).
- **Embedding Service:** Generates and stores embeddings in `chat_vectors`.

---

## Implementation Steps

### 1. Database Setup

- [x] Provision a Neon PostgreSQL database.
- [x] Enable the `pgvector` extension:
  - Run: `CREATE EXTENSION IF NOT EXISTS vector;`
- [x] Create a `users` table with fields:
  - `id` (UUID, PK)
  - `email` (unique, indexed)
  - `name`
  - `created_at`
  - `updated_at`
  - `last_login` (optional)
- [x] Create a `chat_vectors` table with fields:
  - `id` (UUID, PK)
  - `user_id` (FK)
  - `embedding` (vector type, e.g., `vector(1536)`)
  - `created_at`
- [ ] (Optional) Set up Redis for session caching/rate limiting.

### 2. Express API Refactor

- [x] Add a **data-access layer** in `apps/express-api/src/data-access/`.
- [x] Implement a `user.data-access.ts` file using Drizzle ORM for all user DB operations.
- [x] Refactor user registration/login to use the data-access layer.

### 3. User Registration/Login Flow

- [x] On registration:
  - [x] Check if user exists by id.
  - [x] If not, insert new user into `users` table.
- [x] On login:
  - [x] If user does not exist, insert into `users` table.
  - [x] If user exists, update `last_login`.

### 4. Testing

- [ ] Add unit/integration tests for the data-access layer.
- [ ] Add tests for user registration/login flows.

### 5. Future Steps

- [ ] Implement data-access layers for sessions, chats, chat_vectors.
- [ ] Integrate embedding service and vector storage.
- [ ] Add chat message storage in DynamoDB or Postgres.

---

## Notes

- Use Drizzle ORM for all database operations.
- Use environment variables for Neon connection string.
- Use Drizzle migrations for schema changes.
- Use pgvector for storing and querying embeddings.
- Use Drizzle-zod for creating zod schemas from pgTables
- Use AWS Cognito for authentication, validating access tokens from httpOnly cookies.

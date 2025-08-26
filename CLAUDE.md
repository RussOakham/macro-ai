# CLAUDE.md

This file is for AI assistants helping with this repository.  
Please follow these guidelines when answering questions, writing code, or making changes.

---

## Repository Overview

This is a **TypeScript monorepo** managed with **pnpm workspaces**.  
It contains multiple packages and apps:

- `apps/client-ui` — React + Vite application
- `apps/express-api` — Node + Express API server
- `packages/config-eslint` — Shared eslint config
- `packages/config-typescript` - Shared TypeScript configs
- `packages/macro-ai-api-client` — Shared API client and OpenAPI typings (generated with openapi-zod-client + @asteasolutions/zod-to-openapi)
- `packages/types-macro-ai-api` - Types package, which is not currently in use.
- `infrastructure` - Infrastructure constructs and scripts

---

## Language & Tools

- **Language:** TypeScript (strict mode enabled)
- **Package manager:** pnpm 10.15.0+
- **Build tools:** Vite (frontend), esbuild (backend), tsup (packages)
- **Testing:** Vitest across all packages with coverage reporting via `@vitest/coverage-v8`
- **Linting:** ESLint + Prettier
- **API schema:** Zod + OpenAPI
- **Infrastructure:** AWS CDK v2 with TypeScript, deployed via `@repo/infrastructure` workspace
  - ECS Fargate deployments with load balancers
  - RDS PostgreSQL + pgvector for vector search
  - Redis ElastiCache for rate limiting and caching
  - Cognito for authentication
  - CloudWatch for monitoring and logging
  - S3 for static assets and file storage
  - EC2 auto-scaling groups for compute resources
  - Step Functions for workflow orchestration
  - Parameter Store for configuration management

---

## Conventions

- Always prefer **TypeScript types** over `any`.
- Use **Zod** for runtime validation of external input (API requests, env vars).
- Prefer **import alias** unless files are within same parent folder.
- Frontend state management: `@tanstack/react-query` (for server state), use hooks and zustand context for local-app state,
  useState for single component state.
- Commit messages follow **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.).

---

## Code Style

- Functional components with hooks in React.
- Prefer async/await over raw Promises.
- Avoid `console.log` in production code (use installed logger - pino).
- All public functions/types should be exported from an `index.ts` barrel file.

---

## Triage Guidelines

When investigating issues, do not rely solely on code inspection. Follow these steps:

1. **Review documentation proactively** — Check reference material available via MCP servers (e.g., `aws`, `ref`).
2. **Check actual logs** — Use CLI tools (e.g., `gh`, `aws`) to review real outputs and error traces.
3. **Avoid assumptions** — Do not conclude the issue is code-related without validating against logs and external documentation.

---

## CLI Usage Guidelines

When using CLI commands during triage or investigation:

- Always craft queries so they return a **fully formed output**.
- Avoid open-ended results that require manual input, such as:
  - Pagers (e.g., results that stop at `MORE` or `END`)
  - Table views or truncated outputs
- Prefer structured output formats (e.g., `--json`, `--output yaml`) where possible.

This ensures AI-generated commands and results are **complete, reproducible, and parseable**.

---

## How to Respond

When asked to:

1. **Generate code** → Make sure it compiles, respects typing, and follows repo conventions.
2. **Modify existing code** → Suggest full code blocks where possible, not just diffs, to avoid ambiguity.
3. **Explain repo structure** → Use the package/app names listed above.
4. **Write docs/tests** → Follow the style of existing ones in the repo.

If unsure, **prefer explicitness** over guessing hidden conventions.

---

## Example Commands

- Install deps: `pnpm install`
- Build all: `pnpm build`
- Run frontend: `pnpm --filter client-ui dev` or `pnpm ui`
- Run backend: `pnpm --filter @repo/express-api dev` or `pnpm api`
- Test all: `pnpm test`

---

## Out of Scope

Do **not**:

- Suggest switching tooling (e.g., Yarn → npm, Vite → Webpack) unless explicitly requested, or you can articulate a real
  benefit.
- Generate secrets or credentials.
- Remove TypeScript strictness.

---

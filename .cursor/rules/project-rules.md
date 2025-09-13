# Macro AI Project Rules

## Repository Structure

This is a **TypeScript monorepo** managed with **pnpm workspaces**:

- `apps/client-ui` — React + Vite application
- `apps/express-api` — Node + Express API server
- `packages/config-eslint` — Shared eslint config
- `packages/config-typescript` — Shared TypeScript configs
- `packages/macro-ai-api-client` — Shared API client and OpenAPI typings
- `infrastructure` — AWS CDK v2 infrastructure constructs

## Technology Stack

- **Language:** TypeScript (strict mode enabled)
- **Package manager:** pnpm 10.15.0+
- **Build tools:** Vite (frontend), esbuild (backend), tsup (packages)
- **Testing:** Vitest with coverage via `@vitest/coverage-v8`
- **Linting:** ESLint + Prettier
- **API schema:** Zod + OpenAPI
- **Infrastructure:** AWS CDK v2 with ECS Fargate, RDS PostgreSQL + pgvector, Redis ElastiCache, Cognito, CloudWatch

## Code Conventions

- Always prefer **TypeScript types** over `any`
- Use **Zod** for runtime validation of external input (API requests, env vars)
- Prefer **import alias** unless files are within same parent folder
- Frontend state: `@tanstack/react-query` for server state, hooks/zustand for local state
- Commit messages follow **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.)
- Functional components with hooks in React
- Prefer async/await over raw Promises
- Avoid `console.log` in production (use pino logger)
- Export public functions/types from `index.ts` barrel files

## CLI Tools & Shell Preferences

**Use bash for:**

- pnpm commands, scripts with pipes/redirection
- Git operations, Docker commands
- JSON/YAML processing (jq, yq)
- File operations (fd, ripgrep, bat, eza)
- AWS SAM, aws-vault operations

**Use PowerShell for:**

- AWS CLI commands (`aws`, `session-manager-plugin`)
- GitHub CLI (`gh`) operations
- Basic commands when bash unavailable

## Testing Requirements

### Frontend (`apps/client-ui`)

- **.tsx files:** Only unit test hooks
- **.ts files:** Unit test all functionality

### Backend (`apps/express-api`)

- Unit test **everything** (business logic, API routes, services)

### Infrastructure & Packages

- Unit test **everything** (schemas, utils, IaC helpers)

### General Testing Rules

- Focus on **realistic and valuable cases**, not exhaustive permutations
- Avoid contrived edge cases unless business-critical
- Prioritize: core logic correctness, critical failure paths, external system integration
- **Don't** test trivial code (type-only exports, constants) or over-specify third-party library tests

## Example Commands

- Install: `pnpm install`
- Build all: `pnpm build`
- Frontend: `pnpm --filter client-ui dev` or `pnpm ui`
- Backend: `pnpm --filter @repo/express-api dev` or `pnpm api`
- Test: `pnpm test`
- Format: `pnpm format:fix` (run before commits)

## Out of Scope

**Do NOT:**

- Suggest switching core tooling without clear rationale.
- Generate secrets or credentials
- Remove TypeScript strictness
- Create junk tests or test trivial code

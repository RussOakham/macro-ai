# Cursor Rules for Macro AI Project

## Repository Overview

This is a **TypeScript monorepo** managed with **pnpm workspaces**. It contains:

- `apps/client-ui` — React + Vite application
- `apps/express-api` — Node + Express API server
- `packages/config-eslint` — Shared eslint config
- `packages/config-typescript` — Shared TypeScript configs
- `packages/macro-ai-api-client` — Shared API client and OpenAPI typings
- `infrastructure` — AWS CDK v2 infrastructure constructs

## Language & Technology Stack

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

## MCP Tool Usage (Core Principles)

- Always use MCP tools proactively instead of re-implementing functionality
- Maintain context across conversations through memory management
- Structure all complex work through Task Orchestrator
- Reference documentation for best practices before implementation
- Maintain security-first approach with regular Semgrep scans

### Memory Management Workflow

- Store context after completing tasks or making architectural decisions
- Create entities for project decisions, technical approaches, configuration details
- Start conversations by reading relevant memory to restore context

### Task Analysis Workflow

- Use sequential thinking to break down complex requests
- Create features/tasks in Task Orchestrator for multi-step work
- Apply appropriate templates for requirements, technical approach, testing strategies

### Documentation Reference Strategy

- Search AWS documentation for service-specific best practices
- Use Ref tool to find relevant code patterns and examples
- Validate implementations against official best practices

### Security Review Integration

- Run Semgrep scans after significant code changes
- Create security review tasks and document security decisions
- Scan new code before suggesting and flag potential issues proactively

## Triage Guidelines

**Prioritize direct evidence from CLI tools first** (source of truth), then use MCP servers for context:

1. **Check actual logs and runtime state (highest priority)**
   - Use CLI: `aws logs tail`, `aws ecs describe-tasks`, `gh run view`, `gh pr status`
   - Base conclusions on **real CLI outputs** before looking at code

2. **Review documentation proactively (secondary)**
   - Use `aws-documentation` MCP to confirm service behavior
   - Use `Ref` MCP to locate relevant code/docs in repo

3. **Static and runtime analysis (as needed)**
   - Use `semgrep` MCP for security/correctness scans
   - Use `puppeteer` MCP for automated frontend checks

4. **Contextual reasoning (supporting)**
   - Use `sequentialthinking` MCP for multi-step investigations
   - Use `memory` MCP to recall prior issues or context

5. **Avoid assumptions** — confirm findings against CLI logs before proposing fixes

## CLI Usage Guidelines

- **Always prefer CLI tools** (`aws`, `gh`) over MCP abstractions for investigations
- Craft queries for **fully formed output**
- Avoid open-ended results requiring manual input (pagers, truncated outputs)
- Prefer structured output formats (`--json`, `--output yaml`)
- Use `--no-cli-pager` or `--no-pager` for AWS CLI commands

## Documentation Standards

Documentation serves as a **living source of truth** for current state, not historical archive:

### Must Represent Current State

- **Product:** user discovery, feature requirements, market context, value proposition
- **Delivery:** roadmaps, integration plans, feature schedules, resourcing
- **Development:** current implementation, active codebase, API contracts, infrastructure state
- **Must NOT** include deprecated, legacy, or historical notes

## Task Management Approach

- Break large requests into **smaller, concrete tasks**
- Clarify: goal, scope, constraints before acting
- Use MCP tools for context gathering
- Prefer **minimal, working fixes** before broader refactors

## Response Guidelines

When asked to:

1. **Generate code** → Ensure it compiles, respects typing, follows conventions
2. **Modify code** → Provide full code blocks, not just diffs
3. **Explain structure** → Use correct package/app names
4. **Write docs/tests** → Follow existing repo style

## Example Commands

- Install: `pnpm install`
- Build all: `pnpm build`
- Frontend: `pnpm --filter client-ui dev` or `pnpm ui`
- Backend: `pnpm --filter @repo/express-api dev` or `pnpm api`
- Test: `pnpm test`
- Format: `pnpm format:fix` (run before commits)

## Out of Scope

**Do NOT:**

- Suggest switching core tooling without explicit request/clear benefit
- Generate secrets or credentials
- Remove TypeScript strictness
- Create junk tests or test trivial code

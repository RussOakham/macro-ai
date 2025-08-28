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

## CLI Reference

This document lists the main CLI tools used in the project, along with preferred shells to avoid common syntax issues.

<!-- markdownlint-disable MD056 MD013 MD038 -->
<!-- prettier-ignore-start -->
| Tool                    | Description                                                    | Preferred Shell | Notes / Syntax Tips                                                                                    |
|-------------------------|----------------------------------------------------------------|-----------------|--------------------------------------------------------------------------------------------------------|
| **pnpm**                | Fast, disk-efficient package manager for Node.js projects      | **bash**        | Works in PowerShell too, but some scripts with `&&` or `|` may behave differently.                     |
| **node**                | JavaScript runtime                                             | Both            | Use `node -v` to check version. `nvm` recommended to switch versions.                                  |
| **nvm**                 | Node Version Manager                                           | **bash**        | PowerShell support via `nvm-windows` differs; bash avoids subtle path issues.                          |
| **aws**                 | AWS CLI                                                        | **PowerShell**  | Use `aws configure` to set credentials. Bash can be used, but PowerShell avoids quoting/piping issues. |
| **session-manager-plugin** | AWS Systems Manager session plugin                          | **PowerShell**  | Required for `aws ssm start-session`. Works in bash, but path quoting is simpler in PowerShell.        |
| **gh**                  | GitHub CLI                                                     | **PowerShell**  | `gh auth login` and repo commands work cross-shell; PowerShell recommended for scripting.              |
| **git**                 | Version control                                                | Both            | Bash preferred for common Unix-style commands and scripts.                                             |
| **docker**              | Container engine                                               | Both            | Bash preferred for multi-command scripts and piping.                                                   |
| **docker-compose**      | Multi-container orchestration                                  | Both            | Works in PowerShell but beware of YAML quoting. Bash preferred for scripts.                            |
| **jq**                  | JSON processor                                                 | **bash**        | Syntax with quotes and escape characters can fail in PowerShell; bash avoids this.                     |
<!-- prettier-ignore-end -->
<!-- markdownlint-enable MD056 -->

**Shell Recommendations Summary:**

- Use **bash** when running scripts that include pipes (`|`), redirection (`>`), environment variables (`$VAR`), or
  complex quoting.
- Use **PowerShell** for AWS-related CLI commands (`aws`, `session-manager-plugin`) and GitHub CLI (`gh`) to avoid common
  syntax issues.
- **PowerShell** works for basic commands in other tools, but scripts may require adaptation.

---

## MCP Tools Quick Reference

These MCP servers are available to assist with context.  
⚠️ **CLI tools (`aws`, `gh`) always take priority** for investigation. MCP tools are **secondary** sources for documentation,
reasoning, or automation.

| MCP Tool               | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| **aws-documentation**  | Look up AWS service docs, API references, usage examples.            |
| **Ref**                | Search/open repo files and docs for direct code reference.           |
| **semgrep**            | Run static code analysis scans (security, correctness).              |
| **task-orchestrator**  | Run pre-defined orchestration tasks (automation, diagnostics).       |
| **puppeteer**          | Automate browser-based/frontend checks.                              |
| **sequentialthinking** | Help structure multi-step reasoning or plans.                        |
| **memory**             | Recall prior repo conversations, state, and context across sessions. |

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

When investigating issues, **prioritise direct evidence from CLI tools first** (they are the source of truth), then use
MCP servers for supporting context.

1. **Check actual logs and runtime state (highest priority)**
   - Use CLI tools such as:
     - `aws` (e.g., `aws logs tail`, `aws ecs describe-tasks`) for AWS infrastructure and service logs.
     - `gh` (e.g., `gh run view`, `gh pr status`) for GitHub workflows and PR information.
   - Always base conclusions on **real CLI outputs** before looking at code.

2. **Review documentation proactively (secondary)**
   - Use `aws-documentation` MCP to confirm service behaviour or API parameters.
   - Use `Ref` MCP to locate and open relevant code or documentation inside the repo.

3. **Static and runtime analysis (as needed)**
   - Use `semgrep` MCP for static code scans (security/correctness).
   - Use `puppeteer` MCP for automated frontend checks.

4. **Contextual reasoning (supporting)**
   - Use `sequentialthinking` MCP to structure multi-step investigations.
   - Use `memory` MCP to recall prior related issues or context.

5. **Avoid assumptions** — always confirm findings against CLI logs or outputs before proposing a fix.

---

## CLI Usage Guidelines

When using CLI commands during triage or investigation:

- **Always prefer CLI tools (`aws`, `gh`) over MCP abstractions** when investigating issues.
- Craft queries so they return a **fully formed output**.
- Avoid open-ended results that require manual input, such as:
  - Pagers (e.g., results that stop at `MORE` or `END`)
  - Table views or truncated outputs
- Prefer structured output formats (e.g., `--json`, `--output yaml`) where possible.

This ensures commands and results are **complete, reproducible, and authoritative**.

---

## Documentation Guidelines

Documentation within this repo should serve as a **living source of truth**. It is not a historical archive, but a reference for the product and code as it exists **now**.

### Documentation must represent

#### **Product** (the “why”)

- **User discovery**: personas, profiles, journey maps, key use cases
- **Feature requirements**: functional and non-functional needs
- **Market context**: competitor analysis, differentiators, positioning
- **Value proposition**: why the product exists, core problem being solved
- **Metrics & goals**: success criteria, KPIs, adoption targets

#### **Delivery** (the “when/how”)

- **Roadmaps**: short, medium, long-term priorities
- **Integration plans**: dependencies between services, sequencing of rollouts
- **Feature schedules**: timelines, releases, milestones
- **Resourcing**: roles, responsibilities, ownership mapping
- **Risks & mitigations**: blockers, external dependencies, contingency planning
- **Change management**: comms strategy for launches and updates

#### **Development** (the “what now”)

- **Source of truth** for the current implementation of the app
- Must **not** include deprecated, legacy, or historical notes (e.g. old migrations, abandoned approaches)
- Keep examples and references aligned with **the active codebase**, not historical artifacts
- **API & contracts**: definitive specs for APIs, schemas, protocols in use
- **Infrastructure state**: current infra definitions and IaC source (Terraform/CDK), not past revisions

---

## Task Management

- Break down large requests into **smaller, concrete tasks**.
- Clarify before acting:
  - The **goal** (e.g., “fix failing CI pipeline step”)
  - The **scope** (which package/app is affected)
  - The **constraints** (time, dependencies, environment)
- Use MCP tools to gather context:
  - `github-chat` and/or `gh` cli for repo activity & issues
  - `aws-documentation` for service reference
  - `Ref` for local code/doc lookups
- Prefer **minimal, working fixes** before suggesting broader refactors.

---

## Context Management (MCP-Aware)

- Combine repo knowledge with external context available via MCP servers.
- Use MCP tools for:
  - Documentation lookup (`aws-documentation`, `ref`)
  - Logs and runtime context (`github-chat`, `task-orchestrator`)
  - Code scanning (`semgrep`)
  - Step-by-step reasoning (`sequentialthinking`)
  - Cross-session continuity (`memory`)
- Prefer citing **real outputs** over assumptions.
- If missing context, **ask for it explicitly** rather than guessing.

---

## Testing Requirements

### Frontend (`apps/frontend`)

- **.tsx files:** Only unit test hooks.
- **.ts files:** Unit test all functionality.

### Backend (`apps/backend`)

- Unit test **everything** (business logic, API routes, services).

### Infrastructure (`packages/config`, IaC code, etc.)

- Unit test **everything** (schemas, utils, IaC helpers).

### General Rules

- Focus on **realistic and valuable cases**, not exhaustive permutations.
- Avoid contrived edge cases unless explicitly relevant to business logic.
- Prioritize:
  1. **Core logic correctness**
  2. **Critical failure paths**
  3. **Integration with external systems** (mocked where possible)

Do **not**:

- Generate redundant tests for trivial code (e.g., type-only exports, constants).
- Over-specify tests for third-party libraries — assume they are tested upstream.

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

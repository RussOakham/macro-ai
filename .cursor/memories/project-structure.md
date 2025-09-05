# Project Structure Memory

## Repository Overview

This is a **TypeScript monorepo** managed with **pnpm workspaces**. It contains:

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

## CLI Tools Available

The CLI tools available in the current shell for the macro-ai monorepo include:

- Node.js v20.14.0 (via nvm), pnpm v10.14.0, Turbo v2.5.6, TypeScript
- Redis CLI v8.2.1, PostgreSQL CLI v14.19, Drizzle Kit
- HTTPie, jq, bat, eza, fzf, git-delta, lazygit
- AWS CLI v2.28.3, AWS SAM CLI v1.143.0, AWS Session Manager Plugin v1.2.707.0, AWS Vault v7.6.1
- gh act for local GitHub Actions testing

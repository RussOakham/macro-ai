# Testing Requirements Memory

## Testing Framework

- Framework: Vitest
- Coverage: @vitest/coverage-v8
- Focus on realistic and valuable cases, avoiding exhaustive permutations and contrived edge cases

## Frontend Testing (`apps/client-ui`)

- **.tsx files:** Only unit test hooks
- **.ts files:** Unit test all functionality

## Backend Testing (`apps/express-api`)

- Unit test **everything** (business logic, API routes, services)

## Infrastructure & Packages Testing

- Unit test **everything** (schemas, utils, IaC helpers)

## General Testing Rules

- Focus on **realistic and valuable cases**, not exhaustive permutations
- Avoid contrived edge cases unless business-critical
- Prioritize: core logic correctness, critical failure paths, external system integration
- **Don't** test trivial code (type-only exports, constants) or over-specify third-party library tests
- All unit tests must align to the unit test rules defined in the project's CLAUDE.md file (no junk tests)

## Testing Tools

- Prefer using msw-auto-mock to create a Mock Service Worker (MSW) helper function compliant with
  OpenAPI spec for tests
- Use helper functions like server.listen(), server.resetHandlers(), etc.
- When fixing linting and type issues in integration test files, create mock types and casting to eliminate 'possibly undefined'
  issues
- Keep legitimate uses of `any` and disable eslint rule for specific lines when needed

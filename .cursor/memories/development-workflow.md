# Development Workflow Memory

## Code Quality & Formatting

- Always run `pnpm format:fix` in the repo root before committing code changes to ensure consistent formatting
- To lint the entire monorepo, run pnpm lint at the root instead of only in subdirectories
- Ensure linting and tests pass before progressing between tasks
- Use pnpm CLI instead of editing package.json directly when removing dependencies to catch any issues

## Commit Standards

- Follow conventional commits syntax when committing changes
- Use conventional commits format: `feat:`, `fix:`, `chore:`, etc.

## Code Style Preferences

- Prefer concise code fixes and brief explanations
- Use pino for frontend logging and pino-http for backend logging
- Prefer using pino instead of creating a custom general logger
- Update everything in the project to use Zod v4 where possible, rather than downgrading to Zod v3
- In the macro-ai-api-client project, prefer builds to output only ES modules and not support CommonJS

## Environment Configuration

- Don't extend NODE_ENV with custom values, use 'development' in CI environments
- Use AWS Parameter Store with environment-based prefixes:
  - Ephemeral PR environments use "/development/"
  - The develop branch uses "/staging/"
  - The main branch uses "/production/"
- Individual applications (client-ui, express-api) should run agnostically to their environment by
  preparing required runtime dependencies (e.g., generating a full .env file during CDK synthesis)
  prior to application start

## Documentation Standards

- Code and implementation documentation should describe the current state of the application and omit
  explanations of refactors or old application states
- Documentation should be a source of current truth, not transient
- Don't change code directly but only provide explanations when requested

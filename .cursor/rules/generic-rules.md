# Generic Development Rules

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

# Troubleshooting Memory

## Investigation Approach

- When triaging syntax issues, proactively check official documentation via MCP server access, such as
  aws-documentation and reference mcp servers
- Prioritize direct evidence from CLI tools first (source of truth), then use MCP servers for context
- Check actual logs and runtime state (highest priority) using CLI: `aws logs tail`, `aws ecs describe-tasks`,
  `gh run view`, `gh pr status`
- Base conclusions on **real CLI outputs** before looking at code
- Avoid assumptions — confirm findings against CLI logs before proposing fixes

## CLI Usage Guidelines

- Always prefer CLI tools (`aws`, `gh`) over MCP abstractions for investigations
- Craft queries for **fully formed output**
- Avoid open-ended results requiring manual input (pagers, truncated outputs)
- Prefer structured output formats (`--json`, `--output yaml`)
- Use `--no-cli-pager` or `--no-pager` for AWS CLI commands

## Project-Specific Tools

- Use pnpm for commands instead of npm, unless testing remote infrastructure which runs npm
- The knip configuration should ignore generated files and folders from the hey-api project

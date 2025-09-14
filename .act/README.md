# Act Configuration for macro-ai

This directory contains configuration files for testing GitHub Actions workflows locally using `act`.

## Files

- `.act/actrc` - Main act configuration
- `.act/secrets` - **Real secrets for local testing** (gitignored)
- `.act/secrets.example` - Example file with dummy credentials
- `.act/event.json` - GitHub event context for PR testing
- `.act/workflows/` - Workflow-specific configurations

## Quick Setup

1. **Copy the example secrets file**:

   ```bash
   cp .act/secrets.example .act/secrets
   ```

2. **Add your real credentials** to `.act/secrets`:

   ```bash
   # Get AWS credentials
   aws configure get aws_access_key_id
   aws configure get aws_secret_access_key
   aws configure get region

   # Get GitHub token
   gh auth token
   ```

3. **Test a simple workflow**:

   ```bash
   act -W .github/workflows/test-local.yml --platform ubuntu-latest=node:20-slim
   ```

4. **Test specific jobs**:

   ```bash
   act -W .github/workflows/hygiene-checks.yml --secret-file .act/secrets -j "lint-md"
   act -W .github/workflows/hygiene-checks.yml --secret-file .act/secrets -j "actionlint"
   act -W .github/workflows/hygiene-checks.yml --secret-file .act/secrets -j "setup"
   ```

## Stateful Authentication

The workflows are now **environment-aware** and automatically detect whether they're running in:

- **act (local)**: Uses direct AWS credentials from `.act/secrets`
- **GitHub Actions (remote)**: Uses IAM role assumption with OIDC

No manual configuration needed - the workflow automatically chooses the right authentication method!

## Working Commands

### Test Individual Jobs

```bash
# List available jobs
act -W .github/workflows/hygiene-checks.yml --list

# Test markdown linting
act -W .github/workflows/hygiene-checks.yml --secret-file .act/secrets -j "lint-md"

# Test actionlint
act -W .github/workflows/hygiene-checks.yml --secret-file .act/secrets -j "actionlint"

# Test with AWS credentials (stateful authentication)
act -W .github/workflows/hygiene-checks.yml --secret-file .act/secrets -j "setup"
```

### Test Complete Workflows

```bash
# Test simple workflow
act -W .github/workflows/test-local.yml --platform ubuntu-latest=node:20-slim

# Test with specific platform
act -W .github/workflows/hygiene-checks.yml --secret-file .act/secrets --platform ubuntu-latest=node:20-slim
```

## Common Issues & Solutions

### 1. Docker Authentication

If you get "unauthorized" errors:

```bash
docker logout
docker system prune -f
```

### 2. Platform Mismatch

For M-series Macs, use the correct platform:

```bash
act -W .github/workflows/test-local.yml --platform ubuntu-latest=node:20-slim --container-architecture linux/amd64
```

### 3. Missing Dependencies

Some workflows need specific tools. Use pre-built images:

```bash
# Use Node.js image for workflows that need Node
act -W .github/workflows/test-local.yml --platform ubuntu-latest=node:20-slim
```

## Recommended Testing Strategy

1. **Start with simple workflows** (like `test-local.yml`)
2. **Test individual jobs** from complex workflows
3. **Use real credentials** for AWS-dependent workflows
4. **Mock external services** for CI/CD workflows

## Environment Variables

The `.act/actrc` file sets up common environment variables:

- `NODE_ENV=development`
- `CI=true`
- `GITHUB_ACTIONS=true`
- Mock AWS credentials
- Mock GitHub context

## Parallel Job Execution

The hygiene checks workflow has been optimized for parallel execution. Jobs are organized into two stages:

### Job Dependencies

**Stage 1** (No dependencies - run in parallel):

- `lint-md` - Markdown linting
- `actionlint` - GitHub Actions validation
- `gitleaks` - Secret scanning

**Stage 2** (Depends on setup - run in parallel after setup):

- `setup` - Environment setup
- `build` - Build all packages
- `lint` - Code linting
- `test` - Run test suites

### Quick Commands

Use the provided scripts for fast parallel execution:

```bash
# Run complete workflow (all jobs with proper dependencies)
./.act/run-fast.sh all

# Run only fast jobs (Stage 1 only)
./.act/run-fast.sh fast

# Run dependent jobs only (Stage 2, assumes setup is done)
./.act/run-fast.sh dependent

# Run a single job
./.act/run-fast.sh single setup
```

### Advanced Parallel Control

For more control, use the full parallel runner:

```bash
# Run specific jobs in parallel
./.act/run-parallel.sh jobs "lint-md,actionlint,gitleaks"

# Run all jobs with dependency management
./.act/run-parallel.sh all

# List all available jobs
./.act/run-parallel.sh list
```

### Performance Benefits

- **Stage 1 jobs**: Run simultaneously in separate containers
- **Stage 2 jobs**: Run simultaneously after setup completes
- **Container reuse**: Jobs with same image share containers when possible
- **Resource optimization**: Parallel execution reduces total workflow time

## Troubleshooting

- **Docker issues**: Restart Docker Desktop
- **Permission issues**: Check Docker daemon permissions
- **Network issues**: Use `--network host` flag
- **Memory issues**: Increase Docker memory limits

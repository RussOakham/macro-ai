# Security Scanning Cheatsheet

Quick reference for GitHub Actions security scanning commands.

## 🚀 Quick Start

```bash
# Install all security tools
./scripts/install-security-tools.sh

# Run all security scans
pnpm security:scan:codeql
```

## 📋 Available Commands

### Basic Scans

```bash
pnpm security:scan              # Basic security scan (actionlint + gitleaks)
pnpm security:scan:workflows    # Actionlint validation only
pnpm security:scan:secrets      # Gitleaks secret scanning only
```

### Advanced Scans

```bash
pnpm security:scan:advanced     # Comprehensive security analysis
pnpm security:scan:codeql       # CodeQL deep security analysis
pnpm security:scan:octoscan     # Octoscan vulnerability scanner
pnpm security:scan:act          # Act local workflow testing
```

## 🛠️ Individual Tools

### Actionlint

```bash
# Basic validation
actionlint

# With specific rules
actionlint -shellcheck=error -pyflakes=error

# Scan specific file
actionlint .github/workflows/my-workflow.yml
```

### Gitleaks

```bash
# Scan workflows only
gitleaks detect --source .github/workflows/ --config .gitleaks.toml

# Scan entire repository
gitleaks detect --source . --config .gitleaks.toml

# Verbose output
gitleaks detect --source . --config .gitleaks.toml --verbose
```

### CodeQL CLI

```bash
# Create database
codeql database create codeql-db --language=actions --source-root=.

# Analyze database
codeql database analyze codeql-db --format=sarif-latest --output=results.sarif

# View results
codeql bqrs interpret codeql-db/results/codeql/actions/Query.ql.bqrs
```

### Octoscan

```bash
# Scan workflows
octoscan scan --path .github/workflows/

# Scan with specific output
octoscan scan --path .github/workflows/ --output json
```

### Act (Local Testing)

```bash
# List workflows
act --list

# Dry run
act --dry-run

# Run specific job
act --job hygiene-checks

# Run with specific event
act push
```

## 🔧 Installation Commands

### macOS (Homebrew)

```bash
# Core tools
brew install actionlint gitleaks act gh

# Go (for Octoscan)
brew install go
go install github.com/synacktiv/octoscan@latest

# CodeQL CLI
curl -L -o codeql.zip https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-osx64.zip
unzip codeql.zip
export PATH="$PWD/codeql:$PATH"
```

### Linux

```bash
# Core tools
sudo apt-get install actionlint gitleaks act gh

# Go (for Octoscan)
sudo apt-get install golang-go
go install github.com/synacktiv/octoscan@latest

# CodeQL CLI
curl -L -o codeql.zip https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-linux64.zip
unzip codeql.zip
export PATH="$PWD/codeql:$PATH"
```

## 📊 Understanding Results

### Actionlint Output

- ✅ **No issues found** - Workflow is valid
- ❌ **Syntax errors** - Fix YAML syntax issues
- ⚠️ **Warnings** - Review and fix if needed

### Gitleaks Output

- ✅ **No secrets found** - No sensitive data detected
- ❌ **Secrets found** - Review and remove hardcoded secrets
- ⚠️ **False positives** - Add patterns to `.gitleaks.toml` allowlist

### CodeQL Output

- ✅ **No issues found** - No security vulnerabilities detected
- ❌ **Vulnerabilities found** - Review SARIF results and fix issues
- 📄 **SARIF file** - Detailed results in `codeql-results.sarif`

### Octoscan Output

- ✅ **No issues found** - No vulnerabilities detected
- ❌ **Vulnerabilities found** - Review and fix security issues
- ⚠️ **Warnings** - Review potential security concerns

## 🚨 Common Issues & Solutions

### "command not found" errors

```bash
# Check if tool is installed
which actionlint
which gitleaks
which codeql

# Install missing tools
./scripts/install-security-tools.sh
```

### Permission denied

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix ownership
sudo chown -R $(whoami) scripts/
```

### CodeQL database creation fails

```bash
# Check disk space
df -h

# Clean up old databases
rm -rf codeql-db

# Ensure workflows exist
ls -la .github/workflows/
```

### Gitleaks false positives

```bash
# Add to .gitleaks.toml allowlist
[allowlist]
regexes = [
    "^test-.*$",
    "^mock-.*$",
    "^dummy-.*$"
]
```

## 🔄 Pre-commit Integration

Security scans run automatically when committing workflow files:

```bash
git add .github/workflows/my-workflow.yml
git commit -m "Add new workflow"
# Security scans run automatically
```

To skip pre-commit hooks (not recommended):

```bash
git commit --no-verify -m "Skip security checks"
```

## 📈 Performance Tips

### Fast Scans

```bash
# Quick validation (fastest)
pnpm security:scan:workflows

# Basic security scan (fast)
pnpm security:scan
```

### Comprehensive Scans

```bash
# Full analysis (slower but thorough)
pnpm security:scan:codeql

# Advanced analysis (comprehensive)
pnpm security:scan:advanced
```

### Parallel Scanning

```bash
# Run multiple scans in parallel
pnpm security:scan:workflows &
pnpm security:scan:secrets &
wait
```

## 🎯 Workflow-Specific Scanning

### Scan Single Workflow

```bash
actionlint .github/workflows/hygiene-checks.yml
gitleaks detect --source .github/workflows/hygiene-checks.yml --config .gitleaks.toml
```

### Scan Modified Workflows

```bash
# Get modified workflow files
git diff --name-only HEAD~1 | grep '\.github/workflows/.*\.ya\?ml$' | xargs actionlint
```

### Scan All Workflows

```bash
find .github/workflows -name "*.yml" -o -name "*.yaml" | xargs actionlint
```

## 📝 Report Generation

### JSON Reports

```bash
# Generate security report
pnpm security:scan:advanced
# Output: security-scan-report.json

# Generate CodeQL report
pnpm security:scan:codeql
# Output: codeql-security-report.json
```

### SARIF Reports

```bash
# CodeQL SARIF output
codeql database analyze codeql-db --format=sarif-latest --output=results.sarif
```

## 🔍 Debugging

### Verbose Output

```bash
# Actionlint with verbose output
actionlint -verbose

# Gitleaks with verbose output
gitleaks detect --source . --config .gitleaks.toml --verbose

# Act with debug output
act --debug
```

### Check Tool Versions

```bash
actionlint -version
gitleaks version
codeql version
act --version
```

### Test Individual Tools

```bash
# Test actionlint
echo "name: test" | actionlint

# Test gitleaks
echo "password=secret123" | gitleaks detect --stdin

# Test CodeQL
codeql resolve languages
```

## 📚 Additional Resources

- [GitHub Actions Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Actionlint Documentation](https://github.com/rhysd/actionlint)
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [Octoscan Documentation](https://github.com/synacktiv/octoscan)
- [Act Documentation](https://github.com/nektos/act)

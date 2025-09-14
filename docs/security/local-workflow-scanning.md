# Local GitHub Actions Security Scanning

This guide covers how to scan your GitHub Actions workflows for security issues locally before committing, using modern
security tools and established npm libraries.

> **Note**: This document describes the legacy approach. For the modern security scanning setup, see [Modern Security Scanning](./modern-security-scanning.md).

## Overview

We provide multiple levels of security scanning for GitHub Actions workflows:

1. **Basic Security Scan** - Quick validation with actionlint and gitleaks
2. **Advanced Security Scan** - Comprehensive analysis with multiple tools
3. **CodeQL Security Scan** - Deep analysis using GitHub's CodeQL CLI
4. **Individual Tool Scans** - Run specific tools independently

## Modern Security Scanning

**Recommended**: Use the modern security scanning approach with Snyk, ESLint security plugins, and Semgrep:

```bash
# Modern security scanning
pnpm security:scan              # Basic security scan
pnpm security:scan:advanced     # Advanced security scan
pnpm security:scan:workflows    # Workflow validation
```

See [Modern Security Scanning](./modern-security-scanning.md) for complete documentation.

## Quick Start

### 1. Install Security Tools

```bash
# Install all security tools
./scripts/install-security-tools.sh

# Or install individually
pnpm security:scan:workflows  # actionlint
pnpm security:scan:secrets    # gitleaks
pnpm security:scan:octoscan   # octoscan
pnpm security:scan:codeql     # CodeQL CLI
```

### 2. Run Security Scans

```bash
# Basic security scan (recommended for pre-commit)
pnpm security:scan

# Advanced security scan (comprehensive analysis)
pnpm security:scan:advanced

# CodeQL security scan (deep analysis)
pnpm security:scan:codeql
```

## Available Tools

### Core Security Tools

| Tool           | Purpose                            | Command                        |
| -------------- | ---------------------------------- | ------------------------------ |
| **actionlint** | GitHub Actions workflow validation | `pnpm security:scan:workflows` |
| **gitleaks**   | Secret scanning                    | `pnpm security:scan:secrets`   |
| **CodeQL CLI** | Deep security analysis             | `pnpm security:scan:codeql`    |
| **Octoscan**   | Static vulnerability scanner       | `pnpm security:scan:octoscan`  |
| **Act**        | Local workflow testing             | `pnpm security:scan:act`       |

### Additional Tools

| Tool             | Purpose                         | Installation            |
| ---------------- | ------------------------------- | ----------------------- |
| **Snyk Scanner** | GitHub Actions security scanner | Included in CodeQL scan |
| **Semgrep**      | Additional security scanning    | `brew install semgrep`  |
| **Trivy**        | Vulnerability scanning          | `brew install trivy`    |

## Detailed Usage

### 1. GitHub CodeQL CLI

The CodeQL CLI provides the most comprehensive security analysis for GitHub Actions workflows.

```bash
# Run CodeQL analysis
pnpm security:scan:codeql

# Manual CodeQL usage
codeql database create codeql-db --language=actions --source-root=.
codeql database analyze codeql-db --format=sarif-latest --output=results.sarif
```

**What CodeQL checks:**

- Security vulnerabilities in workflow logic
- Dangerous action usage patterns
- Expression injection vulnerabilities
- Permission escalation issues
- Secret exposure risks

### 2. Actionlint

Validates GitHub Actions workflow syntax and best practices.

```bash
# Basic validation
pnpm security:scan:workflows

# With specific rules
actionlint -shellcheck=error -pyflakes=error
```

**What actionlint checks:**

- Workflow syntax errors
- Shell script issues
- Python script issues
- Action version validation
- Best practice violations

### 3. Gitleaks

Scans for hardcoded secrets and sensitive information.

```bash
# Scan workflows for secrets
pnpm security:scan:secrets

# Scan entire repository
gitleaks detect --source . --config .gitleaks.toml
```

**What gitleaks checks:**

- API keys and tokens
- Database credentials
- Encryption keys
- AWS credentials
- Other sensitive data

### 4. Octoscan

Static vulnerability scanner specifically for GitHub Actions.

```bash
# Scan workflows
pnpm security:scan:octoscan

# Manual usage
octoscan scan --path .github/workflows/
```

**What Octoscan checks:**

- Dangerous action usage
- Expression injection vulnerabilities
- Known security issues
- Misconfiguration patterns

### 5. Act (Local Testing)

Test your workflows locally before committing.

```bash
# List available workflows
pnpm security:scan:act

# Run specific workflow
act --dry-run --job hygiene-checks

# Run with specific event
act push
```

## Pre-commit Integration

Security scans are automatically run on workflow files before commit:

```bash
# The pre-commit hook will automatically run security scans
git add .github/workflows/my-workflow.yml
git commit -m "Add new workflow"
# Security scans run automatically
```

## Configuration

### Gitleaks Configuration

The `.gitleaks.toml` file is already configured to ignore test fixtures while scanning for real secrets.

### Actionlint Configuration

Actionlint uses default rules but can be customized with:

- `-shellcheck=error` - Enable shell script checking
- `-pyflakes=error` - Enable Python script checking
- `-color` - Enable colored output

### CodeQL Configuration

CodeQL automatically detects GitHub Actions workflows and applies security queries. No additional configuration needed.

## Security Report Generation

All scans generate detailed reports:

- **Basic scan**: Console output only
- **Advanced scan**: `security-scan-report.json`
- **CodeQL scan**: `codeql-results.sarif` + `codeql-security-report.json`

### SARIF Results

CodeQL generates SARIF (Static Analysis Results Interchange Format) files that can be viewed in:

- VS Code with SARIF extension
- GitHub Security tab
- SARIF viewers online

## Troubleshooting

### Common Issues

1. **CodeQL CLI not found**

   ```bash
   # Add CodeQL to PATH
   export PATH="$HOME/.codeql/codeql:$PATH"
   ```

2. **Go not installed (for Octoscan)**

   ```bash
   brew install go
   go install github.com/synacktiv/octoscan@latest
   ```

3. **Permission denied on scripts**

   ```bash
   chmod +x scripts/*.sh
   ```

### Tool-Specific Issues

**Actionlint:**

- Ensure workflows are valid YAML
- Check for syntax errors in shell scripts

**Gitleaks:**

- Review `.gitleaks.toml` for false positives
- Add test patterns to allowlist if needed

**CodeQL:**

- Ensure workflows are in `.github/workflows/`
- Check for sufficient disk space for database

**Octoscan:**

- Ensure Go is installed and in PATH
- Check for network connectivity for updates

## Best Practices

### 1. Regular Scanning

- Run security scans before every commit
- Schedule regular comprehensive scans
- Review and address findings promptly

### 2. Workflow Security

- Use latest action versions
- Minimize permissions
- Avoid hardcoded secrets
- Use GitHub secrets and variables

### 3. Secret Management

- Never commit secrets to repository
- Use GitHub secrets for sensitive data
- Rotate secrets regularly
- Monitor for secret exposure

### 4. Code Review

- Review security scan results
- Understand false positives
- Document security decisions
- Keep security tools updated

## Integration with CI/CD

The same security tools are used in your CI/CD pipeline:

- **actionlint** - Validates workflows in `hygiene-checks.yml`
- **gitleaks** - Scans for secrets in `hygiene-checks.yml`
- **CodeQL** - Can be added to workflows for continuous analysis

## Advanced Usage

### Custom Security Rules

You can extend the security scanning with custom rules:

```javascript
// In security-scan.js
const customRules = [
	{
		name: 'Custom Rule',
		pattern: /your-pattern/g,
		severity: 'high',
		message: 'Your custom message',
	},
]
```

### Integration with IDEs

Configure your IDE to run security scans:

**VS Code:**

```json
{
	"tasks": {
		"security-scan": {
			"command": "pnpm",
			"args": ["security:scan"],
			"group": "build"
		}
	}
}
```

**IntelliJ/WebStorm:**

- Add npm script as external tool
- Configure file watchers for workflow changes

## Support

For issues with security scanning:

1. Check tool-specific documentation
2. Review error messages and logs
3. Ensure all dependencies are installed
4. Verify file permissions and paths

## References

- [GitHub CodeQL Documentation](https://codeql.github.com/docs/)
- [Actionlint Documentation](https://github.com/rhysd/actionlint)
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [Octoscan Documentation](https://github.com/synacktiv/octoscan)
- [Act Documentation](https://github.com/nektos/act)

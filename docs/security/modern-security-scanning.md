# Modern Security Scanning

This document describes the modern security scanning approach using established npm libraries and GitHub Actions,
replacing the previous custom security scripts.

## Prerequisites

### Snyk Authentication Required

Before using Snyk-based security scripts, you need to:

1. **Create a free Snyk account** at <https://snyk.io>
2. **Get your API token** from your account settings
3. **Authenticate locally**:

   ```bash
   snyk auth
   ```

**Note**: Snyk CLI is installed globally and ready to use.

### Actionlint Installation Required

For GitHub Actions workflow validation, install actionlint:

**Windows:**

```bash
winget install actionlint
```

**macOS:**

```bash
brew install actionlint
```

**Linux:**

```bash
# Arch Linux
pacman -S actionlint

# Or download from releases page
curl -sSL https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_linux_amd64.tar.gz | tar -xz -C /usr/local/bin
```

**Alternative: Use ESLint Security Scanning Only**

If you prefer not to use Snyk or actionlint, you can use ESLint security scanning which works without authentication:

```bash
# Run ESLint security scan (no authentication required)
pnpm lint:eslint
```

## Overview

We've migrated from custom security scripts to industry-standard tools that integrate seamlessly with our CI/CD pipeline:

- **Snyk**: Comprehensive vulnerability scanning for dependencies and code
- **ESLint Security Plugins**: Static analysis for security issues
- **Semgrep**: Advanced static analysis via GitHub Actions
- **Actionlint**: GitHub Actions workflow validation
- **Gitleaks**: Secret scanning

## Available Security Scripts

### Basic Security Scanning

```bash
# Run comprehensive security scan (Snyk + ESLint)
pnpm security:scan

# Run advanced security scan (Snyk + ESLint + additional checks)
pnpm security:scan:advanced

# Run dependency vulnerability scan only
pnpm security:scan:deps

# Run code security scan only
pnpm security:scan:code

# Run secret scanning
pnpm security:scan:secrets

# Monitor project with Snyk
pnpm security:scan:monitor
```

### Workflow-Specific Scanning

```bash
# Validate GitHub Actions workflows
pnpm security:scan:workflows
```

### Legacy Scripts (Deprecated)

```bash
# Legacy custom scripts (will be removed)
pnpm security:scan:legacy
pnpm security:scan:legacy:advanced
pnpm security:scan:legacy:codeql
```

## Configuration Files

### Snyk Configuration (`.snyk`)

The `.snyk` file configures vulnerability scanning:

```yaml
# Snyk policy file
version: v1.25.0

# Language settings
language-settings:
  javascript:
    dev-dependencies: true
  typescript:
    dev-dependencies: true

# Severity threshold
severity-threshold: high

# Exclude paths
exclude:
  - '**/node_modules/**'
  - '**/dist/**'
  - '**/build/**'
  - '**/coverage/**'
```

### Semgrep Configuration (`.semgrep.yml`)

The `.semgrep.yml` file configures static analysis rules:

```yaml
# Semgrep configuration for security scanning
rules:
  - id: github-actions-security
    languages: [yaml]
    message: 'GitHub Actions security rule'
    severity: ERROR
    patterns:
      - pattern: |
          uses: actions/checkout@v1
        message: 'Use actions/checkout@v4 or later for security fixes'
```

## CI/CD Integration

### GitHub Actions Workflows

Security scanning is integrated into multiple workflows:

1. **Hygiene Checks** (`.github/workflows/hygiene-checks.yml`)
   - ESLint security scanning
   - Snyk vulnerability scanning
   - Semgrep static analysis
   - Dependency audit

2. **Dedicated Security Scan** (`.github/workflows/security-scan.yml`)
   - Comprehensive security analysis
   - Daily scheduled scans
   - SARIF report generation

### Pre-Push Hooks

The pre-push hook (`.husky/pre-push`) automatically runs security scans:

- **For workflow changes**: Full security scan + workflow validation
- **For other changes**: Basic dependency security scan

## Security Tools

### Snyk

**Purpose**: Vulnerability scanning for dependencies and code

**Features**:

- Dependency vulnerability scanning
- Code security analysis
- License compliance checking
- Fix recommendations

**Usage**:

```bash
# Test for vulnerabilities
pnpm security:scan:deps

# Scan code for security issues
pnpm security:scan:code

# Monitor project
pnpm security:scan:monitor
```

### ESLint Security Plugins

**Purpose**: Static analysis for security issues in code

**Plugins Used**:

- `eslint-plugin-security`: General security rules
- `eslint-plugin-security-node`: Node.js specific security rules
- `eslint-plugin-no-secrets`: Secret detection
- `eslint-plugin-sonarjs`: Code quality and security

**Usage**:

```bash
# Run ESLint with security plugins
pnpm lint:eslint
```

### Semgrep

**Purpose**: Advanced static analysis for security vulnerabilities

**Features**:

- OWASP Top 10 detection
- Language-specific security rules
- Custom rule support
- SARIF report generation

**Integration**: Runs automatically in GitHub Actions

### Actionlint

**Purpose**: GitHub Actions workflow validation

**Features**:

- Workflow syntax validation
- Security best practices
- Action version checking

**Usage**:

```bash
# Validate workflows
pnpm security:scan:workflows
```

### Gitleaks

**Purpose**: Secret scanning in code and history

**Features**:

- Secret pattern detection
- Git history scanning
- Custom configuration support

**Integration**: Runs automatically in GitHub Actions

## Migration Benefits

### Advantages of New Approach

1. **Maintenance**: No custom script maintenance required
2. **Updates**: Automatic security rule updates
3. **Community**: Large community support and documentation
4. **Integration**: Better CI/CD platform integration
5. **Standards**: Industry-standard tools and outputs
6. **Performance**: Optimized scanning performance

### Replaced Functionality

| Custom Script               | Modern Replacement          |
| --------------------------- | --------------------------- |
| `security-scan.js`          | Snyk + ESLint               |
| `advanced-security-scan.js` | Snyk + ESLint + Semgrep     |
| `codeql-security-scan.js`   | Semgrep + CodeQL Actions    |
| `install-security-tools.sh` | npm/pnpm package management |

## Setup Instructions

### 1. Install Dependencies

```bash
# Install security tools
pnpm install
```

### 2. Configure Snyk

```bash
# Authenticate with Snyk (optional)
npx snyk auth
```

### 3. Run Security Scans

```bash
# Basic security scan
pnpm security:scan

# Advanced security scan
pnpm security:scan:advanced
```

## Troubleshooting

### Common Issues

1. **Snyk Authentication**: Ensure `SNYK_TOKEN` is set in GitHub Secrets
2. **ESLint Errors**: Check ESLint configuration and plugin versions
3. **Semgrep Failures**: Verify GitHub Actions permissions for security events

### Getting Help

- **Snyk**: [Documentation](https://docs.snyk.io/)
- **ESLint Security**: [Plugin Documentation](https://github.com/eslint-community/eslint-plugin-security)
- **Semgrep**: [Documentation](https://semgrep.dev/docs/)
- **Actionlint**: [Documentation](https://github.com/rhysd/actionlint)

## Future Enhancements

1. **Custom Semgrep Rules**: Add project-specific security rules
2. **Security Dashboard**: Integrate with security monitoring tools
3. **Automated Fixes**: Implement automatic vulnerability fixes where safe
4. **Compliance Reporting**: Add compliance reporting capabilities

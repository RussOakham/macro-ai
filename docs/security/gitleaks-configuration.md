# Gitleaks Configuration

This document explains the gitleaks secret scanning configuration for the Macro AI repository.

## Overview

Gitleaks is a secret scanning tool that detects hardcoded secrets, API keys, and other sensitive information in code
repositories. Our configuration includes comprehensive allowlisting for test fixtures and mock data to prevent false
positives while maintaining security scanning for actual secrets.

## Configuration File

The main configuration file is located at `.gitleaks.toml` in the repository root.

## Key Features

### 1. Test Fixture Allowlisting

- **Test API Keys**: `test-api-key*`, `sk-test*`, `test-openai-key`
- **Test Encryption Keys**: `test-encryption-key*`, `test-cookie-encryption-key*`
- **Test AWS Keys**: `test-pool-secret-key*`, `test-access-key`, `test-secret-key`
- **Test Database URLs**: `dummy-url`, `localhost` patterns
- **Test Configuration Values**: Rate limits, ports, domains used in testing

### 2. File Path Allowlisting

- All `*.test.ts`, `*.test.tsx`, `*.test.js`, `*.test.jsx` files
- `__tests__/` directories
- `test/` and `tests/` directories
- `test-helpers/` directories
- Test-related script files

### 3. Content Pattern Allowlisting

- Test environment setup patterns
- Mock configuration patterns
- Test-specific variable assignments

### 4. Branch and Commit Allowlisting

- Test and development branches
- Test-related commit messages

## CI Integration

The gitleaks scanning is integrated into the GitHub Actions workflow at `.github/workflows/hygiene-checks.yml`.

### Job Configuration

```yaml
gitleaks:
  name: Secret Scanning (Gitleaks)
  runs-on: ubuntu-latest
  permissions:
    contents: read
    security-events: write
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0 # Required for gitleaks to scan commit history

    - name: Run Gitleaks
      uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        config-path: .gitleaks.toml
        report-format: sarif
        exit-code: 1
        verbose: true
```

## Local Usage

### Install Gitleaks

```bash
# macOS
brew install gitleaks

# Windows
scoop install gitleaks

# Linux
curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/install.sh | sh -s -- -b /usr/local/bin
```

### Run Local Scan

```bash
# Scan current repository
gitleaks detect --config .gitleaks.toml --verbose

# Scan specific directory
gitleaks detect --config .gitleaks.toml --path ./apps/express-api

# Scan with report output
gitleaks detect --config .gitleaks.toml --report-format json --report-path gitleaks-report.json
```

## Adding New Test Patterns

When adding new test fixtures or mock data, update the `.gitleaks.toml` file to include the new patterns:

1. **Identify the pattern**: Look for the specific format of your test data
2. **Add to appropriate allowlist section**: Choose the most relevant section (regex, paths, etc.)
3. **Test locally**: Run `gitleaks detect --config .gitleaks.toml` to verify
4. **Commit changes**: Include the gitleaks config update in your PR

### Example: Adding New Test API Key Pattern

```toml
[[allowlist]]
description = "Test API keys and test patterns"
regex = [
    # ... existing patterns ...
    "^my-new-test-pattern-.*$",  # Add your new pattern here
]
```

## Security Considerations

### What Gets Allowlisted

- **Test fixtures**: Mock data used only in tests
- **Development configurations**: Non-production environment settings
- **Example values**: Sample data for documentation

### What Does NOT Get Allowlisted

- **Real API keys**: Even if they're in test files
- **Production secrets**: Any actual production credentials
- **Sensitive data**: Real user data, passwords, or tokens

### Best Practices

1. **Use descriptive prefixes**: Always prefix test data with `test-`, `mock-`, `fake-`, or `dummy-`
2. **Keep patterns specific**: Avoid overly broad allowlist patterns
3. **Regular review**: Periodically review allowlist patterns for security
4. **Document changes**: Update this document when modifying allowlist rules

## Troubleshooting

### Common Issues

#### False Positives Still Occurring

1. **Check pattern matching**: Ensure your test data matches the allowlist patterns exactly
2. **Verify file paths**: Make sure test files are in allowlisted directories
3. **Check regex syntax**: Ensure allowlist regex patterns are correct

#### Build Failures

1. **Review gitleaks output**: Check the detailed scan results
2. **Update allowlist**: Add missing patterns to `.gitleaks.toml`
3. **Test locally**: Verify changes work before committing

#### Performance Issues

1. **Reduce scan scope**: Use `--path` to limit scanning to specific directories
2. **Optimize patterns**: Ensure regex patterns are efficient
3. **Use caching**: Gitleaks caches results between runs

### Debug Mode

Enable verbose output for detailed debugging:

```bash
gitleaks detect --config .gitleaks.toml --verbose --debug
```

## Resources

- [Gitleaks Documentation](https://gitleaks.io/)
- [GitHub Actions Integration](https://github.com/gitleaks/gitleaks-action)
- [TOML Configuration Reference](https://toml.io/en/)
- [Regular Expression Testing](https://regex101.com/)

## Support

For issues with gitleaks configuration:

1. Check the [gitleaks issues](https://github.com/gitleaks/gitleaks/issues)
2. Review the [GitHub Actions logs](https://docs.github.com/en/actions/monitoring-and-logging)
3. Test locally with the same configuration
4. Update this documentation with solutions found

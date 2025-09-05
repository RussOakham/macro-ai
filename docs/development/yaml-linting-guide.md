# YAML Linting Guide

This guide covers the YAML linting tools and configurations available in this project.

## Overview

We have set up comprehensive YAML linting using both npm-based tools and CLI tools to ensure consistent YAML formatting
and catch syntax errors early.

## Available Tools

### npm-based Tools (Installed)

1. **js-yaml** - JavaScript YAML parser with validation
2. **yaml-lint** - Lightweight YAML linter
3. **Custom YAML Linter** - Our custom script with comprehensive checks

### CLI Tools (External Installation Required)

1. **yamllint** - Python-based YAML linter (most popular)
2. **yamale** - Python-based YAML schema validator
3. **yq** - Go-based YAML processor with validation

## npm Scripts

The following scripts are available in the root `package.json`:

```bash
# Custom comprehensive YAML linter (recommended)
pnpm lint:yaml:js

# Basic yaml-lint tool
pnpm lint:yaml

# Fix YAML formatting issues (if supported)
pnpm lint:yaml:fix
```

## Configuration Files

### 1. `.yamllint` (for yamllint CLI tool)

Located in the project root, this file configures the yamllint tool with:

- 2-space indentation
- 120 character line length limit
- Consistent quote style
- Trailing space detection
- Empty line limits

### 2. `yaml-lint.config.js` (for yaml-lint npm tool)

Located in the project root, this file configures the yaml-lint tool with:

- File patterns to lint
- Ignore patterns for generated files
- YAML parser options
- Validation rules

### 3. `scripts/yaml-lint.js` (Custom linter)

Our custom YAML linter that provides:

- Comprehensive syntax validation
- Line length checking
- Indentation consistency
- Trailing space detection
- Empty line validation
- Duplicate key detection
- Newline at end of file checking

## CLI Tool Installation

### yamllint (Recommended)

**Windows (using pip):**

```bash
pip install yamllint
```

**macOS (using Homebrew):**

```bash
brew install yamllint
```

**Linux (using apt):**

```bash
sudo apt install yamllint
```

**Usage:**

```bash
# Lint all YAML files
yamllint .

# Lint specific files
yamllint docker-compose.yml apps/client-ui/amplify.yml

# Lint with custom config
yamllint -c .yamllint .
```

### yamale (Schema Validation)

**Installation:**

```bash
pip install yamale
```

**Usage:**

```bash
# Validate YAML against schema
yamale -s schema.yaml data.yaml
```

### yq (YAML Processor)

**Windows (using Chocolatey):**

```bash
choco install yq
```

**macOS (using Homebrew):**

```bash
brew install yq
```

**Linux:**

```bash
# Download from GitHub releases
wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq
chmod +x /usr/local/bin/yq
```

**Usage:**

```bash
# Validate YAML syntax
yq eval '.' file.yaml

# Validate multiple files
yq eval '.' *.yml *.yaml
```

## File Patterns

The linting tools are configured to check:

- `**/*.yml` - All .yml files
- `**/*.yaml` - All .yaml files

**Excluded files:**

- `**/node_modules/**` - Dependencies
- `**/dist/**` - Build outputs
- `**/coverage/**` - Test coverage
- `**/build/**` - Build artifacts
- `**/.git/**` - Git metadata
- `**/pnpm-lock.yaml` - Lock files
- `**/package-lock.json` - Lock files
- `**/yarn.lock` - Lock files

## Current Project Files

The following YAML files are currently in the project:

1. `docker-compose.yml` - Docker Compose configuration
2. `pnpm-workspace.yaml` - pnpm workspace configuration
3. `apps/client-ui/amplify.yml` - Amplify configuration
4. `apps/client-ui/amplify-templates/amplify.base.yml` - Base Amplify template
5. `apps/client-ui/amplify-templates/amplify.preview.yml` - Preview Amplify template
6. `apps/client-ui/amplify-templates/amplify.production.yml` - Production Amplify template
7. `apps/client-ui/amplify-templates/amplify.staging.yml` - Staging Amplify template

## Linting Rules

### Line Length

- **Limit:** 120 characters per line
- **Warning:** Lines exceeding this limit
- **Exception:** Some generated files may have longer lines

### Indentation

- **Style:** 2 spaces (no tabs)
- **Consistency:** All indentation must be consistent
- **Error:** Mixed indentation or tab usage

### Quotes

- **Style:** Single quotes preferred
- **Consistency:** Consistent quote style throughout file
- **Exception:** When escaping is needed

### Trailing Spaces

- **Rule:** No trailing whitespace allowed
- **Error:** Any trailing spaces or tabs

### Empty Lines

- **Maximum:** 2 consecutive empty lines
- **File End:** Must end with single newline
- **File Start:** No empty lines at start

### Duplicate Keys

- **Rule:** No duplicate keys in same object
- **Error:** Duplicate keys detected

## Integration with CI/CD

The YAML linting can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions step
- name: Lint YAML files
  run: |
    pnpm lint:yaml:js
    # Or with yamllint if installed
    yamllint .
```

## IDE Integration

### VS Code

Install the "YAML" extension by Red Hat for:

- Syntax highlighting
- Validation
- Auto-completion
- Formatting

### Configuration for VS Code

Add to your `.vscode/settings.json`:

```json
{
	"yaml.schemas": {
		"https://json.schemastore.org/docker-compose": "docker-compose*.yml",
		"https://json.schemastore.org/amplify": "**/amplify*.yml"
	},
	"yaml.format.enable": true,
	"yaml.format.singleQuote": true,
	"yaml.format.bracketSpacing": false,
	"editor.rulers": [120],
	"files.trimTrailingWhitespace": true,
	"files.insertFinalNewline": true
}
```

## Troubleshooting

### Common Issues

1. **Line length warnings in generated files**
   - These are expected and can be ignored
   - Generated files are excluded from linting

2. **Indentation errors**
   - Ensure consistent 2-space indentation
   - Check for mixed tabs and spaces

3. **Quote style inconsistencies**
   - Use single quotes consistently
   - Escape quotes when necessary

4. **Missing newline at end of file**
   - Add a newline at the end of each YAML file
   - Configure your editor to do this automatically

### Fixing Issues

1. **Use the custom linter for detailed feedback:**

   ```bash
   pnpm lint:yaml:js
   ```

2. **Fix formatting issues:**

   ```bash
   # If yamllint is installed
   yamllint --fix .
   ```

3. **Validate specific files:**

   ```bash
   yamllint docker-compose.yml
   ```

## Best Practices

1. **Run linting before commits**
2. **Fix issues immediately when they're small**
3. **Use consistent formatting across all YAML files**
4. **Validate YAML syntax before deployment**
5. **Keep configuration files up to date**

## Resources

- [yamllint Documentation](https://yamllint.readthedocs.io/)
- [YAML Specification](https://yaml.org/spec/1.2/spec.html)
- [Docker Compose YAML Reference](https://docs.docker.com/compose/compose-file/)
- [Amplify YAML Reference](https://docs.amplify.aws/cli/reference/files/)

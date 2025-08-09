# Amplify Configuration Templates

This guide covers the environment-specific Amplify configuration templates used for frontend deployments in the
Macro AI project.

## 📋 Overview

The Amplify configuration system provides environment-specific `amplify.yml` files that optimize build
processes, security settings, and deployment configurations for different environments:

- **Preview**: Fast builds with debugging capabilities for PR deployments
- **Staging**: Production-like configuration with enhanced monitoring
- **Production**: Optimized for performance, security, and reliability

## 📁 File Structure

```text
apps/client-ui/
├── amplify-templates/
│   ├── amplify.base.yml          # Base template with common settings
│   ├── amplify.preview.yml       # Preview environment template
│   ├── amplify.staging.yml       # Staging environment template
│   └── amplify.production.yml    # Production environment template
├── scripts/
│   ├── generate-amplify-config.sh    # Configuration generation script
│   └── validate-amplify-config.sh    # Configuration validation script
└── amplify.yml                   # Generated configuration (git-ignored)
```

## 🔧 Template Features

### Base Template (`amplify.base.yml`)

**Purpose**: Foundation template with common configurations

**Key Features**:

- Standard build phases (preBuild, build)
- pnpm package manager setup
- Environment variable validation
- Basic artifact configuration
- Cache optimization
- Optional test configuration

### Preview Template (`amplify.preview.yml`)

**Purpose**: Optimized for PR preview deployments

**Key Features**:

- **Fast Builds**: Aggressive caching and optimized dependencies
- **Debug Support**: Comprehensive logging and build metadata
- **PR Integration**: PR number injection and preview-specific variables
- **Relaxed Security**: Permissive CORS and CSP for debugging
- **Build Metadata**: Creates `build-info.json` with deployment details

**Environment Variables**:

```yaml
VITE_PREVIEW_MODE: 'true'
VITE_PR_NUMBER: '${PR_NUMBER}'
VITE_ENABLE_DEVTOOLS: 'true'
VITE_ENABLE_DEBUG_LOGGING: 'true'
VITE_SHOW_BUILD_INFO: 'true'
```

**Security Headers** (Relaxed):

```yaml
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'..."
Access-Control-Allow-Origin: '*'
```

### Staging Template (`amplify.staging.yml`)

**Purpose**: Production-like environment for testing

**Key Features**:

- **Comprehensive Testing**: Unit tests, type checking, linting
- **Performance Monitoring**: Enhanced build validation
- **Production-like Security**: Strict security headers
- **Environment Validation**: API URL validation for staging
- **Coverage Reports**: Test coverage artifacts

**Environment Variables**:

```yaml
VITE_ENABLE_PERFORMANCE_MONITORING: 'true'
VITE_ENABLE_ERROR_REPORTING: 'true'
VITE_ENABLE_ANALYTICS: 'false'
```

**Security Headers** (Production-like):

```yaml
Strict-Transport-Security: 'max-age=31536000; includeSubDomains'
X-Frame-Options: DENY
Content-Security-Policy: "default-src 'self'; script-src 'self'..."
```

### Production Template (`amplify.production.yml`)

**Purpose**: Optimized for production deployment

**Key Features**:

- **Strict Validation**: Environment variable validation
- **Security Hardening**: Comprehensive security headers
- **Performance Optimization**: Aggressive caching and compression
- **Minimal Metadata**: Limited build information for security
- **Comprehensive Testing**: Full test suite before deployment

**Environment Variables**:

```yaml
VITE_ENABLE_DEVTOOLS: 'false'
VITE_ENABLE_DEBUG_LOGGING: 'false'
VITE_ENABLE_ANALYTICS: 'true'
```

**Security Headers** (Strict):

```yaml
Strict-Transport-Security: 'max-age=63072000; includeSubDomains; preload'
Content-Security-Policy: "default-src 'self'; script-src 'self'; ..."
Permissions-Policy: 'camera=(), microphone=(), geolocation=()...'
```

## 🚀 Usage

### Automated Generation (Recommended)

The configuration is automatically generated during GitHub Actions workflows:

```yaml
- name: Generate Amplify configuration
  run: |
    cd apps/client-ui
    ./scripts/generate-amplify-config.sh \
      --environment preview \
      --pr-number "${{ github.event.pull_request.number }}" \
      --output-file amplify.yml
```

### Manual Generation

Generate configuration for different environments:

```bash
# Preview environment for PR #123
./scripts/generate-amplify-config.sh \
  --environment preview \
  --pr-number 123

# Staging environment
./scripts/generate-amplify-config.sh \
  --environment staging \
  --output-file amplify.staging.yml

# Production environment
./scripts/generate-amplify-config.sh \
  --environment production
```

### Configuration Validation

Validate generated configurations:

```bash
# Validate specific configuration
./scripts/validate-amplify-config.sh \
  --config-file amplify.yml \
  --environment preview

# Validate all templates
./scripts/validate-amplify-config.sh --all-templates

# Strict validation mode
./scripts/validate-amplify-config.sh --strict
```

## 🔒 Security Considerations

### Environment-Specific Security

Each environment has tailored security configurations:

#### Preview Environment

- **Relaxed CSP**: Allows `unsafe-inline` and `unsafe-eval` for debugging
- **Permissive CORS**: Allows all origins for development
- **Debug Headers**: Includes build and PR information

#### Staging Environment

- **Production-like Security**: Strict headers with some debugging
- **Environment Validation**: Ensures staging API endpoints
- **Performance Monitoring**: Enabled for testing

#### Production Environment

- **Maximum Security**: Strictest CSP and security headers
- **Minimal Information**: Limited build metadata exposure
- **Strict Validation**: Prevents debug features in production

### Security Headers Comparison

| Header                        | Preview      | Staging | Production        |
| ----------------------------- | ------------ | ------- | ----------------- |
| `Strict-Transport-Security`   | Not set      | 1 year  | 2 years + preload |
| `X-Frame-Options`             | `SAMEORIGIN` | `DENY`  | `DENY`            |
| `Content-Security-Policy`     | Relaxed      | Strict  | Strictest         |
| `Access-Control-Allow-Origin` | `*`          | Not set | Not set           |

## 📊 Build Optimization

### Caching Strategy

All templates use aggressive caching for faster builds:

```yaml
cache:
  paths:
    - node_modules/**/*
    - .pnpm-store/**/*
    - ~/.pnpm-store/**/*
```

### Build Commands

Environment-specific build optimizations:

- **Preview**: `pnpm build` (standard build)
- **Staging**: `pnpm build:staging` (with optimizations)
- **Production**: `pnpm build:production` (full optimizations)

### Artifact Management

Environment-specific artifact naming:

```yaml
artifacts:
  name: macro-ai-frontend-${environment}-$(date +%Y%m%d-%H%M%S)
```

## 🧪 Testing Integration

### Test Configuration

Each environment includes comprehensive testing:

```yaml
test:
  phases:
    test:
      commands:
        - pnpm test:run # Unit tests
        - pnpm type-check # TypeScript validation
        - pnpm lint # Code quality
```

### Coverage Reports

Staging and production include coverage reporting:

```yaml
test:
  artifacts:
    baseDirectory: coverage
    files: ['**/*']
```

## 🔧 Customization

### Adding New Environments

1. Create new template: `amplify-templates/amplify.{environment}.yml`
2. Update generation script to support new environment
3. Add validation rules for environment-specific settings
4. Update documentation

### Modifying Existing Templates

1. Edit the appropriate template file
2. Validate changes: `./scripts/validate-amplify-config.sh --all-templates`
3. Test generation: `./scripts/generate-amplify-config.sh --environment {env}`
4. Update documentation if needed

### Environment Variables

Add new environment variables to templates:

```yaml
# In template file
VITE_NEW_FEATURE: '${VITE_NEW_FEATURE:-default_value}'
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Template Validation Errors

**Symptom**: YAML syntax errors or missing sections

**Solution**:

```bash
# Validate specific template
./scripts/validate-amplify-config.sh --config-file amplify-templates/amplify.preview.yml

# Check YAML syntax
yq eval '.' amplify-templates/amplify.preview.yml
```

#### 2. Environment Variable Substitution

**Symptom**: Variables not replaced in generated configuration

**Solution**:

- Ensure variables are exported before generation
- Check variable names match template placeholders
- Verify `envsubst` is available

#### 3. Build Command Failures

**Symptom**: Build commands fail in Amplify

**Solution**:

- Verify pnpm installation in template
- Check build script exists in package.json
- Validate environment variables are set

### Debug Mode

Enable debug output for troubleshooting:

```bash
./scripts/generate-amplify-config.sh --debug --environment preview
```

## 📚 Related Documentation

- [Frontend Preview Deployment Guide](./amplify-preview-deployment.md)
- [Environment Variable Integration](./environment-variable-integration.md)
- [AWS IAM Permissions for Amplify](../deployment/aws-iam-amplify-permissions.md)
- [CI/CD Setup Guide](../deployment/ci-cd-setup-guide.md)

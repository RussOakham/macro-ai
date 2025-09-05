# Docker Configuration for Macro AI Express API

This document covers the Docker setup, configuration, and deployment for the Macro AI Express API with BuildKit optimizations.

## 🏗️ Architecture Overview

The Docker setup uses a **multi-stage build approach with BuildKit optimizations**:

1. **`base`** - Alpine Linux base with Node.js 20 and pnpm
2. **`builder`** - Turbo prune for monorepo optimization with cache mounts
3. **`installer`** - Install dependencies and build with BuildKit caching
4. **`runner`** - Minimal production image with non-root user

### 🚀 BuildKit Features

- **Cache Mounts**: Persistent caching for pnpm store and Turbo cache
- **Multi-platform Support**: Build for AMD64 and ARM64 architectures
- **Advanced Caching**: GitHub Actions cache integration and registry caching
- **Parallel Builds**: Faster builds through parallel stage execution
- **Secrets Management**: Secure build-time secret handling

## 📁 File Structure

```bash
apps/express-api/
├── Dockerfile                    # Standard Docker build (legacy)
├── Dockerfile.distroless         # 🏆 RECOMMENDED: Distroless variant for production
├── .dockerignore                 # Comprehensive build context exclusions
├── docker-compose.yml            # Development environment with BuildKit
├── docker-compose.prod.yml       # Production environment
├── scripts/
│   ├── build-docker-buildkit.sh # BuildKit optimized build script
│   ├── analyze-docker-image.sh  # Image analysis and optimization tool
│   ├── generate-env-file.sh     # Generate environment files from Parameter Store
│   ├── build-docker-with-env.sh # Build Docker images with configuration
│   ├── build-docker.sh          # Legacy build script
│   ├── setup-docker-dev.sh      # Setup development environment
│   └── deploy-docker-prod.sh    # Production deployment
└── DOCKER.md                     # This documentation
```

## 🚀 Quick Start

### Prerequisites

- Docker Desktop installed and running
- Docker Compose available
- Git repository cloned
- AWS CLI configured with Parameter Store access
- `jq` installed for JSON processing

### Configuration Approach

The application uses **build-time configuration injection**:

- Environment variables are resolved from AWS Parameter Store during Docker build
- Configuration is baked into the container image
- No runtime Parameter Store access needed
- Faster container startup and more reliable operation
- Set `SKIP_ENV_VALIDATION=true` during Docker builds to bypass local env checks and skip swagger generation

### Development Setup

```bash
# Navigate to express-api directory
cd apps/express-api

# Run the setup script
./scripts/setup-docker-dev.sh

# Or manually:
docker-compose up -d
```

### Production Build

#### BuildKit Optimized (Recommended)

```bash
# Build with BuildKit optimizations
./scripts/build-docker-buildkit.sh -e production -t latest

# Multi-platform build with caching
./scripts/build-docker-buildkit.sh --multi-platform --cache-from type=registry,ref=myregistry/cache:buildcache

# Build and push to ECR
./scripts/build-docker-buildkit.sh -e production -t v1.0.0 -p -r 123456789.dkr.ecr.us-east-1.amazonaws.com
```

#### Legacy Build

```bash
# Build production image (legacy)
./scripts/build-docker.sh production latest

# Deploy production image
./scripts/deploy-docker-prod.sh production latest
```

## 🔧 Docker Commands

### Building Images with Configuration

The recommended approach uses build-time configuration injection:

```bash
# Generate environment file from Parameter Store
./scripts/generate-env-file.sh -e development

# Build Docker image with configuration
./scripts/build-docker-with-env.sh -e development

# Build and push to ECR
./scripts/build-docker-with-env.sh -e production -p -r "ecr-repo-uri"
```

### Legacy Build Commands

```bash
# Development build (includes source code for hot reloading)
docker build --target builder -t macro-ai-express-api:dev .

# Production build (minimal image)
docker build --target production -t macro-ai-express-api:prod .

# Build with specific version
docker build --target production -t macro-ai-express-api:v1.0.0 .
```

### Running Containers

```bash
# Run development container
docker run -p 3001:3040 macro-ai-express-api:dev

# Run production container with environment file
docker run -p 3040:3040 --env-file .env macro-ai-express-api:prod

# Run with specific environment variables
docker run -p 3040:3040 \
  -e NODE_ENV=production \
  -e SERVER_PORT=3040 \
  macro-ai-express-api:prod
```

### Docker Compose

```bash
# Start development services
docker-compose up -d

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f express-api

# Stop services
docker-compose down
```

## 🏥 Health Checks

The Docker image includes built-in health checks:

- **Endpoints**:
  - Local/dev: `/health`
  - ECS: `/api/health` (requires `X-Api-Key: $API_KEY`)
- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Retries**: 3
- **Start Period**: 5 seconds

### Health Check Endpoints

The API provides multiple health check endpoints:

- `/health` - Basic health status (local development)
- `/api/health` - ECS health check with API key authentication
- `/health/detailed` - Comprehensive health information
- `/health/ready` - Readiness check
- `/health/live` - Liveness check
- `/health/config` - Configuration validation

## 🔒 Security Features

### Non-Root User

- Container runs as `nodejs` user (UID 1001)
- Proper file permissions and ownership
- Minimal attack surface

### Signal Handling

- Containers handle SIGTERM/SIGINT for graceful shutdown
- If you need PID 1 signal forwarding/zombie reaping, consider adding `tini` to the ECS image

### Image Security

- Alpine Linux base for smaller attack surface
- Multi-stage build reduces final image size
- No unnecessary packages in production image

## 🌍 Environment Variables

### Required Variables

```bash
# Application
NODE_ENV=production
APP_ENV=production
SERVER_PORT=3000

# AWS Configuration
AWS_REGION=us-east-1
AWS_COGNITO_REGION=us-east-1

# API Keys
API_KEY=your-api-key
COOKIE_ENCRYPTION_KEY=your-encryption-key

# Cognito Configuration
AWS_COGNITO_USER_POOL_ID=your-user-pool-id
AWS_COGNITO_USER_POOL_CLIENT_ID=your-client-id
AWS_COGNITO_USER_POOL_SECRET_KEY=your-secret-key

# Database
RELATIONAL_DATABASE_URL=your-database-url
REDIS_URL=your-redis-url

# OpenAI
OPENAI_API_KEY=your-openai-key
OPENAI_ORGANIZATION=your-org-id
```

### Environment File

Create a `.env.local` file in the `apps/express-api/` directory:

```bash
# Copy from example
cp env.local.example .env.local

# Edit with your values
nano .env.local
```

**Note**: For comprehensive environment configuration options, see [ENVIRONMENT_TEMPLATE.md](../configuration/ENVIRONMENT_TEMPLATE.md).

## 📊 Performance Optimization

### Multi-Stage Build Benefits

- **Dependency Caching**: Dependencies are cached in separate layer
- **Build Optimization**: Only necessary files copied to production
- **Size Reduction**: Final image is significantly smaller

### Layer Caching Strategy

1. **Dependencies Layer**: Installed first, cached unless package files change
2. **Source Code Layer**: Copied after dependencies, changes frequently
3. **Build Output Layer**: Generated from source, cached until source changes

### Image Size Comparison

- **Development Image**: ~500MB (includes source and dev dependencies)
- **Production Image (Alpine)**: ~150MB (minimal runtime only)
- **Production Image (Distroless)**: ~80-100MB (maximum optimization)
- **With BuildKit Caching**: 30-50% faster builds

### 🔍 Image Analysis

Use the built-in analysis tool to optimize your images:

```bash
# Analyze current image
./scripts/analyze-docker-image.sh -i macro-ai-express-api:latest

# Interactive layer analysis with dive
./scripts/analyze-docker-image.sh -t dive

# Size comparison across tags
./scripts/analyze-docker-image.sh -t size
```

## 🐛 Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container logs
docker logs <container-id>

# Check container status
docker ps -a

# Verify image exists
docker images macro-ai-express-api
```

#### Health Check Failures

```bash
# Test health endpoint manually
curl http://localhost:3000/health

# Check container health status
docker inspect <container-id> | grep Health -A 10

# Verify port mapping
docker port <container-id>
```

#### Permission Issues

```bash
# Check file ownership in container
docker exec <container-id> ls -la /app

# Verify user context
docker exec <container-id> whoami
```

### Debug Mode

```bash
# Run container with interactive shell
docker run -it --rm macro-ai-express-api:dev sh

# Access running container
docker exec -it <container-id> sh

# View container filesystem
docker exec <container-id> ls -la /app
```

## 🚀 Production Deployment

### ECS Fargate Preparation

1. **Build Production Image**

   ```bash
   ./scripts/deploy-docker-prod.sh production v1.0.0
   ```

2. **Push to ECR** (if using AWS ECR)

   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   docker tag macro-ai-express-api:production-v1.0.0 <account-id>.dkr.ecr.us-east-1.amazonaws.com/macro-ai-express-api:v1.0.0
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/macro-ai-express-api:v1.0.0
   ```

3. **Update ECS Task Definition**
   - Use new image URI
   - Configure environment variables
   - Set resource limits

### Monitoring and Logging

- **Health Checks**: ECS will use Docker health checks
- **Logs**: Configure CloudWatch logging
- **Metrics**: Use CloudWatch metrics for monitoring

## 🔄 CI/CD Integration

### GitHub Actions

The Docker build can be integrated into your CI/CD pipeline:

```yaml
- name: Build Docker Image
  run: |
    cd apps/express-api
    ./scripts/build-docker.sh production ${{ github.sha }}

- name: Push to ECR
  run: |
    docker push ${{ steps.login-ecr.outputs.registry }}/macro-ai-express-api:${{ github.sha }}
```

### Build Arguments

The Dockerfile supports build arguments for CI/CD:

- `BUILD_ENV`: Environment (development, staging, production)
- `BUILD_VERSION`: Version string
- `BUILD_DATE`: ISO timestamp
- `BUILD_COMMIT`: Git commit hash

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-Stage Builds](https://docs.docker.com/develop/dev-best-practices/multistage-build/)
- [ECS Fargate](https://docs.aws.amazon.com/ecs/latest/userguide/what-is-fargate.html)
- [Health Checks](https://docs.docker.com/engine/reference/builder/#healthcheck)

## 🤝 Contributing

When modifying the Docker configuration:

1. Test locally with `./scripts/setup-docker-dev.sh`
2. Verify production build with `./scripts/deploy-docker-prod.sh`
3. Update this documentation
4. Test in CI/CD pipeline

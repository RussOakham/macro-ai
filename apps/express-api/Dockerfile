# Multi-stage Dockerfile for Macro AI Express API
# Stage 1: Dependencies - Install and cache dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@10.14.0

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./
COPY apps/express-api/package.json ./apps/express-api/
COPY packages/*/package.json ./packages/

# Install dependencies with frozen lockfile for reproducible builds
RUN pnpm install --frozen-lockfile

# Stage 2: Build - Compile TypeScript and build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@10.14.0

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/express-api/node_modules ./apps/express-api/node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/*/node_modules

# Copy source code
COPY . .

# Build the express-api
RUN cd apps/express-api && pnpm build

# Stage 2.5: Environment Configuration - Generate environment file
FROM node:20-alpine AS env-config
WORKDIR /app

# Install required tools for environment file generation
RUN apk add --no-cache bash curl jq

# Copy environment generation script
COPY apps/express-api/scripts/generate-env-file.sh ./

# Make script executable
RUN chmod +x generate-env-file.sh

# Build argument for environment file
ARG ENV_FILE
ARG ENVIRONMENT=development
ARG PARAMETER_PREFIX=/macro-ai/development
ARG AWS_REGION=us-east-1

# Generate environment file (this will be done at build time)
# The actual environment file should be generated before building the Docker image
RUN if [ -f "$ENV_FILE" ]; then \
        echo "Using provided environment file: $ENV_FILE"; \
        cp "$ENV_FILE" .env; \
    else \
        echo "No environment file provided, creating minimal .env"; \
        echo "NODE_ENV=$ENVIRONMENT" > .env; \
        echo "APP_ENV=$ENVIRONMENT" >> .env; \
        echo "PARAMETER_STORE_PREFIX=$PARAMETER_PREFIX" >> .env; \
        echo "AWS_REGION=$AWS_REGION" >> .env; \
        echo "GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .env; \
    fi

# Stage 3: Production - Create minimal production image
FROM node:20-alpine AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/apps/express-api/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/express-api/package.json ./

# Copy only production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy environment configuration from env-config stage
COPY --from=env-config --chown=nodejs:nodejs /app/.env ./.env

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/temp && \
    chown -R nodejs:nodejs /app/logs /app/temp

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

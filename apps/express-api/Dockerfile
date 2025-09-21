# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# The web Dockerfile is copy-pasted into our main docs at /docs/handbook/deploying-with-docker.
# Make sure you update this Dockerfile, the Dockerfile in the web workspace and copy that over to Dockerfile in the docs.

FROM base AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.

# Set pnpm home and path
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Set working directory
WORKDIR /macro-ai
# Use BuildKit cache mount for pnpm global packages
RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm add -g turbo

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
COPY apps/express-api/package.json apps/express-api/
COPY packages/macro-ai-api-client/package.json packages/macro-ai-api-client/

# Try to run turbo prune, but gracefully handle failure for PR environments
RUN --mount=type=cache,target=.turbo \
    --mount=type=cache,target=/root/.local/share/pnpm \
    (/root/.local/share/pnpm/turbo prune @repo/express-api --docker 2>/dev/null) || echo "⚠️ Turbo prune failed, proceeding with full copy for PR environment"

# Build stage - install ALL dependencies including dev dependencies for building
FROM base AS builder-full

# Set pnpm home and path for build stage
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /macro-ai

# Check if turbo prune succeeded by looking for the pruned output
COPY --from=builder /macro-ai/out/json/ ./out/json/ 2>/dev/null || (
    echo "⚠️ Turbo prune output not found, using full source copy"
    # Copy all source files since prune failed
    COPY . .
)

# Install dependencies (will work with either pruned or full source)
RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --frozen-lockfile

# Copy the rest of the source if using pruned approach
COPY --from=builder /macro-ai/out/full/ ./ 2>/dev/null || echo "Using full source copy, no additional copy needed"

# Copy environment file if provided (for Docker build with dummy env vars)
ARG ENV_FILE
RUN if [ "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then cp "$ENV_FILE" /macro-ai/.env && cp "$ENV_FILE" /macro-ai/apps/express-api/.env; fi

# Use BuildKit cache mount for turbo cache during build
RUN --mount=type=cache,target=.turbo \
    --mount=type=cache,target=/root/.local/share/pnpm \
    SKIP_ENV_VALIDATION=true pnpm turbo build

# Production dependencies stage - install ONLY production dependencies
FROM base AS installer

# Set pnpm home and path for installer stage
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /macro-ai

# Install ONLY production dependencies
COPY --from=builder /macro-ai/out/json/ .
RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --prod --frozen-lockfile --ignore-scripts

FROM base AS runner
RUN apk add --no-cache curl
WORKDIR /macro-ai

# Don't run production as root
RUN addgroup -S -g 1001 expressjs \
 && adduser -S -u 1001 -G expressjs expressjs
USER root
# Copy built application from build stage and production dependencies from installer stage
COPY --chown=expressjs:expressjs --from=builder-full /macro-ai/apps/express-api/dist ./apps/express-api/dist
COPY --chown=expressjs:expressjs --from=installer /macro-ai/node_modules ./node_modules
COPY --chown=expressjs:expressjs --from=installer /macro-ai/apps/express-api/node_modules ./apps/express-api/node_modules
COPY --chown=expressjs:expressjs --from=installer /macro-ai/package.json ./package.json
COPY --chown=expressjs:expressjs --from=installer /macro-ai/apps/express-api/package.json ./apps/express-api/package.json
USER expressjs

# Set NODE_ENV for runtime
ENV NODE_ENV=production

# Health check with curl (matches ECS expectations)
HEALTHCHECK --interval=30s --timeout=6s --start-period=15s --retries=3 \
    CMD curl -fsS --connect-timeout 3 --max-time 5 -o /dev/null http://127.0.0.1:3040/api/health || exit 1

CMD ["node", "apps/express-api/dist/index.js"]
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
COPY . .
# Use BuildKit cache mount for turbo cache during prune
RUN --mount=type=cache,target=.turbo \
    --mount=type=cache,target=/root/.local/share/pnpm \
    /root/.local/share/pnpm/turbo prune @repo/express-api --docker

# Build stage - install ALL dependencies including dev dependencies for building
FROM base AS builder-full

# Set pnpm home and path for build stage
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /macro-ai

# First install ALL dependencies (including dev dependencies needed for build)
COPY --from=builder /macro-ai/out/json/ .
RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --frozen-lockfile

# Build the project and its dependencies
COPY --from=builder /macro-ai/out/full/ .

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
RUN addgroup --system --gid 1001 expressjs
RUN adduser --system --uid 1001 expressjs
USER expressjs

# Copy built application from build stage and production dependencies from installer stage
COPY --from=builder-full /macro-ai/apps/express-api/dist ./apps/express-api/dist
COPY --from=installer /macro-ai/node_modules ./node_modules
COPY --from=installer /macro-ai/apps/express-api/node_modules ./apps/express-api/node_modules
COPY --from=installer /macro-ai/package.json ./package.json
COPY --from=installer /macro-ai/apps/express-api/package.json ./apps/express-api/package.json

# Set NODE_ENV for runtime
ENV NODE_ENV=production

# Health check with curl (matches ECS expectations)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f -H "X-Api-Key: ${API_KEY}" http://localhost:3040/api/health || exit 1

CMD ["node", "apps/express-api/dist/index.js"]
FROM node:20-alpine AS base
RUN apk update
RUN apk add --no-cache libc6-compat
RUN corepack enable

# The web Dockerfile is copy-pasted into our main docs at /docs/handbook/deploying-with-docker.
# Make sure you update this Dockerfile, the Dockerfile in the web workspace and copy that over to Dockerfile in the docs.

FROM base AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk update
RUN apk add --no-cache libc6-compat

# Set pnpm home and path
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Set working directory
WORKDIR /macro-ai
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @repo/express-api --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat

WORKDIR /macro-ai

# First install dependencies (as they change less often)
COPY --from=builder /macro-ai/out/json/ .
RUN pnpm install --frozen-lockfile

# Build the project and its dependencies
COPY --from=builder /macro-ai/out/full/ .

# Copy environment file if provided (for Docker build with dummy env vars)
ARG ENV_FILE
RUN if [ "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then cp "$ENV_FILE" /macro-ai/.env && cp "$ENV_FILE" /macro-ai/apps/express-api/.env; fi

# Uncomment and use build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM

# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm turbo build

FROM base AS runner
WORKDIR /macro-ai

# Don't run production as root
RUN addgroup --system --gid 1001 expressjs
RUN adduser --system --uid 1001 expressjs
USER expressjs
COPY --from=installer /macro-ai .

CMD node apps/express-api/dist/index.js
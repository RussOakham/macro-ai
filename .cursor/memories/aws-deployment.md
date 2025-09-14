# AWS Deployment Memory

## Infrastructure

- Project's infrastructure is deployed via GitHub workflows, which are stored in the repository
- Use AWS CDK v2 with ECS Fargate, RDS PostgreSQL + pgvector, Redis ElastiCache, Cognito, CloudWatch
- Always use --no-cli-pager or --no-pager when running AWS CLI commands that return output in pager
  format

## Deployment Process

- Deployment fixes should be done by pushing to the remote branch to allow GitHub workflow to deploy
  them, instead of deploying via CLI
- When running terminal commands, use craft CLI commands by default to avoid hanging outputs (e.g.,
  AWS streaming responses) and ensure commands have appropriate timeouts

## Health Checks

- The project's health check endpoints require including an X-Api-Key header in requests

## Environment Configuration

- Successfully completed Phase 3.2 Environment Configuration refactor replacing runtime Parameter Store
  access with build-time configuration injection
- Created new shell scripts (generate-env-file.sh, build-docker-with-env.sh)
- Updated Dockerfile with env-config stage, simplified health check route, and removed load balancer
  integration from ECS constructs
- Phase 4.1 Local Docker Testing was started but paused while working on Turborepo monorepo build issues

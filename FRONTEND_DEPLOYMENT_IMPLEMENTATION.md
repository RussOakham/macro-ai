# Frontend Deployment Implementation - Option 1

## Overview

**Implemented Option 1**: Build and deploy frontend to AWS Amplify **after** Pulumi infrastructure creation in GitHub Actions.

This approach provides:

- ✅ **Clean separation of concerns**: Infrastructure first, then application
- ✅ **Scalability**: Single reusable workflow for all three environments
- ✅ **Reliability**: Explicit polling for deployment completion
- ✅ **Flexibility**: Manual deployments via Amplify API (not dependent on git hooks)

---

## Architecture

```text
Deploy PR Preview / Staging / Production
         |
         ├─→ build-express-api (Docker image)
         │
         ├─→ deploy-full-stack (Pulumi)
         │   ├─ Create/Update infrastructure
         │   ├─ Create Amplify branch
         │   └─ Output: amplifyAppId, amplifyBranchName
         │
         └─→ deploy-frontend (NEW - Reusable Workflow)
             ├─ Build React app (pnpm --filter client-ui build)
             ├─ Create zip of dist/ contents
             ├─ Call AWS Amplify create-deployment
             ├─ Upload zip to Amplify's S3 bucket
             ├─ Call AWS Amplify start-deployment
             ├─ Poll for completion (max 30 min timeout)
             └─ Output: frontend-deployment-url, deployment-status
```

---

## Files Created/Modified

### 1. **NEW**: `.github/workflows/reusable-deploy-frontend-amplify.yml`

**Purpose**: Reusable workflow shared by all three deployment workflows (PR Preview, Staging, Production)

**Key Features**:

- **Build Stage**:
  - Sets up Node.js 20.19.4 + pnpm 10.14.0
  - Installs dependencies from monorepo
  - Runs `pnpm --filter client-ui build`
  - Validates `index.html` exists in dist/

- **Packaging Stage**:
  - Creates zip file from dist/ contents (NOT the folder itself)
  - Validates file size < 5GB
  - Logs zip size for debugging

- **Deployment Stage**:
  - Configures AWS credentials via OIDC (no long-lived keys)
  - Calls `aws amplify create-deployment` → gets S3 upload URL
  - Uploads zip to Amplify's managed S3 bucket (with 3x retry)
  - Calls `aws amplify start-deployment` → triggers build job

- **Polling Stage**:
  - Polls `aws amplify get-job` every 10 seconds
  - Timeout: 30 minutes
  - Exits on SUCCESS, FAILED, or CANCELLED
  - Outputs: `frontend-deployment-url`, `deployment-status`

- **Error Handling**:
  - Clear error messages at each stage
  - Comprehensive logging for troubleshooting
  - Graceful cleanup of temporary artifacts

### 2. **MODIFIED**: `.github/workflows/deploy-pr-preview-pulumi.yml`

**Added Job**: `deploy-frontend` (after `deploy-full-stack`)

```yaml
deploy-frontend:
  name: Deploy Frontend to Amplify
  uses: ./.github/workflows/reusable-deploy-frontend-amplify.yml
  if: needs.deploy-full-stack.result == 'success' && needs.deploy-full-stack.outputs.amplify-app-id != ''
  needs: [validate-inputs, deploy-full-stack]
  with:
    amplify-app-id: ${{ needs.deploy-full-stack.outputs.amplify-app-id }}
    amplify-branch-name: ${{ needs.deploy-full-stack.outputs.amplify-branch-name }}
    environment-name: ${{ needs.validate-inputs.outputs.environment-name }}
    pr-number: ${{ needs.validate-inputs.outputs.pr-number }}
```

**Updated**: `deployment-summary` job

- Now depends on `deploy-frontend`
- Uses `deploy-frontend.outputs.frontend-deployment-url` instead of `deploy-full-stack.outputs.frontend-url`
- Displays frontend deployment status in summary

### 3. **MODIFIED**: `.github/workflows/deploy-staging-pulumi.yml`

**Added Job**: `deploy-frontend-staging` (after `deploy-full-stack`)

- Same structure as PR preview, with environment-name: staging
- Depends on `deploy-full-stack`
- Updates `setup-monitoring`, `schedule-teardown`, and `deployment-summary` jobs to include it

### 4. **MODIFIED**: `.github/workflows/deploy-production-pulumi.yml`

**Added Job**: `deploy-frontend-production` (after `deploy-full-stack`)

- Same structure as PR preview, with environment-name: production
- Depends on `deploy-full-stack`
- Updates `production-monitoring` and `deployment-summary` jobs to include it
- Included in overallSuccess check for deployment status

---

## How It Works (Step-by-Step)

### 1. Pulumi Deploys Infrastructure

```bash
# PR Preview Example
pulumi stack select pr-90
pulumi up --yes
# Creates:
# - ECS Fargate backend at pr-90.api.macro-ai.russoakham.dev
# - Amplify branch: pr-90 (inside macro-ai-dev app)
# - Route53 DNS records
# Outputs: amplifyAppId, amplifyBranchName
```

### 2. Frontend Workflow Starts

```bash
# Triggered after deploy-full-stack succeeds
# Receives Pulumi outputs as inputs
```

### 3. Frontend Build

```bash
cd /workspace
pnpm install --frozen-lockfile
pnpm --filter client-ui build
# Generates: apps/client-ui/dist/
# Files: index.html, assets/*, etc.
```

### 4. Create Zip Archive

```bash
cd apps/client-ui/dist
zip -r ../../frontend-12345.zip .
# Creates zip of contents (NOT nested dist/)
# Zips from: index.html, assets/, etc.
```

### 5. Amplify Manual Deployment

```bash
# Create deployment slot
aws amplify create-deployment \
  --app-id "d1234567890" \
  --branch-name "pr-90"
# Returns: deploymentId, zipUploadUrl

# Upload artifacts
curl -X PUT \
  -H "Content-Type: application/zip" \
  --data-binary @frontend-12345.zip \
  "https://s3.amplify-uploads.example.com/xyz"

# Start the deployment
aws amplify start-deployment \
  --app-id "d1234567890" \
  --branch-name "pr-90" \
  --deployment-id "deploy-1234"
# Returns: jobId

# Poll for completion
aws amplify get-job \
  --app-id "d1234567890" \
  --branch-name "pr-90" \
  --job-id "job-5678"
# Polls until status = SUCCEED / FAILED / CANCELLED
```

### 6. Frontend URL Available

```text
https://pr-90.macro-ai.russoakham.dev
```

---

## Environment-Specific Configurations

### PR Preview (pr-{number})

- Amplify branch: `pr-{number}`
- Frontend URL: `https://pr-{number}.macro-ai.russoakham.dev`
- Environment vars:
  - `VITE_API_URL`: `https://pr-{number}.api.macro-ai.russoakham.dev`
  - `VITE_PR_NUMBER`: `{number}`
  - `VITE_PREVIEW_MODE`: `true`

### Staging

- Amplify branch: `develop` (reuses dev app)
- Frontend URL: `https://develop.macro-ai.russoakham.dev`
- Environment vars:
  - `VITE_API_URL`: `https://staging.api.macro-ai.russoakham.dev`
  - `VITE_APP_ENV`: `staging`

### Production

- Amplify branch: `main`
- Frontend URL: `https://macro-ai.russoakham.dev`
- Environment vars:
  - `VITE_API_URL`: `https://macro-ai.russoakham.dev`
  - `VITE_APP_ENV`: `production`

---

## Deployment Flow Diagram

```text
┌─────────────────────────────────────────────┐
│  GitHub Push / PR Created                   │
└────────────────┬────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    PR Preview        Push to main/develop
         │                │
         ├─→ Build Docker ├─→ Build Docker
         │                │
         ├─→ Pulumi       ├─→ Pulumi
         │  (pr-{n})      │  (staging/prod)
         │                │
         ├─→ Frontend ◄───┤ Frontend
         │  (NEW!)        │ (NEW!)
         │                │
         └─→ Deployed     └─→ Deployed
```

---

## Key Benefits

| Aspect                     | Benefit                                                |
| -------------------------- | ------------------------------------------------------ |
| **Separation of Concerns** | Infrastructure and app deployment are independent      |
| **Reliability**            | Explicit polling ensures we wait for actual deployment |
| **Speed**                  | Happens in parallel with backend availability checks   |
| **Reusability**            | One workflow serves all three environments             |
| **Debugging**              | Comprehensive logs at each stage                       |
| **Flexibility**            | Manual deployment API = no git dependency              |
| **Cost**                   | No additional infrastructure needed                    |

---

## Testing Checklist

### PR Preview Testing

- [ ] Create new PR to trigger workflow
- [ ] Verify `deploy-frontend` job runs after `deploy-full-stack`
- [ ] Verify frontend URL is accessible
- [ ] Verify React app loads (not Amplify welcome page)
- [ ] Verify environment variables are set
- [ ] Verify API connectivity works
- [ ] Test closing PR triggers cleanup

### Staging Testing

- [ ] Push to `develop` branch
- [ ] Verify `deploy-frontend-staging` runs
- [ ] Verify staging frontend URL loads app
- [ ] Verify staging environment variables

### Production Testing

- [ ] Push to `main` branch
- [ ] Verify `deploy-frontend-production` runs
- [ ] Verify production frontend URL loads app
- [ ] Verify production environment variables

---

## Troubleshooting

### Frontend URL works but shows Amplify welcome page

**Cause**: Zip file wasn't properly uploaded or doesn't contain index.html  
**Solution**: Check workflow logs for upload error, verify zip structure

### Build fails during pnpm install

**Cause**: Dependency issue or memory  
**Solution**: Check node_modules cache, review pnpm-lock.yaml changes

### Deployment times out (>30 min)

**Cause**: Amplify build or deployment is slow  
**Solution**: Check Amplify console logs, verify buildspec.yml, increase timeout if needed

### Environment variables not set in frontend

**Cause**: Variables not passed to reusable workflow  
**Solution**: Verify Pulumi outputs, check workflow inputs/outputs mapping

---

## Next Steps

1. **Test on PR #90** (or existing PR to get immediate feedback)
2. **Monitor first few deployments** across all three environments
3. **Gather user feedback** on deployment times and reliability
4. **Document troubleshooting guide** based on real issues encountered
5. **Optimize timing** if deployments are too slow

---

## Files Changed

- ✅ Created: `.github/workflows/reusable-deploy-frontend-amplify.yml` (362 lines)
- ✅ Modified: `.github/workflows/deploy-pr-preview-pulumi.yml` (+20 lines)
- ✅ Modified: `.github/workflows/deploy-staging-pulumi.yml` (+15 lines)
- ✅ Modified: `.github/workflows/deploy-production-pulumi.yml` (+22 lines)

**Total Changes**: 413 lines added/modified across 4 files

---

## Implementation Status

✅ **Phase 1 - Reusable Workflow**: COMPLETE
✅ **Phase 2 - Integration**: COMPLETE (all three environments)
✅ **Phase 3 - Testing**: READY (awaiting real PR)
⏳ **Phase 4 - Monitoring**: PENDING

**Ready for deployment and testing!**

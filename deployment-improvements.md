# Deployment Infrastructure Improvements

This document tracks non-critical improvements identified during CodeRabbit AI review of PR #39 (Phase 5 EC2 Migration).
These improvements are organized by priority and can be implemented in future iterations.

## Important Priority Items

### Authentication & Session Management

- **Apply COOKIE_DOMAIN configuration**: Update `apps/express-api/src/features/auth/auth.controller.ts` to use COOKIE_DOMAIN
  in res.cookie calls
  - Add domain option: `domain: cookieDomain !== 'localhost' ? cookieDomain : undefined`
  - Apply to all three cookies: macro-ai-accessToken, macro-ai-refreshToken, macro-ai-synchronize
  - Add unit tests to verify domain field presence when cookieDomain !== 'localhost'

### Monitoring & Metrics Reliability

- **Replace res.end override with on-finished package**: In `apps/express-api/src/middleware/monitoring-metrics.ts`
  - Install `on-finished` package: `pnpm add on-finished`
  - Replace res.end override with `onFinished(res, callback)` for more reliable response tracking
  - Handles streaming responses and edge cases better than manual override

### Configuration Loading Robustness

- **Fix build-time detection boolean parsing**: In `apps/express-api/src/utils/load-config.ts`
  - Change `!process.env.RUNTIME_CONFIG_REQUIRED` to `!isTruthy(process.env.RUNTIME_CONFIG_REQUIRED)`
  - Ensures "false"/"0" strings are treated as false values instead of truthy

### Type Safety & Validation

- **Add validation to Lambda response parsing**: In CLI tools like `infrastructure/src/cli/performance-optimization-cli.ts`
  - Replace unsafe type assertions with validated conversions
  - Add runtime validation for Lambda response structure before casting
  - Include error handling with clear debugging information

- **Add input validation to parseInt calls**: Throughout CLI tools
  - Validate numeric inputs before using parseInt
  - Add fallback to sensible defaults for invalid input
  - Prevent NaN values in time calculations

### Data Integrity

- **Improve metric calculation edge cases**: In performance CLI tools
  - Handle undefined/empty Datapoints arrays properly
  - Prevent NaN/Infinity values in calculations
  - Use conditional logic instead of division by zero fallbacks

## Minor Priority Items

### CLI Usability

- **Document TypeScript CLI execution**: Update README files for CLI tools
  - Add tsx/ts-node installation instructions
  - Provide multiple execution options (tsx, ts-node, compiled JS)
  - Remove chmod-only instructions that don't work for .ts files

### CORS Configuration

- **Apply normalized CORS origins**: In `.github/workflows/deploy-preview.yml`
  - Export normalized CORS_ORIGINS variable to deployment script
  - Remove duplicate CORS_ALLOWED_ORIGINS environment expression
  - Prevent trailing slash inconsistencies

### Code Robustness

- **Add missing command implementations**: In `infrastructure/scripts/deploy-app.sh`
  - Implement rollback, cleanup, and health commands
  - Add proper error handling and validation
  - Follow Capistrano-style deployment patterns

### Infrastructure Scripts

- **Enhance deployment script reliability**: Various infrastructure scripts
  - Add comprehensive error handling
  - Improve logging and status reporting
  - Add validation for required parameters

## Implementation Guidelines

### Batch Processing Approach

1. **Phase 1**: Address Important priority items that affect core functionality
2. **Phase 2**: Implement Minor priority items for improved user experience
3. **Phase 3**: Optional optimizations and nice-to-have improvements

### Testing Requirements

- All authentication changes require unit tests
- Monitoring changes need integration testing
- CLI improvements should include usage documentation
- Infrastructure changes require deployment testing

### Documentation Updates

- Update relevant README files after CLI improvements
- Add troubleshooting guides for common issues
- Document new configuration options and their effects

## Notes

- This document will be updated as improvements are implemented
- Priority levels may be adjusted based on user feedback and operational needs
- Some improvements may be combined into single PRs for efficiency
- All changes should maintain backward compatibility where possible

---

**Last Updated**: August 17, 2025  
**Related PR**: #39 - Phase 5 EC2-Based Preview Deployments  
**Review Source**: CodeRabbit AI systematic review (58 actionable comments)

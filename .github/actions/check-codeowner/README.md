# Check Code Owner Action

A composite GitHub Action that validates whether a user is listed as a code owner in the repository's `.github/CODEOWNERS`
file.

## Purpose

This action is used by the macro-ai deployment workflows to enforce CODEOWNERS-based access control for:

- Automatic PR preview deployments (same-repo + code owner validation)
- Manual deployment workflows (code owner validation)
- Infrastructure teardown operations (code owner validation)

## Usage

### For Pull Request Workflows

```yaml
jobs:
  check-ownership:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
      is-owner: ${{ steps.codeowner-check.outputs.is-owner }}
    steps:
      - name: Check if PR author is code owner
        id: codeowner-check
        uses: ./.github/actions/check-codeowner
        with:
          mode: 'pr'

  deploy:
    needs: check-ownership
    if: ${{ needs.check-ownership.outputs.is-owner == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy preview
        run: echo "Deploying for code owner..."
```

### For Manual Workflows

```yaml
jobs:
  validate-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check if actor is code owner
        id: codeowner-check
        uses: ./.github/actions/check-codeowner
        with:
          mode: 'manual'

      - name: Fail if not code owner
        if: ${{ steps.codeowner-check.outputs.is-owner != 'true' }}
        run: |
          echo "::error::Only code owners can run this workflow"
          exit 1
```

## Inputs

| Input      | Description                                                      | Required | Default                   |
| ---------- | ---------------------------------------------------------------- | -------- | ------------------------- |
| `mode`     | Validation mode: `pr` for PR author, `manual` for workflow actor | Yes      | `pr`                      |
| `base-ref` | Base repository reference to read CODEOWNERS from                | No       | Repository default branch |

## Outputs

| Output        | Description                                              |
| ------------- | -------------------------------------------------------- |
| `is-owner`    | Whether the target user is a code owner (`true`/`false`) |
| `target-user` | The username that was validated                          |

## Security Features

- **Trusted Source**: Always reads CODEOWNERS from the base repository ref, not from potentially untrusted PR branches
- **Minimal Permissions**: Requires only `contents: read` and `pull-requests: read` (for PR mode)
- **Case Insensitive**: Normalizes usernames to lowercase for reliable comparison
- **Validation**: Validates inputs and provides clear error messages

## Validation Logic

1. Determines target user based on mode:
   - `pr` mode: Uses `github.event.pull_request.user.login`
   - `manual` mode: Uses `github.actor`

2. Reads `.github/CODEOWNERS` from the base repository reference

3. Parses code owners by:
   - Ignoring comments and empty lines
   - Extracting `@username` patterns
   - Normalizing to lowercase

4. Compares target user against parsed owners list

5. Returns `true` if user is found, `false` otherwise

## Error Handling

- Fails if CODEOWNERS file is not found
- Fails if invalid mode is specified
- Fails if PR mode is used outside pull_request events
- Provides descriptive error messages via GitHub Actions annotations

## Example CODEOWNERS Support

```markdown
# Infrastructure and deployment code
infrastructure/ @RussOakham

# GitHub Actions workflows
.github/workflows/ @RussOakham

# Default ownership
* @RussOakham
```

The action extracts all `@username` patterns and validates against any of them, supporting both specific path ownership
and catch-all patterns.

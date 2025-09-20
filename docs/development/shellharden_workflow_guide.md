# Shellharden Workflow Integration Guide

## Overview

Shellharden is an excellent tool for automatically fixing shell syntax issues in GitHub Actions workflows. It can detect
and fix common problems like unquoted variables that can cause globbing and word splitting issues.

## Installation

```bash
# On macOS
brew install shellharden

# On Linux (via Cargo)
cargo install shellharden
```

## How It Works

Shellharden analyzes shell scripts and automatically applies fixes for:

- **SC2086**: Double quote to prevent globbing and word splitting
- **SC2129**: Use block redirects instead of multiple echo statements
- **SC2001**: Use parameter expansion instead of command substitution

## Usage Examples

### 1. Check if fixes are needed

```bash
shellharden --check .github/workflows/*.yml
```

### 2. See suggested changes

```bash
shellharden --suggest .github/workflows/enhanced-testing.yml
```

### 3. Apply fixes to a single file

```bash
shellharden --replace .github/workflows/enhanced-testing.yml
```

### 4. Apply fixes to all workflow files

```bash
for file in .github/workflows/*.yml; do 
  shellharden --replace "$file"
done
```

## Example Fix

**Before (problematic):**

```bash
echo "Files in $GITHUB_WORKSPACE:"
ls $GITHUB_WORKSPACE
```

**After (shellharden fix):**

```bash
echo "Files in $GITHUB_WORKSPACE:"
ls "$GITHUB_WORKSPACE"
```

## Integration Strategy

### Option 1: Manual Application

1. Run `shellharden --suggest` on each workflow file
2. Review the suggested changes
3. Apply with `shellharden --replace` for files you approve

### Option 2: Automated Script

Create a script that:

1. Extracts shell scripts from workflow files
2. Applies shellharden to fix syntax issues
3. Replaces the shell portions back into the YAML

### Option 3: Pre-commit Hook

Add shellharden to your git pre-commit hooks to automatically fix shell syntax before commits.

## Limitations

- Shellharden works best on pure shell scripts
- For YAML files with embedded shell scripts, manual review is recommended
- Always test workflows after applying shellharden fixes
- Some fixes may require manual review if they change the script's intended behavior

## Best Practices

1. **Always review changes** before committing
2. **Test workflows** after applying fixes
3. **Use `--suggest` first** to see what will be changed
4. **Apply to one file at a time** initially to understand the changes
5. **Keep backups** of original files until you're confident with the fixes

## Workflow Integration Example

```yaml
# Add this step to your workflow to check for shell issues
- name: Check shell syntax
  run: |
    for file in .github/workflows/*.yml; do
      if ! shellharden --check "$file"; then
        echo "❌ Shell syntax issues found in $file"
        shellharden --suggest "$file"
        exit 1
      fi
    done
    echo "✅ All workflow files pass shell syntax checks"
```

## Conclusion

Shellharden is a powerful tool that can significantly speed up the process of fixing shell syntax issues in GitHub Actions
workflows. While it requires careful review to ensure fixes don't break intended functionality, it can automatically
resolve most common shell quoting and syntax issues.

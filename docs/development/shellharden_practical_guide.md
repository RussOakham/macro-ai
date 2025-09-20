# Shellharden Practical Guide for GitHub Actions

## What We Learned

### ✅ Shellharden Works Great for Shell Scripts

Shellharden successfully fixes shell syntax issues like:

- **SC2086**: Double quote to prevent globbing and word splitting
- **SC2129**: Use block redirects instead of multiple echo statements
- **SC2001**: Use parameter expansion instead of command substitution

### ⚠️ But Has Limitations with YAML Files

When applied directly to workflow YAML files, shellharden:

- ✅ Fixes shell script portions correctly
- ❌ Can break YAML syntax by adding quotes where they shouldn't be
- ❌ May modify GitHub Actions expressions incorrectly

## Recommended Approach

### Option 1: Manual Application (Recommended)

1. **Identify problematic lines** using actionlint
2. **Apply shellharden fixes manually** to shell script portions only
3. **Review each change** before committing

**Example Manual Fix:**

```bash
# Before (problematic)
timeout ${timeout_seconds}s pnpm vitest run

# After (shellharden fix)
timeout "${timeout_seconds}"s pnpm vitest run
```

### Option 2: Targeted Script (For Advanced Users)

Create a script that:

1. Extracts shell scripts from YAML files
2. Applies shellharden to the shell portions only
3. Allows manual review before applying changes

### Option 3: Workflow Integration

Add shellharden checks to your CI pipeline:

```yaml
- name: Check shell syntax
  run: |
    for file in .github/workflows/*.yml; do
      if ! shellharden --check "$file" 2>/dev/null; then
        echo "⚠️  Shell issues found in $file"
        echo "Suggested fixes:"
        shellharden --suggest "$file"
      fi
    done
```

## Key Findings from Our Test

### ✅ Successfully Fixed Issues

- Variable quoting: `$VAR` → `"$VAR"`
- File path quoting: `$GITHUB_WORKSPACE/file` → `"$GITHUB_WORKSPACE"/file`
- Command arguments: `cmd $arg` → `cmd "$arg"`
- Test conditions: `[ $var -gt $other ]` → `[ "$var" -gt "$other" ]`

### ❌ Issues to Avoid

- Don't apply `--replace` to entire YAML files
- YAML output values should not be quoted
- GitHub Actions expressions like `${{ matrix.name }}` should not be quoted
- Review all changes before committing

## Best Practices

1. **Start Small**: Apply to one workflow file first
2. **Review Changes**: Always check shellharden suggestions
3. **Test Workflows**: Run workflows after applying fixes
4. **Use `--suggest` First**: See what will be changed before applying
5. **Manual Review**: Some fixes may need human judgment

## Example Workflow Integration

```bash
# Check for shell issues
shellharden --check .github/workflows/*.yml

# See suggested fixes for a specific file
shellharden --suggest .github/workflows/enhanced-testing.yml

# Apply to shell script portions only
# (Manual review required)
```

## Conclusion

Shellharden is a powerful tool that can significantly improve shell syntax in GitHub Actions workflows, but it requires
careful application. The manual approach with `--suggest` and `--transform` provides the best balance of automation and control.

**Recommendation**: Use shellharden as a suggestion tool rather than an automatic fixer for workflow files. Apply fixes
manually after reviewing the suggestions.

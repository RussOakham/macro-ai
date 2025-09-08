# @repo/config-oxlint

Shared Oxlint configurations for the Macro AI monorepo.

## Usage

### Basic Setup

Create an `.oxlintrc.json` file in your package root:

```json
{
	"extends": ["./packages/config-oxlint/base.json"]
}
```

### Advanced Setup

For packages in the workspace, extend from the relative path:

```json
{
	"extends": ["../config-oxlint/base.json"],
	"rules": {
		// Your package-specific overrides
	}
}
```

## Available Configurations

### `base.json`

- **Extends**: `recommended`
- **Plugins**: TypeScript, Unicorn, Import, JSDoc, Promise, Oxc
- **Rules**: Comprehensive set covering code quality, style, and best practices
- **Overrides**: Test files and config files have relaxed rules

## Customization

You can override any rules in your package's `.oxlintrc.json`:

```json
{
	"extends": ["../config-oxlint/base.json"],
	"rules": {
		"no-console": "off",
		"@typescript-eslint/no-explicit-any": "warn"
	}
}
```

## Integration with ESLint

This configuration is designed to work alongside ESLint. Oxlint handles fast, basic linting while ESLint provides deeper analysis and custom rules.

## Scripts

- `format` - Check formatting
- `format:fix` - Fix formatting issues

# Cursor IDE Configuration

This directory contains project-specific Cursor IDE configuration and rules.

## Structure

```text
.cursor/
├── README.md                    # This file
├── settings.json               # Main Cursor settings (project-agnostic)
├── rules/
│   ├── project-rules.md        # Project-specific rules and conventions
│   └── generic-rules.md        # Generic development rules (project-agnostic)
└── memories/
    ├── project-structure.md    # Project structure and technology stack
    ├── testing-requirements.md # Testing framework and requirements
    ├── development-workflow.md # Development workflow and code quality
    ├── aws-deployment.md       # AWS deployment and infrastructure
    └── troubleshooting.md      # Troubleshooting and investigation approaches
```

## Migration from IDE Local Settings

This structure replaces IDE-local rules and memories with:

### Project-Specific Items (moved to `.cursor/`)

- **Rules**: Monorepo structure, technology stack, project-specific conventions
- **Memories**: All project-specific context and decisions

### Generic Items (refactored to be project-agnostic)

- **Settings**: MCP tool preferences, workflow patterns, security practices
- **Generic Rules**: Development principles that apply to any project

## Usage

- **Project Rules**: Referenced automatically by Cursor for project-specific guidance
- **Generic Rules**: Provide reusable development principles
- **Memories**: Store project context and decisions for future reference
- **Settings**: Configure Cursor behavior and tool preferences

## Benefits

1. **Version Control**: All configuration is tracked in git
2. **Team Sharing**: Other developers get the same configuration
3. **Portability**: Easy to apply to other projects
4. **Organization**: Clear separation between project-specific and generic rules
5. **Maintainability**: Easier to update and manage configuration

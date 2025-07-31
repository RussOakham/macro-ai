# Macro AI Client UI

Modern React frontend application for the Macro AI platform, built with React 19, TanStack Router, and Tailwind CSS.

## 🚀 Features

- **Modern React Stack**: React 19 with React Compiler for automatic optimization
- **Type-Safe Routing**: TanStack Router with file-based routing and data loading
- **Server State Management**: TanStack Query for intelligent caching and synchronization
- **Design System**: Shadcn/ui components with Tailwind CSS and dark/light themes
- **Authentication**: Complete auth flows with AWS Cognito integration
- **AI Chat Interface**: Real-time streaming chat with OpenAI integration
- **Type Safety**: Full TypeScript integration with auto-generated API client

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm package manager
- Running Express API server

### Getting Started

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start development server
pnpm --filter @repo/client-ui dev

# Or from this directory
pnpm dev
```

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm test         # Run tests
pnpm test:ui      # Run tests with UI
pnpm lint         # Lint code
pnpm type-check   # TypeScript type checking
```

## 🏗️ Architecture

### Technology Stack

- **React 19**: Latest React with React Compiler optimization
- **TanStack Router**: Type-safe file-based routing with data loading
- **TanStack Query**: Server state management with intelligent caching
- **Tailwind CSS**: Utility-first CSS framework with design system
- **Shadcn/ui**: High-quality accessible components
- **Vite**: Fast build tool and development server
- **TypeScript**: Full type safety throughout the application

### Project Structure

```text
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication-specific components
│   └── ui/             # Base UI components (Shadcn/ui)
├── features/           # Feature-specific components and logic
├── lib/                # Utility functions and configurations
├── routes/             # TanStack Router route definitions
└── main.tsx            # Application entry point
```

## 📚 Documentation

For comprehensive documentation and development guides:

- **[UI Development Guidelines](../../docs/development/ui-development.md)** - UI development patterns and best practices
- **[Authentication System](../../docs/features/authentication/README.md)** - Auth integration and flows
- **[Chat System](../../docs/features/chat-system/README.md)** - AI chat implementation
- **[API Client Usage](../../docs/features/api-client/usage-examples.md)** - API integration examples
- **[Development Setup](../../docs/getting-started/development-setup.md)** - Complete setup guide
- **[Coding Standards](../../docs/development/coding-standards.md)** - Code style and conventions

## 🔧 Configuration

### Environment Variables

```bash
# Required environment variables
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=your-32-character-api-key
```

### Theme Configuration

The application supports light/dark/system themes with persistent storage:

```typescript
// Theme provider configuration
<ThemeProvider defaultTheme="system" storageKey="macro-ai-theme">
  <App />
</ThemeProvider>
```

## 🧪 Testing

The application uses Vitest for testing with comprehensive test utilities:

```bash
# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## 📦 Related Packages

- `@repo/macro-ai-api-client` - Auto-generated TypeScript API client
- `@repo/config-typescript` - Shared TypeScript configurations
- `@repo/config-eslint` - Shared ESLint configurations

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/RussOakham/macro-ai/issues)
- **Documentation**: [Complete Documentation](../../docs/README.md)
- **Development Guide**: [Getting Started](../../docs/getting-started/README.md)

```js
export default tseslint.config({
	languageOptions: {
		// other options...
		parserOptions: {
			project: ['./tsconfig.node.json', './tsconfig.app.json'],
			tsconfigRootDir: import.meta.dirname,
		},
	},
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
	// Set the react version
	settings: { react: { version: '19.0' } },
	plugins: {
		// Add the react plugin
		react,
	},
	rules: {
		// other rules...
		// Enable its recommended rules
		...react.configs.recommended.rules,
		...react.configs['jsx-runtime'].rules,
	},
})
```

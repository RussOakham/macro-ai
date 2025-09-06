/**
 * Type-safe ESLint configuration for the macro-ai monorepo
 *
 * This module provides TypeScript-first ESLint configurations using the flat config format.
 * All configurations are fully typed and provide excellent developer experience.
 */

export { config, configs } from './eslint.js'

// Re-export types for better TypeScript support
export type { ConfigWithExtends } from 'typescript-eslint'

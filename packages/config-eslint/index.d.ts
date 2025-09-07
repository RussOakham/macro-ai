/**
 * TypeScript declarations for ESLint configurations
 */

import type { ConfigWithExtends } from 'typescript-eslint'
import type { Linter } from 'eslint'

export type ESLintConfig = Linter.Config

/**
 * Base ESLint configuration object with multiple rule sets
 */
export interface BaseConfig {
	/** Core ESLint + TypeScript + Turborepo configurations */
	core: ConfigWithExtends[]
	/** Strict TypeScript type checking */
	strictTyping: ConfigWithExtends[]
	/** Code quality and best practices */
	codeQuality: ConfigWithExtends[]
	/** Promise handling and async code */
	promises: ConfigWithExtends[]
	/** Node.js specific rules */
	node: ConfigWithExtends[]
	/** Security-focused rules */
	security: ConfigWithExtends[]
	/** Import/export management */
	imports: ConfigWithExtends[]
	/** Testing with Vitest */
	testing: ConfigWithExtends[]
	/** Documentation and JSDoc */
	documentation: ConfigWithExtends[]
	/** Custom rules for project preferences */
	customRules: ConfigWithExtends[]
	/** JavaScript-specific overrides */
	javascript: ConfigWithExtends[]
}

/**
 * React-specific ESLint configuration object
 */
export interface ReactConfig {
	/** React core configurations */
	core: ConfigWithExtends[]
	/** React + TypeScript configurations */
	typescript: ConfigWithExtends[]
	/** React accessibility rules */
	accessibility: ConfigWithExtends[]
	/** React testing configurations */
	testing: ConfigWithExtends[]
	/** React performance rules */
	performance: ConfigWithExtends[]
}

/**
 * Node.js-specific ESLint configuration object
 */
export interface NodeConfig {
	/** Node.js core configurations */
	core: ConfigWithExtends[]
	/** Node.js + TypeScript configurations */
	typescript: ConfigWithExtends[]
	/** Node.js security rules */
	security: ConfigWithExtends[]
}

/**
 * Security-focused ESLint configuration object
 */
export interface SecurityConfig {
	/** Security core configurations */
	core: ConfigWithExtends[]
	/** Security + TypeScript configurations */
	typescript: ConfigWithExtends[]
}

/**
 * Prettier integration ESLint configuration object
 */
export interface PrettierConfig {
	/** Prettier core configurations */
	core: ConfigWithExtends[]
}

/**
 * Complete configuration object containing all available configs
 */
export interface ConfigObject {
	/** Base ESLint configurations */
	base: BaseConfig
	/** React-specific configurations */
	react: ReactConfig
	/** Node.js-specific configurations */
	node: NodeConfig
	/** Security-focused configurations */
	security: SecurityConfig
	/** Prettier integration configurations */
	prettier: PrettierConfig
}

/**
 * Utility function to combine multiple ESLint configurations
 * @param configs - Configuration arrays to combine
 * @returns Flattened array of configurations
 */
export function config(...configs: ConfigWithExtends[][]): ConfigWithExtends[]

/**
 * Pre-configured ESLint configurations for different environments
 */
export const configs: ConfigObject

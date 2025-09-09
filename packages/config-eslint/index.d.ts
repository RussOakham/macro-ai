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
	/** Security-focused rules */
	security: ConfigWithExtends[]
	/** Testing with Vitest */
	testing: ConfigWithExtends[]
	/** JavaScript-specific overrides */
	javascript: ConfigWithExtends[]
}

/**
 * Oxlint-specific ESLint configuration object
 */
export interface OxlintConfig {
	/** Oxlint recommended configurations */
	recommended: ConfigWithExtends[]
	/** Oxlint configurations from .oxlintrc.json */
	fromBaseConfig: ConfigWithExtends[]
	/** Oxlint configurations from a config file */
	fromConfigFile: (configPath: string) => ConfigWithExtends[]
}

/**
 * React-specific ESLint configuration object
 */
export interface ReactConfig {
	/** React recommended configurations */
	recommended: ConfigWithExtends[]
}

/**
 * Security-focused ESLint configuration object
 */
export interface SecurityConfig {
	/** Security recommended configurations */
	recommended: ConfigWithExtends[]
}

/**
 * Complete configuration object containing all available configs
 */
export interface ConfigObject {
	/** Base ESLint configurations */
	base: BaseConfig
	/** React-specific configurations */
	react: ReactConfig
	/** Oxlint-specific configurations */
	oxlint: OxlintConfig
	/** Security-focused configurations */
	security: SecurityConfig
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

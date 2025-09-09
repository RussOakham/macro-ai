/**
 * Barrel file for the ESLint configurations.
 *
 * @typedef {import("typescript-eslint").ConfigWithExtends} ConfigWithExtends
 * @typedef {import("eslint").Linter.Config} ESLintConfig
 */

/**
 * @typedef {Object} BaseConfig
 * @property {ConfigWithExtends[]} core - Core ESLint + TypeScript + Turborepo configurations
 * @property {ConfigWithExtends[]} strictTyping - Strict TypeScript type checking
 * @property {ConfigWithExtends[]} codeQuality - Code quality and best practices
 * @property {ConfigWithExtends[]} security - Security-focused rules
 * @property {ConfigWithExtends[]} testing - Testing with Vitest
 * @property {ConfigWithExtends[]} javascript - JavaScript-specific overrides
 */

/**
 * @typedef {Object} OxlintConfig
 * @property {ConfigWithExtends[]} recommended - Oxlint recommended configurations
 * @property {ConfigWithExtends[]} fromBaseConfig - Oxlint configurations from .oxlintrc.json
 * @property {ConfigWithExtends[]} fromConfigFile - Oxlint configurations from a config file
 */

/**
 * @typedef {Object} ReactConfig
 * @property {ConfigWithExtends[]} recommended - React recommended configurations
 */

/**
 * @typedef {Object} SecurityConfig
 * @property {ConfigWithExtends[]} recommended - Security recommended configurations
 */

/**
 * @typedef {Object} ConfigObject
 * @property {BaseConfig} base - Base ESLint configurations
 * @property {ReactConfig} react - React-specific configurations
 * @property {OxlintConfig} oxlint - Oxlint configurations
 * @property {SecurityConfig} security - Security-focused configurations
 */

import { base } from './src/base.js'
import { reactConfig } from './src/react.js'
import { oxlintConfig } from './src/oxlint.js'
import { securityConfig } from './src/security.js'

/**
 * Simple config utility for combining configurations
 * @param {...ConfigWithExtends[]} configs - Configuration arrays to combine
 * @returns {ConfigWithExtends[]} Flattened array of configurations
 */
const config = (...configs) => configs.flat()

/**
 * Pre-configured ESLint configurations for different environments
 * @type {ConfigObject}
 */
const configs = {
	base,
	react: reactConfig,
	oxlint: oxlintConfig,
	security: securityConfig,
}

export { config, configs }

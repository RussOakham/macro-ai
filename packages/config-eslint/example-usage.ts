/**
 * Example usage demonstrating type inference with the ESLint config package
 */

import { configs, config } from '@repo/config-eslint'

// Type inference works here - TypeScript knows `configs.base` is of type `BaseConfig`
const baseCoreConfig = configs.base.core
const baseStrictTyping = configs.base.strictTyping
const baseCodeQuality = configs.base.codeQuality

// Type inference works here - TypeScript knows `configs.react` is of type `ReactConfig`
const reactCoreConfig = configs.react.core
const reactTypescriptConfig = configs.react.typescript

// Type inference works here - TypeScript knows `configs.node` is of type `NodeConfig`
const nodeCoreConfig = configs.node.core
const nodeSecurityConfig = configs.node.security

// Type inference works here - TypeScript knows `configs.security` is of type `SecurityConfig`
const securityCoreConfig = configs.security.core

// Type inference works here - TypeScript knows `configs.prettier` is of type `PrettierConfig`
const prettierCoreConfig = configs.prettier.core

// The config utility function also has proper type inference
const combinedConfig = config(
	baseCoreConfig,
	baseStrictTyping,
	reactCoreConfig,
	nodeCoreConfig,
)

// Export for demonstration
export {
	baseCoreConfig,
	baseStrictTyping,
	baseCodeQuality,
	reactCoreConfig,
	reactTypescriptConfig,
	nodeCoreConfig,
	nodeSecurityConfig,
	securityCoreConfig,
	prettierCoreConfig,
	combinedConfig,
}

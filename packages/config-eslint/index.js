/**
 * Barrel file for the ESLint configurations.
 */

import { base } from './src/base.js'
import { reactConfig } from './src/react.js'
import { nodeConfig } from './src/node.js'
import { securityConfig } from './src/security.js'
import { prettierConfig } from './src/prettier.js'

// Simple config utility for combining configurations
const config = (...configs) => configs.flat()

// Create configs object from modular configs
const configs = {
	base,
	react: reactConfig,
	node: nodeConfig,
	security: securityConfig,
	prettier: prettierConfig,
}

export { config, configs }

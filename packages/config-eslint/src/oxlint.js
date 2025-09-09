import oxlintPlugin from 'eslint-plugin-oxlint'
import oxlintConfigJson from '../.oxlintrc.json' with { type: 'json' }

const oxlintConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		...oxlintPlugin.configs['flat/recommended'],
	],
	fromBaseConfig:
		/** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
			...oxlintPlugin.buildFromOxlintConfig(oxlintConfigJson),
		],

	// fromConfigFile - utility function to pass in a config path
	/**
	 * @param {string} configPath - The path to the Oxlint config file
	 * @returns {import("typescript-eslint").ConfigWithExtends[]} - The Oxlint config
	 */
	fromConfigFile: (configPath) => {
		try {
			return [...oxlintPlugin.buildFromOxlintConfigFile(configPath)]
		} catch {
			// If the config file doesn't exist, fall back to recommended config
			return [...oxlintPlugin.configs['flat/recommended']]
		}
	},
}

export { oxlintConfig }

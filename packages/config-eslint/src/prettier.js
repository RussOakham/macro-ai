// @ts-check
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintConfigPrettier from 'eslint-config-prettier'

const prettierConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		prettierRecommended,
		eslintConfigPrettier,
	],
}

export { prettierConfig }

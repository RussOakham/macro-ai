// @ts-check
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintConfigPrettier from 'eslint-config-prettier'

/** @type {import('eslint').Linter.FlatConfig[]} */
const prettierConfig = [prettierRecommended, eslintConfigPrettier]

export default prettierConfig

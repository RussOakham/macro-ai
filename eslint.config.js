import * as repoConfig from './packages/config-eslint/index.js'

/** @type {import("@typescript-eslint/utils").TSESLint.FlatConfig.Config} */
export default repoConfig.config(...repoConfig.configs.base)

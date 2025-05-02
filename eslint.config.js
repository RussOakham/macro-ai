import * as repoConfig from '@repo/config-eslint'

/** @type {import("@typescript-eslint/utils").TSESLint.FlatConfig.Config} */
export default repoConfig.config(...repoConfig.configs.base)

import * as repoConfig from "@repo/config-eslint";

export default repoConfig.config({
  ...repoConfig.configs.base,
  ...repoConfig.configs.react,
});

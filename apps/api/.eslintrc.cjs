/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["@repo/eslint-config/index.js", "prettier"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
  },
  root: true,
};

module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/dist/**/*",
  ],
  plugins: [
    "@typescript-eslint",
  ],
  rules: {
    "quotes": ["warn", "double"],
    "semi": ["warn", "always"],
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
  },
};

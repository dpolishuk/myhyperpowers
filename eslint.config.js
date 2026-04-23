const js = require("@eslint/js")

module.exports = [
  {
    files: ["tests/**/*.js", "scripts/**/*.js", "hooks/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-useless-escape": "off",
      "no-unused-vars": "off",
      "preserve-caught-error": "off",
    },
  },
  {
    ignores: ["node_modules/**", ".agents/**", "codex-*/**", "packages/**"],
  },
]

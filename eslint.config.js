import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist", "coverage", "node_modules", "apps/api/prisma/generated"]
  },
  {
    files: ["**/*.{ts,vue}"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: { vue },
    rules: {
      ...vue.configs.base.rules,
      "vue/comment-directive": "off"
    }
  }
);

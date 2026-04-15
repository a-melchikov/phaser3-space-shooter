import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ["dist/**", "node_modules/**", "backend/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: currentDir
      },
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        performance: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
];

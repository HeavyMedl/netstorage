import eslintPlugin from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['**/*.d.ts', '**/coverage', '**/dist', '.history'],
  },
  // Base JavaScript rules
  eslintPlugin.configs.recommended,
  // TypeScript rules
  ...typescriptEslint.configs.recommended,
  // Prettier disables formatting-related rules
  eslintConfigPrettier,
  // JavaScript/TypeScript files
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptEslint.parser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Add shared JS/TS rules here
    },
  },
];

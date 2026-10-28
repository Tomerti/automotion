import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'e2e',
      'docs',
      '.superpowers',
      '.claude',
      'playwright-report',
      'test-results',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    plugins: { 'react-refresh': reactRefresh },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] },
  },
  prettier,
);

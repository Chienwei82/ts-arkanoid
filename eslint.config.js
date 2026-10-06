import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { reactRefresh } from 'eslint-plugin-react-refresh'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'always'],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },

  // Architecture guard-rail: gameplay, state and persistence stay framework-free
  // so they remain testable in Node and reusable behind any renderer.
  {
    files: [
      'src/core/**/*.ts',
      'src/entities/**/*.ts',
      'src/levels/**/*.ts',
      'src/systems/**/*.ts',
      'src/config/**/*.ts',
      'src/utils/**/*.ts',
      'src/bridge/**/*.ts',
      'src/platform/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: 'The engine must not depend on three.js.' },
            { name: 'react', message: 'The engine must not depend on React.' },
          ],
          patterns: [
            {
              group: ['three/*', 'react', 'react-dom', 'react/*'],
              message: 'Use src/rendering (three) or src/ui (React) instead.',
            },
          ],
        },
      ],
    },
  },

  // React layers: hooks rules plus the Vite fast-refresh contract.
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/App.tsx', 'src/main.tsx'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    plugins: { 'react-refresh': reactRefresh.plugin },
    rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] },
  },

  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  {
    files: ['**/*.js', 'vite.config.ts', 'vitest.config.ts'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },

  // Dev-only scripts (song curation): they print to stdout on purpose.
  {
    files: ['tools/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  prettier,
)

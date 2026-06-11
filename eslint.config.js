import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

/*
 * Layer rules (CLAUDE.md §4): features → api/state → hooks/utils/domain/config.
 * Enforced twice because the two rules see different things:
 *  - import/no-restricted-paths resolves relative imports between real paths
 *  - no-restricted-imports matches the unresolved `@/…` alias specifiers
 */
const layerZones = [
  // the data core never imports from features or the app shell
  { target: './src/api', from: './src/features' },
  { target: './src/api', from: './src/app' },
  { target: './src/api', from: './src/components' },
  { target: './src/state', from: './src/features' },
  { target: './src/state', from: './src/app' },
  { target: './src/state', from: './src/components' },
  // shared components are leaves: hooks/utils/domain/styles only
  { target: './src/components', from: './src/features' },
  { target: './src/components', from: './src/api' },
  { target: './src/components', from: './src/state' },
  { target: './src/components', from: './src/app' },
  // domain and utils import nothing internal
  { target: './src/domain', from: './src' },
  { target: './src/utils', from: './src' },
  // hooks may import utils (and domain registries) only
  { target: './src/hooks', from: './src/features' },
  { target: './src/hooks', from: './src/components' },
  { target: './src/hooks', from: './src/api' },
  { target: './src/hooks', from: './src/state' },
  { target: './src/hooks', from: './src/app' },
]

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', 'src/api/types.gen.ts'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        node: { extensions: ['.js', '.mjs', '.ts', '.tsx'] },
      },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...jsxA11y.flatConfigs.recommended.rules,

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'Use string literal unions or `as const` objects instead of enums (CLAUDE.md §5).',
        },
      ],
      'react/no-danger': 'error',
      'react/no-array-index-key': 'error',

      'import/first': 'error',
      'import/no-duplicates': 'error',
      'import/no-default-export': 'error',
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-restricted-paths': ['error', { zones: layerZones }],
    },
  },
  // alias-specifier layer enforcement, per restricted directory
  {
    files: ['src/api/**/*.{ts,tsx}', 'src/state/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/app/*', '@/components/*'],
              message:
                'The data core never imports from features, components, or the app shell (CLAUDE.md §4).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/api/*', '@/state/*', '@/app/*'],
              message:
                'Shared components are leaves: hooks/utils/domain/styles only (CLAUDE.md §4).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*'],
              message: 'domain/ and utils/ import nothing internal (CLAUDE.md §4).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/components/*', '@/api/*', '@/state/*', '@/app/*'],
              message: 'Shared hooks may import utils/ and domain/ only (CLAUDE.md §4).',
            },
          ],
        },
      ],
    },
  },
  // tooling configs legitimately use default exports (vite/vitest contract)
  {
    files: ['vite.config.ts', 'vitest.config.ts', 'eslint.config.js', 'commitlint.config.mjs'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)

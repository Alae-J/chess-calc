import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/', '.output/', '.wxt/', 'dist/', 'coverage/', 'eslint.config.js', 'postcss.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'error',
    },
  },
  // Layering: each zone below lives in a config block scoped to the TARGET's files,
  // because import/no-restricted-paths only evaluates zones on files that match the
  // block's `files` glob. Consolidating all zones in one block silently skips any
  // zone whose target is outside that block's files.
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-dom',
            'zustand',
            'chessground',
            'lucide-react',
            'tailwindcss',
            '@/ui/*',
            '@/ui/**',
            '@/entrypoints/*',
            '@/entrypoints/**',
            '@/state/*',
            '@/state/**',
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: 'src/core', from: ['src/ui', 'src/entrypoints', 'src/state', 'src/dev'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/adapters/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-dom',
            'zustand',
            'chessground',
            'lucide-react',
            'tailwindcss',
            '@/ui/*',
            '@/ui/**',
            '@/entrypoints/*',
            '@/entrypoints/**',
            '@/state/*',
            '@/state/**',
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: 'src/adapters', from: ['src/ui', 'src/entrypoints', 'src/state', 'src/dev'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/state/store.ts', 'src/state/selectors.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react', 'react-dom', 'chessground', 'lucide-react', 'tailwindcss',
            '@/ui/*', '@/ui/**',
            '@/entrypoints/*', '@/entrypoints/**',
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: 'src/state/store.ts', from: ['src/adapters', 'src/ui', 'src/entrypoints', 'src/dev'] },
            { target: 'src/state/selectors.ts', from: ['src/adapters', 'src/ui', 'src/entrypoints', 'src/dev'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: 'src/ui', from: ['src/adapters', 'src/entrypoints', 'src/dev', 'src/state/bridgeAdapter.ts'] },
          ],
        },
      ],
    },
  },
  prettierConfig,
);

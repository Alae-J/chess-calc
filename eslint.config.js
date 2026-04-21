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
  // Layering: core and adapters are pure TS. No UI/state/entrypoint imports.
  {
    files: ['src/core/**', 'src/adapters/**'],
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
            { target: 'src/adapters', from: ['src/ui', 'src/entrypoints', 'src/state', 'src/dev'] },
            { target: 'src/state/store.ts', from: ['src/adapters', 'src/ui', 'src/entrypoints', 'src/dev'] },
            { target: 'src/state/selectors.ts', from: ['src/adapters', 'src/ui', 'src/entrypoints', 'src/dev'] },
            { target: 'src/ui', from: ['src/adapters', 'src/entrypoints', 'src/dev'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/state/store.ts', 'src/state/selectors.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          'react', 'react-dom', 'chessground', 'lucide-react', 'tailwindcss',
          '@/ui/*', '@/ui/**',
          '@/entrypoints/*', '@/entrypoints/**',
        ],
      }],
    },
  },
  prettierConfig,
);

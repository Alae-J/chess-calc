import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/', '.output/', '.wxt/', 'dist/', 'coverage/', 'eslint.config.js'],
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
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: 'src/core',
              from: ['src/ui', 'src/entrypoints', 'src/state'],
            },
            {
              target: 'src/adapters',
              from: ['src/ui', 'src/entrypoints', 'src/state'],
            },
          ],
        },
      ],
    },
  },
  prettierConfig,
);

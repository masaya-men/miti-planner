import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // React Compiler 未使用のため(babel-plugin-react-compiler 無し・vite は素の react())、
      // eslint-plugin-react-hooks 7 の recommended に入る Compiler 用ルールを切る。導入時は戻す。
      // rules-of-hooks / exhaustive-deps は残す。
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    // テストの偽物(モック・一部だけの入力データ)は any で書くのが実用的で、型を付けても製品は守れない。
    // 本体コードの any は引き続きエラー。
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'vitest.setup.ts', 'playwright/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])

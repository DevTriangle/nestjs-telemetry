import eslintNestJs from '@darraghor/eslint-plugin-nestjs-typed'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tseslint, { parser } from 'typescript-eslint'
import eslint from '@eslint/js'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig } from 'eslint/config'

export default defineConfig(
  {
    ignores: ['dist/**/*.ts', 'dist/**', '**/*.mjs', 'eslint.config.mjs', 'node_modules/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  sonarjs.configs.recommended,
  eslintNestJs.configs.flatRecommended,
  {
    plugins: { 'unused-imports': unusedImports },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@darraghor/nestjs-typed/provided-injected-should-match-factory-parameters': 'off',
      '@darraghor/nestjs-typed/injectable-should-be-provided': 'off',
      'sonarjs/deprecation': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
)

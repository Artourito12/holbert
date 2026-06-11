import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['**/dist', '**/node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Code copié verbatim depuis Heldert (fidélité DA) : on n'y applique pas
    // les règles react-hooks v7 qui flaguent les patterns floating-ui.
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    // Contextes (provider + hook dans le même fichier, pattern Heldert) et
    // pages avec fetch-dans-effect classique.
    files: ['apps/web/src/context/**/*.tsx', 'apps/web/src/pages/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])

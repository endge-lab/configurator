import antfu from '@antfu/eslint-config'
import vueI18n from '@intlify/eslint-plugin-vue-i18n'

export default antfu(
  {},
  ...vueI18n.configs['flat/base'],
  {
    rules: {
      curly: ['error', 'all'],

      '@intlify/vue-i18n/no-deprecated-i18n-component': 'error',
      '@intlify/vue-i18n/no-deprecated-i18n-place-attr': 'error',
      '@intlify/vue-i18n/no-deprecated-i18n-places-prop': 'error',
      '@intlify/vue-i18n/no-deprecated-modulo-syntax': 'error',
      '@intlify/vue-i18n/no-deprecated-tc': 'error',
      '@intlify/vue-i18n/no-deprecated-v-t': 'error',
      '@intlify/vue-i18n/no-html-messages': 'error',
      '@intlify/vue-i18n/no-i18n-t-path-prop': 'error',
      '@intlify/vue-i18n/no-missing-keys': 'error',
      '@intlify/vue-i18n/no-raw-text': ['error', { ignorePattern: '^[-#:()&{}\+⌘⇧⌥⌃]+$' }],
      '@intlify/vue-i18n/no-v-html': 'error',
      '@intlify/vue-i18n/valid-message-syntax': 'error',

      '@intlify/vue-i18n/key-format-style': ['error', 'camelCase'],
      '@intlify/vue-i18n/no-dynamic-keys': 'error',
      '@intlify/vue-i18n/no-missing-keys-in-other-locales': 'error',
      '@intlify/vue-i18n/no-unknown-locale': 'error',
      '@intlify/vue-i18n/no-unused-keys': ['error', {
        extensions: ['.ts', '.vue'],
        ignores: ['app.title', 'app.shortTitle', 'app.description'],
      }],
      '@intlify/vue-i18n/prefer-sfc-lang-attr': 'error',

      '@intlify/vue-i18n/prefer-linked-key-with-paren': 'error',

      'perfectionist/sort-imports': ['error', {
        type: 'natural',
        order: 'asc',
        ignoreCase: true,
        sortSideEffects: true,
        groups: [
          'type',
          'side-effect', // сюда попадёт: import 'reflect-metadata'
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling', 'index'],
          'object',
        ],
        customGroups: {
          value: {
            // Явно закрепляем reflect-metadata в block side-effect, чтобы он был первым
            'side-effect': ['^reflect-metadata$'],
          },
        },
      }],
    },
    settings: {
      'vue-i18n': {
        localeDir: [
          './src/i18n/locales/*.{json,json5,yaml,yml}',
          './src/assets/branding/*/locale/*.{json,json5,yaml,yml}',
        ],
        messageSyntaxVersion: '^11.1.12',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,vue}'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['memberLike'],
          modifiers: ['private'],
          format: null,
          leadingUnderscore: 'require',
        },
        {
          selector: ['parameterProperty'],
          modifiers: ['private'],
          format: null,
          leadingUnderscore: 'require',
        },
      ],
    },
  },
)

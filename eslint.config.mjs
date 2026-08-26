import vueI18n from '@intlify/eslint-plugin-vue-i18n'
import { createEndgeEslintConfig } from './eslint.endge.config.mjs'

export default createEndgeEslintConfig(
  ...vueI18n.configs['flat/base'],
  {
    name: 'endge/vue-i18n',
    rules: {
      '@intlify/vue-i18n/key-format-style': ['error', 'camelCase'],
      '@intlify/vue-i18n/no-deprecated-i18n-component': 'error',
      '@intlify/vue-i18n/no-deprecated-i18n-place-attr': 'error',
      '@intlify/vue-i18n/no-deprecated-i18n-places-prop': 'error',
      '@intlify/vue-i18n/no-deprecated-modulo-syntax': 'error',
      '@intlify/vue-i18n/no-deprecated-tc': 'error',
      '@intlify/vue-i18n/no-deprecated-v-t': 'error',
      '@intlify/vue-i18n/no-dynamic-keys': 'error',
      '@intlify/vue-i18n/no-html-messages': 'error',
      '@intlify/vue-i18n/no-i18n-t-path-prop': 'error',
      '@intlify/vue-i18n/no-missing-keys': 'error',
      '@intlify/vue-i18n/no-missing-keys-in-other-locales': 'error',
      '@intlify/vue-i18n/no-raw-text': ['error', { ignorePattern: '^[-#:()&{}+⌘⇧⌥⌃]+$' }],
      '@intlify/vue-i18n/no-unknown-locale': 'error',
      '@intlify/vue-i18n/no-unused-keys': ['error', {
        extensions: ['.ts', '.vue'],
        ignores: ['app.title', 'app.shortTitle', 'app.description'],
      }],
      '@intlify/vue-i18n/no-v-html': 'error',
      '@intlify/vue-i18n/prefer-linked-key-with-paren': 'error',
      '@intlify/vue-i18n/prefer-sfc-lang-attr': 'error',
      '@intlify/vue-i18n/valid-message-syntax': 'error',
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
)

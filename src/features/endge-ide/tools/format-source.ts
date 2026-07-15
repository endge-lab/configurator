import type { Options, Plugin } from 'prettier'

export type SourceFormatLanguage
  = | 'typescript'
    | 'javascript'
    | 'vue'
    | 'html'
    | 'css'
    | 'json'

const BASE_OPTIONS: Options = {
  useTabs: false,
  tabWidth: 2,
  printWidth: 100,
  semi: false,
  singleQuote: true,
}

interface PrettierConfig {
  parser: string
  plugins: Plugin[]
}

interface ProtectedSource {
  source: string
  restore: (formatted: string) => string
}

const ENDGE_SELECTOR_SEGMENT_RE
  = /\[\s*[a-z_$][\w$-]*\s*=\s*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\d+)\s*\]/gi
const PRETTIER_WRAPPED_ENDGE_SELECTOR_SEGMENT_RE
  = /\[\(\s*[a-z_$][\w$-]*\s*=\s*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\d+)\s*\)\]/gi
const VUE_TEMPLATE_BLOCK_RE
  = /(<template(?:\s[^>]*)?>)([\s\S]*?)(<\/template\s*>)/gi

/**
 * Vue parser treats `[name='value']` as a JavaScript assignment and adds
 * parentheses. In Endge templates this is a DataPath selector, so it must stay
 * opaque while Prettier formats the surrounding Vue source.
 */
function protectEndgeSelectors(source: string): ProtectedSource {
  const selectors: string[] = []
  let placeholderPrefix = '__ENDGE_FORMAT_SELECTOR_'

  while (source.includes(placeholderPrefix)) {
    placeholderPrefix = `_${placeholderPrefix}`
  }

  const protectedSource = source.replace(
    VUE_TEMPLATE_BLOCK_RE,
    (_block, open: string, template: string, close: string) => {
      const maskSelector = (selector: string): string => {
        const placeholder = `[${placeholderPrefix}${selectors.length}__]`
        selectors.push(selector)
        return placeholder
      }
      const protectedTemplate = template
        .replace(
          PRETTIER_WRAPPED_ENDGE_SELECTOR_SEGMENT_RE,
          selector => maskSelector(
            selector
              .replace(/^\[\(\s*/, '[')
              .replace(/\s*\)\]$/, ']'),
          ),
        )
        .replace(ENDGE_SELECTOR_SEGMENT_RE, maskSelector)
      return `${open}${protectedTemplate}${close}`
    },
  )

  return {
    source: protectedSource,
    restore: (formatted) => {
      let restored = formatted
      selectors.forEach((selector, index) => {
        restored = restored.replace(
          `[${placeholderPrefix}${index}__]`,
          selector,
        )
      })
      return restored
    },
  }
}

async function loadPrettierConfig(
  language: SourceFormatLanguage,
): Promise<PrettierConfig> {
  const estree = async (): Promise<Plugin> =>
    (await import('prettier/plugins/estree')).default

  switch (language) {
    case 'typescript': {
      const [typescriptPlugin, estreePlugin] = await Promise.all([
        import('prettier/plugins/typescript').then(module => module.default),
        estree(),
      ])
      return {
        parser: 'typescript',
        plugins: [typescriptPlugin, estreePlugin],
      }
    }
    case 'javascript': {
      const [babelPlugin, estreePlugin] = await Promise.all([
        import('prettier/plugins/babel').then(module => module.default),
        estree(),
      ])
      return { parser: 'babel', plugins: [babelPlugin, estreePlugin] }
    }
    case 'json': {
      const [babelPlugin, estreePlugin] = await Promise.all([
        import('prettier/plugins/babel').then(module => module.default),
        estree(),
      ])
      return { parser: 'json', plugins: [babelPlugin, estreePlugin] }
    }
    case 'html': {
      const htmlPlugin = (await import('prettier/plugins/html')).default
      return { parser: 'html', plugins: [htmlPlugin] }
    }
    case 'css': {
      const postcssPlugin = (await import('prettier/plugins/postcss')).default
      return { parser: 'css', plugins: [postcssPlugin] }
    }
    case 'vue': {
      const [
        htmlPlugin,
        babelPlugin,
        estreePlugin,
        typescriptPlugin,
        postcssPlugin,
      ] = await Promise.all([
        import('prettier/plugins/html').then(module => module.default),
        import('prettier/plugins/babel').then(module => module.default),
        estree(),
        import('prettier/plugins/typescript').then(module => module.default),
        import('prettier/plugins/postcss').then(module => module.default),
      ])
      return {
        parser: 'vue',
        plugins: [
          htmlPlugin,
          babelPlugin,
          estreePlugin,
          typescriptPlugin,
          postcssPlugin,
        ],
      }
    }
  }
}

/** Форматирует source согласно формату документа. Prettier загружается только по клику. */
export async function formatSource(
  source: string,
  language: SourceFormatLanguage,
): Promise<string> {
  if (!source.trim()) {
    return source
  }

  const protectedSource = language === 'vue'
    ? protectEndgeSelectors(source)
    : { source, restore: (formatted: string) => formatted }

  const [{ format }, config] = await Promise.all([
    import('prettier/standalone'),
    loadPrettierConfig(language),
  ])

  const formatted = await format(protectedSource.source, {
    ...BASE_OPTIONS,
    parser: config.parser,
    plugins: config.plugins,
    ...(language === 'vue'
      ? { htmlWhitespaceSensitivity: 'ignore' as const }
      : {}),
  })

  return protectedSource.restore(formatted)
}

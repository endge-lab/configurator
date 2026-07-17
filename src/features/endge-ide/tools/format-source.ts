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
const VUE_CONTROL_FLOW_DIRECTIVE_RE
  = /(\s)v-(else-if|if|else|for)(?=\s|=|\/?>)/g
const VUE_STYLE_OPEN_TAG_RE = /<style\b([^>]*)>/gi
const STYLE_LANG_ATTRIBUTE_RE
  = /\blang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

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

/**
 * Prettier keeps unknown SFC style languages opaque. EndgeCSS uses an
 * SCSS-compatible formatting grammar, so the formatter temporarily exposes
 * EndgeCSS blocks as SCSS and restores their original language declaration
 * afterwards. A style block without lang is also EndgeCSS by contract.
 */
function exposeEndgeStylesToPrettier(source: string): ProtectedSource {
  const styles: Array<{ marker: string, hadLanguage: boolean }> = []
  let markerPrefix = 'data-endge-format-style-'

  while (source.includes(markerPrefix))
    markerPrefix = `x-${markerPrefix}`

  const protectedSource = source.replace(
    VUE_STYLE_OPEN_TAG_RE,
    (openTag: string, rawAttributes: string) => {
      const languageMatch = rawAttributes.match(STYLE_LANG_ATTRIBUTE_RE)
      const language = String(
        languageMatch?.[1] ?? languageMatch?.[2] ?? languageMatch?.[3] ?? '',
      ).trim().toLowerCase()
      const hadLanguage = languageMatch != null

      if (hadLanguage && language !== 'endgecss')
        return openTag

      const marker = `${markerPrefix}${styles.length}`
      styles.push({ marker, hadLanguage })

      const attributes = hadLanguage
        ? rawAttributes.replace(STYLE_LANG_ATTRIBUTE_RE, 'lang="scss"')
        : `${rawAttributes} lang="scss"`

      return `<style${attributes} ${marker}>`
    },
  )

  return {
    source: protectedSource,
    restore: (formatted) => styles.reduce((result, style) => {
      const blockPattern = new RegExp(
        `<style\\b([^>]*?)\\s${escapeRegExp(style.marker)}(?:="")?([^>]*)>`
        + `([\\s\\S]*?)<\\/style\\s*>`,
        'i',
      )

      return result.replace(blockPattern, (
        _block,
        before: string,
        after: string,
        content: string,
      ) => {
        let attributes = `${before}${after}`
        attributes = style.hadLanguage
          ? attributes.replace(STYLE_LANG_ATTRIBUTE_RE, 'lang="endgecss"')
          : attributes.replace(STYLE_LANG_ATTRIBUTE_RE, '')

        const openTag = `<style${attributes.replace(/\s+/g, ' ').trimEnd()}>`
        return `${openTag}${indentStyleContent(content)}</style>`
      })
    }, formatted),
  }
}

function indentStyleContent(content: string): string {
  const indentation = ' '.repeat(BASE_OPTIONS.tabWidth ?? 2)

  return content
    .split('\n')
    .map(line => line.trim() ? `${indentation}${line}` : line)
    .join('\n')
}

function protectEndgeVueSource(source: string): ProtectedSource {
  const selectors = protectEndgeSelectors(source)
  const styles = exposeEndgeStylesToPrettier(selectors.source)

  return {
    source: styles.source,
    restore: formatted => selectors.restore(styles.restore(formatted)),
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Нормализует Vue-совместимый control-flow syntax в канонический Endge SFC syntax.
 * Обрабатываются только атрибуты открывающих тегов внутри template, поэтому строки
 * в script и обычный текст с примерами директив остаются без изменений.
 */
function normalizeEndgeControlFlowDirectives(source: string): string {
  return source.replace(
    VUE_TEMPLATE_BLOCK_RE,
    (_block, open: string, template: string, close: string) =>
      `${open}${normalizeTemplateTagDirectives(template)}${close}`,
  )
}

function normalizeTemplateTagDirectives(template: string): string {
  let result = ''
  let cursor = 0

  while (cursor < template.length) {
    const tagStart = template.indexOf('<', cursor)
    if (tagStart < 0) {
      result += template.slice(cursor)
      break
    }

    result += template.slice(cursor, tagStart)

    if (template.startsWith('<!--', tagStart)) {
      const commentEnd = template.indexOf('-->', tagStart + 4)
      if (commentEnd < 0) {
        result += template.slice(tagStart)
        break
      }

      result += template.slice(tagStart, commentEnd + 3)
      cursor = commentEnd + 3
      continue
    }

    const tagNameStart = template[tagStart + 1] === '/'
      ? tagStart + 2
      : tagStart + 1

    if (!/[a-z]/i.test(template[tagNameStart] ?? '')) {
      result += '<'
      cursor = tagStart + 1
      continue
    }

    const tagEnd = findTemplateTagEnd(template, tagNameStart)
    if (tagEnd < 0) {
      result += template.slice(tagStart)
      break
    }

    result += template
      .slice(tagStart, tagEnd + 1)
      .replace(VUE_CONTROL_FLOW_DIRECTIVE_RE, '$1$2')
    cursor = tagEnd + 1
  }

  return result
}

function findTemplateTagEnd(template: string, start: number): number {
  let quote: '"' | '\'' | null = null

  for (let index = start; index < template.length; index += 1) {
    const character = template[index]

    if (quote) {
      if (character === quote && template[index - 1] !== '\\') {
        quote = null
      }
      continue
    }

    if (character === '"' || character === '\'') {
      quote = character
      continue
    }

    if (character === '>') {
      return index
    }
  }

  return -1
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
    ? protectEndgeVueSource(source)
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

  const restored = protectedSource.restore(formatted)

  return language === 'vue'
    ? normalizeEndgeControlFlowDirectives(restored)
    : restored
}

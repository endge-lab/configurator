import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'

const QUERY_SOURCE_LANGUAGE_ID = 'endge-query-source'

let isRegistered = false

/** Регистрирует Monaco language для RQuery source один раз на приложение. */
export function registerQuerySourceLanguage(monaco: typeof Monaco): string {
  if (isRegistered)
    return QUERY_SOURCE_LANGUAGE_ID

  if (!monaco.languages.getLanguages().some(language => language.id === QUERY_SOURCE_LANGUAGE_ID)) {
    monaco.languages.register({
      id: QUERY_SOURCE_LANGUAGE_ID,
      aliases: ['Endge Query Source'],
      extensions: ['.endge-query.ts'],
    })
  }

  monaco.languages.setLanguageConfiguration(QUERY_SOURCE_LANGUAGE_ID, {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '\'', close: '\'' },
      { open: '"', close: '"' },
    ],
  })

  monaco.languages.setMonarchTokensProvider(QUERY_SOURCE_LANGUAGE_ID, {
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/'(?:[^'\\]|\\.)*'/, 'string'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/\b(?:true|false|null|undefined)\b/, 'constant'],
        [/\b\d+(?:\.\d+)?\b/, 'number'],
        [/\b(?:defineQuery|field|filter|env|endgeVar)\b/, 'keyword'],
        [/\b(?:inline|reference|array|optional|params)\b/, 'function'],
        [/\b(?:kind|request|endpoint|path|method|headers|auth|timeoutMs|formUrlencoded|filters|mode|items|response|subField|return|mock|enabled|data)\b/, 'type.identifier'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  })

  monaco.languages.registerCompletionItemProvider(QUERY_SOURCE_LANGUAGE_ID, {
    triggerCharacters: ['.', ':', '\'', '"'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      return {
        suggestions: Endge.source.completions('query', {
          source: model.getValue(),
          position,
        }).map(item => ({
          label: item.label,
          kind: toMonacoCompletionKind(monaco, item.kind),
          insertText: item.insertText,
          insertTextRules: item.kind === 'snippet'
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          detail: item.detail,
          documentation: item.documentation,
          range,
        })),
      }
    },
  })

  isRegistered = true
  return QUERY_SOURCE_LANGUAGE_ID
}

function toMonacoCompletionKind(
  monaco: typeof Monaco,
  kind: string,
): Monaco.languages.CompletionItemKind {
  switch (kind) {
    case 'function':
      return monaco.languages.CompletionItemKind.Function
    case 'property':
      return monaco.languages.CompletionItemKind.Property
    case 'value':
      return monaco.languages.CompletionItemKind.Value
    case 'snippet':
      return monaco.languages.CompletionItemKind.Snippet
    case 'keyword':
    default:
      return monaco.languages.CompletionItemKind.Keyword
  }
}

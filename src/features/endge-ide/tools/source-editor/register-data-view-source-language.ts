import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'

const DATA_VIEW_SOURCE_LANGUAGE_ID = 'endge-data-view-source'

let isRegistered = false

/** Регистрирует Monaco language для RDataView source один раз на приложение. */
export function registerDataViewSourceLanguage(monaco: typeof Monaco): string {
  if (isRegistered)
    return DATA_VIEW_SOURCE_LANGUAGE_ID

  if (!monaco.languages.getLanguages().some(language => language.id === DATA_VIEW_SOURCE_LANGUAGE_ID)) {
    monaco.languages.register({
      id: DATA_VIEW_SOURCE_LANGUAGE_ID,
      aliases: ['Endge DataView Source'],
      extensions: ['.endge-data-view.ts'],
    })
  }

  monaco.languages.setLanguageConfiguration(DATA_VIEW_SOURCE_LANGUAGE_ID, {
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
      { open: '`', close: '`' },
    ],
  })

  monaco.languages.setMonarchTokensProvider(DATA_VIEW_SOURCE_LANGUAGE_ID, {
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/`(?:[^`\\]|\\.)*`/, 'string'],
        [/'(?:[^'\\]|\\.)*'/, 'string'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/\b(?:true|false|null|undefined)\b/, 'constant'],
        [/\b\d+(?:\.\d+)?\b/, 'number'],
        [/\b(?:defineDataView|transform|steps|from|map|join|spread|path|template|convert|field|pick)\b/, 'keyword'],
        [/\b(?:manual|pipeline|mode|input|tools|left|right|as|by|find)\b/, 'type.identifier'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  })

  monaco.languages.registerCompletionItemProvider(DATA_VIEW_SOURCE_LANGUAGE_ID, {
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
        suggestions: Endge.source.completions('data-view', {
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
  return DATA_VIEW_SOURCE_LANGUAGE_ID
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

/**
 * Базовый тип вкладки
 */
export interface BaseTab {
  id: string // уникальный идентификатор вкладки
  label: string // отображаемое имя
  type: 'document' | 'component' // какой тип вкладки
  icon?: string // иконка вкладки (имя, путь или компонент)
  editorComponent: any // Vue компонент редактора
}

/**
 * Вкладка документа
 */
export interface DocumentTab<TDomain, TEditor> extends BaseTab {
  type: 'document'
  component: TDomain // доменная сущность документа
  editor: TEditor // модель редактора
  isUpdated: boolean // флаг изменений
  /** Контекст для view: tabContext.document.editor */
  document?: { editor: TEditor, component: TDomain, isUpdated: boolean }
}

/**
 * Вкладка произвольного компонента
 */
export interface ComponentTab<TComponent> extends BaseTab {
  type: 'component'
  component: TComponent // компонент для отображения
}

/**
 * Контекст вкладки (любой тип)
 */
export type TabContext<TDomain = any, TEditor = any, TComponent = any>
  = DocumentTab<TDomain, TEditor>
    | ComponentTab<TComponent>

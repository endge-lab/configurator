/**
 * Доступные категории документации
 */
export enum DocsCategory {
  Nova = 'Nova',
  HowToUse = 'HowToUse',
  ArchitectureConcepts = 'ArchitectureConcepts',
  ProjectRoadmap = 'ProjectRoadmap',
  EndgeCoreModules = 'EndgeCoreModules',
  EndgeSubModules = 'EndgeSubModules',
  EndgeDomain = 'EndgeDomain',
  Configuring = 'Configuring',
  Codegen = 'Codegen',
  EndgeCSS = 'EndgeCSS',
}

/**
 * Элемент документации
 */
export interface DocsEntry {
  id: string
  title: string
  description: string
  icon?: string
  file: string // jsx/Layout (без расширения .md)
  category: DocsCategory
}

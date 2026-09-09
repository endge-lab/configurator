import type { EndgeConfigurationContribution, RProject } from '@endge/core'

import { ProjectWorkflow } from '@/features/project-workflow/domain/ProjectWorkflow'
import { readWorkflowLayout, writeWorkflowLayout } from '@/features/project-workflow/tools/workflow-layout'

function normalizeRelationId(value: unknown): number | null {
  if (value == null) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const text = String(value).trim()
  if (!text) {
    return null
  }
  const id = Number(text)
  return Number.isFinite(id) ? id : null
}

/**
 * Модель редактора для RProject (коллекция projects).
 */
export class RProjectEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string | null = null
  slug: string | null = null
  order: number | null = null
  allowedEnvironmentIds: number[] = []
  source: string = ''
  sourceVersion: number = 1
  configuration: EndgeConfigurationContribution = { mode: 'inherit', patch: {} }
  /** Раскладка сохраняется в meta; личную камеру и раскрытие IDE сохраняет через Context. */
  workflow = new ProjectWorkflow()

  fillFromSource(source: RProject): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? '').trim()
    this.description = source.description ?? null
    this.slug = source.slug ?? null
    this.order = source.order ?? null
    this.allowedEnvironmentIds = Array.isArray(source.allowedEnvironmentIds)
      ? source.allowedEnvironmentIds.map(id => normalizeRelationId(id)).filter((id): id is number => id != null)
      : []
    this.source = source.source
    this.sourceVersion = source.sourceVersion
    this.configuration = clone(source.configuration)
    this.workflow = new ProjectWorkflow(readWorkflowLayout(source.meta))
  }

  updateSource(source: RProject): void {
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description ?? null
    source.slug = this.slug ?? null
    source.order = this.order ?? null
    source.allowedEnvironmentIds = Array.from(new Set(this.allowedEnvironmentIds))
    source.source = this.source
    source.sourceVersion = this.sourceVersion
    source.configuration = clone(this.configuration)
    source.meta = writeWorkflowLayout(source.meta, this.workflow.layout)
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

import { ComponentType, DomainSectionType, FilterType, QueryType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  getDomainDocumentPresentation,
  getDomainSectionPresentation,
} from '../../../../../features/endge-ide/services/domain/domain-document-presentation'
import { QUERY_COMPOSITION_PRESENTATION_KIND } from '../../../../../features/endge-ide/services/domain/query-composition-presentation'

describe('представление документа домена', () => {
  it('использует Send для секций и документов Query', () => {
    expect(getDomainSectionPresentation(DomainSectionType.Query)).toEqual({
      icon: 'Send',
      colorClass: 'text-orange-500',
    })
    expect(getDomainDocumentPresentation(QueryType.REST)).toEqual({
      icon: 'Send',
      colorClass: 'text-orange-500',
    })
  })

  it('сохраняет единое представление для каждого типа документа компонента', () => {
    expect(getDomainDocumentPresentation(ComponentType.DSL)).toEqual({
      icon: 'Puzzle',
      colorClass: 'text-blue-500',
      badgeIcon: 'Braces',
    })
    expect(getDomainDocumentPresentation(ComponentType.Table)).toEqual({
      icon: 'Puzzle',
      colorClass: 'text-blue-500',
      badgeIcon: 'Table2',
    })
    expect(getDomainDocumentPresentation(ComponentType.SFC)).toEqual({
      icon: 'Puzzle',
      colorClass: 'text-blue-500',
    })
  })

  it('сохраняет фиолетовый цвет Composition во всех контекстах представления', () => {
    const compositionPresentation = {
      icon: 'Network',
      colorClass: 'text-violet-500',
    }

    expect(getDomainDocumentPresentation('composition')).toEqual(compositionPresentation)
    expect(getDomainDocumentPresentation('composition', QUERY_COMPOSITION_PRESENTATION_KIND)).toEqual(compositionPresentation)
    expect(getDomainDocumentPresentation('composition', 'query')).toEqual(compositionPresentation)
    expect(getDomainDocumentPresentation('composition', 'project')).toEqual(compositionPresentation)
    expect(getDomainDocumentPresentation('composition', 'tenant')).toEqual(compositionPresentation)
    expect(getDomainDocumentPresentation('composition', 'environment')).toEqual(compositionPresentation)
  })

  it('согласует представления Computation и Filter с их секциями', () => {
    expect(getDomainDocumentPresentation('computation')).toEqual(
      getDomainSectionPresentation(DomainSectionType.Computation),
    )
    expect(getDomainDocumentPresentation(FilterType.DefaultFilter)).toEqual(
      getDomainSectionPresentation(DomainSectionType.Filters),
    )
  })

  it('использует цветовые семейства инфраструктуры и представления', () => {
    expect(getDomainSectionPresentation(DomainSectionType.Environment)).toEqual({
      icon: 'ServerCog',
      colorClass: 'text-lime-500',
    })
    expect(getDomainSectionPresentation(DomainSectionType.PageTemplate).colorClass).toBe('text-indigo-400')
  })
})

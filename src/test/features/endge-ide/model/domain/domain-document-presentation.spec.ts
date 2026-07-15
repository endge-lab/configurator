import { ComponentType, DomainSectionType, FilterType, QueryType } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  getDomainDocumentPresentation,
  getDomainSectionPresentation,
} from '../../../../../features/endge-ide/model/domain/domain-document-presentation'
import { QUERY_COMPOSITION_PRESENTATION_KIND } from '../../../../../features/endge-ide/model/domain/query-composition-presentation'

describe('domain document presentation', () => {
  it('uses Send for query sections and documents', () => {
    expect(getDomainSectionPresentation(DomainSectionType.Query)).toEqual({
      icon: 'Send',
      colorClass: 'text-orange-500',
    })
    expect(getDomainDocumentPresentation(QueryType.REST)).toEqual({
      icon: 'Send',
      colorClass: 'text-orange-500',
    })
  })

  it('keeps one presentation for every component document type', () => {
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

  it('inherits query color without losing the composition icon', () => {
    expect(getDomainDocumentPresentation('composition')).toEqual({
      icon: 'Network',
      colorClass: 'text-violet-500',
    })
    expect(getDomainDocumentPresentation('composition', QUERY_COMPOSITION_PRESENTATION_KIND)).toEqual({
      icon: 'Network',
      colorClass: 'text-orange-500',
    })
  })

  it('keeps computation and filter presentations aligned with their sections', () => {
    expect(getDomainDocumentPresentation('computation')).toEqual(
      getDomainSectionPresentation(DomainSectionType.Computation),
    )
    expect(getDomainDocumentPresentation(FilterType.DefaultFilter)).toEqual(
      getDomainSectionPresentation(DomainSectionType.Filters),
    )
  })

  it('uses infrastructure and presentation color families', () => {
    expect(getDomainSectionPresentation(DomainSectionType.Environment)).toEqual({
      icon: 'ServerCog',
      colorClass: 'text-lime-500',
    })
    expect(getDomainSectionPresentation(DomainSectionType.PageTemplate).colorClass).toBe('text-indigo-400')
  })
})

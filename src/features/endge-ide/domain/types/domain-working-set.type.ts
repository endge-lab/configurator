/** Стабильная ссылка на документ в графе working set. */
export interface DomainWorkingSetRef {
  entityType: string
  id: string | number
  identity?: string
}

/** Причина включения документа в working set. */
export type DomainWorkingSetMemberRole = 'root' | 'dependency' | 'context'

/** Найденный документ с минимальной глубиной от пользовательского root. */
export interface DomainWorkingSetMember {
  ref: DomainWorkingSetRef
  role: DomainWorkingSetMemberRole
  depth: number
  reachedFrom: string | null
}

/** Результат направленного обхода выбранных roots. */
export interface DomainWorkingSetResult {
  members: ReadonlyMap<string, DomainWorkingSetMember>
}

/** Persisted состояние включённого working-set фильтра. */
export interface DomainWorkingSetFilterState {
  enabled: boolean
  roots: DomainWorkingSetRef[]
}

/** Адаптер источника связей для pure working-set resolver. */
export interface DomainWorkingSetGraph {
  dependenciesOf: (ref: DomainWorkingSetRef) => readonly DomainWorkingSetRef[]
  ownerOf?: (ref: DomainWorkingSetRef) => DomainWorkingSetRef | null
}

import type { EndgeFlowNodeKind } from '@endge/core'

import type { EndgeAdminFlowBlockSpec } from '@/features/endge-admin/domain/action-flow/endge-admin-flow-catalog.types'

export interface EndgeFlowPaletteGroup {
  id: string
  title: string
  kinds: EndgeFlowNodeKind[]
}

export const ENDGE_FLOW_PALETTE_GROUPS: EndgeFlowPaletteGroup[] = [
  {
    id: 'flow-entry',
    title: 'Точка входа',
    kinds: ['start'],
  },
  {
    id: 'flow-actions',
    title: 'Действия',
    kinds: ['action', 'query', 'runtimeAction'],
  },
  {
    id: 'flow-management',
    title: 'Управление',
    kinds: ['switch', 'forEach', 'while', 'parallel'],
  },
  {
    id: 'flow-events',
    title: 'События',
    kinds: ['watch', 'eventSubscribe', 'timer', 'intervalTimer'],
  },
  {
    id: 'flow-commands',
    title: 'Общие команды',
    kinds: ['delay'],
  },
]

export function getEndgeFlowPaletteGroupByKind(kind: EndgeFlowNodeKind): EndgeFlowPaletteGroup | undefined {
  return ENDGE_FLOW_PALETTE_GROUPS.find(group => group.kinds.includes(kind))
}

export function shouldShowEndgeFlowPaletteKind(kind: EndgeFlowNodeKind): boolean {
  return kind !== 'while' && kind !== 'timer'
}

export function groupEndgeFlowPalette(blocks: EndgeAdminFlowBlockSpec[]): Array<EndgeFlowPaletteGroup & { blocks: EndgeAdminFlowBlockSpec[] }> {
  return ENDGE_FLOW_PALETTE_GROUPS.map(group => ({
    ...group,
    blocks: blocks.filter(block => group.kinds.includes(block.kind)),
  }))
}

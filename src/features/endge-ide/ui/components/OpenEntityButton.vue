<script setup lang="ts">
import type { DomainDocumentType } from '@endge/core'
import { ComponentType, DomainSectionType, Endge, FilterType } from '@endge/core'
import { computed } from 'vue'
import { ExternalLink } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  /** ID сущности домена */
  entityId: string | number | null
  /** Тип секции (Query или Component для открытия документа) */
  sectionType: DomainSectionType
}>()

const docType = computed((): DomainDocumentType | null => {
  if (props.entityId == null || props.entityId === '') return null
  if (props.sectionType === DomainSectionType.Query) {
    const q = Endge.domain.getQuery(props.entityId)
    return (q?.type ?? null) as DomainDocumentType | null
  }
  if (props.sectionType === DomainSectionType.Component) {
    const c = Endge.domain.getComponent(props.entityId)
    const t = c?.type
    if (t === ComponentType.Table || t === ComponentType.DSL) return t
    return null
  }
  if (props.sectionType === DomainSectionType.Filters)
    return FilterType.DefaultFilter as DomainDocumentType
  if (props.sectionType === DomainSectionType.View)
    return 'view' as DomainDocumentType
  if (props.sectionType === DomainSectionType.Navigation)
    return 'navigation' as DomainDocumentType
  return null
})

const canOpen = computed(() => {
  if (props.entityId == null || props.entityId === '') return false
  if (props.sectionType === DomainSectionType.Navigation)
    return !!Endge.domain.getNavigation(props.entityId)
  return !!docType.value
})

function open(): void {
  if (props.entityId == null || props.entityId === '') return
  if (props.sectionType === DomainSectionType.Navigation && docType.value) {
    EndgeIDE.tabs.openDocument(props.entityId, docType.value)
    return
  }
  if (docType.value)
    EndgeIDE.tabs.openDocument(props.entityId, docType.value)
}
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-8 shrink-0"
        aria-label="Открыть"
        :disabled="!canOpen"
        @click="open"
      >
        <ExternalLink class="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">
      Открыть
    </TooltipContent>
  </Tooltip>
</template>

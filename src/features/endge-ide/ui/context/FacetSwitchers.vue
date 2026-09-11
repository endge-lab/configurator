<script setup lang="ts">
import type { RFacet } from '@endge/core'
import type { Component } from 'vue'

import { Endge } from '@endge/core'
import { ChevronsUpDown, icons, Layers3, Loader2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useEndgeIDEContext } from '@/features/endge-ide/services/context/use-endge-ide-context'

const props = defineProps<{ readonly?: boolean }>()
const pendingFacet = ref<string | null>(null)
const context = useEndgeIDEContext()
const iconMap = icons as Record<string, Component>

const facets = computed(() => {
  void context.version.value
  return Endge.domain.getFacets()
    .filter(facet => facet.deletedAt == null && facet.active !== false)
    .sort((left, right) => left.position - right.position || left.identity.localeCompare(right.identity))
})

function documents(facet: RFacet) {
  return Endge.domain.getFacetDocuments(facet.identity)
    .filter(document => document.deletedAt == null && document.active !== false)
    .sort((left, right) => left.identity.localeCompare(right.identity))
}

function selection(facet: RFacet): string | null {
  return context.currentContext().facets[facet.identity] ?? null
}

function selectionLabel(facet: RFacet): string {
  const identity = selection(facet)
  const document = identity ? Endge.domain.getFacetDocument(facet.identity, identity) : null
  return document?.displayName ?? identity ?? '—'
}

function facetIcon(facet: RFacet): Component {
  return iconMap[facet.icon] ?? Layers3
}

async function select(facet: RFacet, document: string): Promise<void> {
  if (props.readonly || pendingFacet.value || Endge.context.isFacetLockedBySession(facet.identity)) {
    return
  }
  pendingFacet.value = facet.identity
  try {
    await Endge.commands.execute({
      type: 'context:set-facet',
      payload: { facet: facet.identity, document },
    })
  }
  catch (error) {
    toast.error(`Не удалось переключить фасет «${facet.displayName}»`, {
      description: String(error instanceof Error ? error.message : error),
    })
  }
  finally {
    pendingFacet.value = null
  }
}
</script>

<template>
  <template v-for="facet in facets" :key="facet.identity">
    <Button v-if="readonly" as="span" variant="ghost" size="sm" class="pointer-events-none gap-2 px-2" :title="facet.displayName">
      <component :is="facetIcon(facet)" class="size-4" :style="{ color: facet.color }" />
      <span>{{ selectionLabel(facet) }}</span>
    </Button>
    <DropdownMenu v-else :modal="false">
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="gap-2 px-2"
          :disabled="pendingFacet !== null || context.isSwitching() || Endge.context.isFacetLockedBySession(facet.identity)"
          :title="Endge.context.isFacetLockedBySession(facet.identity) ? `${facet.displayName}: выбор задан сессией` : facet.displayName"
        >
          <Loader2 v-if="pendingFacet === facet.identity || context.isSwitching()" class="size-4 animate-spin" />
          <component :is="facetIcon(facet)" v-else class="size-4" :style="{ color: facet.color }" />
          <span class="font-medium">{{ selectionLabel(facet) }}</span>
          <ChevronsUpDown class="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-56" align="start" side="top" :side-offset="4">
        <DropdownMenuItem
          v-for="document in documents(facet)"
          :key="document.identity"
          :class="{ 'bg-accent': document.identity === selection(facet) }"
          @select="select(facet, document.identity)"
        >
          {{ document.displayName ?? document.name ?? document.identity }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </template>
</template>

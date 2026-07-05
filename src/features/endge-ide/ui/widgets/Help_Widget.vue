<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DocsCategory } from '@/features/endge-ide/domain/types/docs.types'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = withDefaults(defineProps<{
  openInTab?: boolean
}>(), {
  openInTab: true,
})
const docs = EndgeIDE.docs
const tabs = EndgeIDE.tabs
/** Открытая категория в аккордеоне (только одна) */
const openCategory = ref<DocsCategory | null>(docs.activeCategory.value)
watch(docs.activeCategory, (value) => {
  openCategory.value = value
})

const entriesByCategory = computed(() => docs.getEntriesByCategoryMap())

const categoryLabels: Record<DocsCategory, string> = {
  [DocsCategory.Nova]: 'NOVA',
  [DocsCategory.ArchitectureConcepts]: 'Архитектурные концепции',
  [DocsCategory.ProjectRoadmap]: 'Развитие проекта',
  [DocsCategory.EndgeDomain]: 'Домен',
  [DocsCategory.EndgeCoreModules]: 'Модули ядра',
  [DocsCategory.EndgeSubModules]: 'Архитектура ядра',
  [DocsCategory.EndgeComponents]: 'Компоненты',
  [DocsCategory.Styling]: 'Стилизация',
  [DocsCategory.Configuring]: 'Конфигурирование',
  [DocsCategory.HowToUse]: 'Примеры кода',
  [DocsCategory.Codegen]: 'Кодогенерация',
}

/** Порядок категорий: «Развитие проекта» — в самом конце */
const categoryOrder: DocsCategory[] = [
  DocsCategory.HowToUse,
  DocsCategory.ArchitectureConcepts,
  DocsCategory.EndgeComponents,
  DocsCategory.Styling,
  DocsCategory.EndgeDomain,
  DocsCategory.EndgeCoreModules,
  DocsCategory.EndgeSubModules,
  DocsCategory.Configuring,
  DocsCategory.Nova,
  DocsCategory.Codegen,
  DocsCategory.ProjectRoadmap,
]

const categories = computed(() =>
  categoryOrder.filter(c => entriesByCategory.value.has(c)),
)

function selectEntry(id: string, category: DocsCategory): void {
  docs.setActiveCategory(category)
  docs.selectEntry(id)
  openCategory.value = category
  if (props.openInTab) {
    const tabRef = docs.openDocumentTab(id)
    if (tabRef) {
      tabs.openTab(tabRef)
    }
  }
}
</script>

<template>
  <div class="h-full w-full">
    <ScrollArea class="h-full">
      <div class="p-2">
        <div class="space-y-1">
          <Collapsible
            v-for="category in categories"
            :key="category"
            :open="openCategory === category"
            @update:open="(open) => { if (open) openCategory = category; else if (openCategory === category) openCategory = null }"
          >
            <CollapsibleTrigger
              class="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium bg-muted-foreground/10 dark:bg-muted-foreground/20 hover:bg-muted-foreground/15 dark:hover:bg-muted-foreground/25 transition-colors [&[data-state=open]>svg]:rotate-180"
            >
              {{ categoryLabels[category] }}
              <ChevronDown class="h-4 w-4 shrink-0 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="space-y-0.5 pl-1 pt-0.5 pb-2">
                <button
                  v-for="entry in (entriesByCategory.get(category) || [])"
                  :key="entry.id"
                  class="w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  :class="{ 'bg-muted': docs.activeEntryId.value === entry.id }"
                  @click="selectEntry(entry.id, category)"
                >
                  <div class="font-medium truncate">
                    {{ entry.title }}
                  </div>
                  <div class="text-xs opacity-70 mt-0.5 line-clamp-2">
                    {{ entry.description }}
                  </div>
                </button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, RefreshCw, ServerCrash } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useLayout } from '@/lib/layout.ts'

const props = defineProps<{
  isNotFound?: boolean
  error?: Error | null
  errorInfo?: string
  componentName?: string
}>()

const { t } = useI18n()

const title = computed(() => props.isNotFound ? t('nav.error.notFound.title') : t('nav.error.title'))
const isOpen = ref(false)

useLayout({
  title,
  breadcrumbs: computed(() => [
    { title: title.value },
  ]).value,
})

function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <Empty class="border border-dashed">
    <EmptyHeader>
      <EmptyMedia variant="icon" class="bg-destructive">
        <ServerCrash class="text-destructive-foreground" />
      </EmptyMedia>
      <EmptyTitle>{{ isNotFound ? t('nav.error.notFound.title') : t('nav.error.title') }}</EmptyTitle>
      <EmptyDescription>
        {{ isNotFound ? t('nav.error.notFound.subtitle') : t('nav.error.subtitle') }}
      </EmptyDescription>

      <!-- Reload button for non-404 errors -->
      <div v-if="!isNotFound" class="mt-4">
        <Button @click="reloadPage">
          <RefreshCw class="mr-2 h-4 w-4" />
          {{ t('nav.error.reload') }}
        </Button>
      </div>

      <!-- Technical info collapsible for non-404 errors -->
      <Collapsible v-if="!isNotFound && error" v-model:open="isOpen" class="w-full mt-6">
        <CollapsibleTrigger as-child>
          <Button variant="secondary" size="sm" class="w-full justify-between">
            <span>{{ t('nav.error.technicalInfo') }}</span>
            <ChevronDown
              class="h-4 w-4 transition-transform duration-200"
              :class="{ 'rotate-180': isOpen }"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent class="mt-4">
          <div class="rounded-lg border bg-muted/50 p-4 text-left space-y-3 text-sm">
            <div v-if="componentName">
              <div class="font-semibold text-foreground mb-1">
                {{ t('nav.error.component') }}:
              </div>
              <div class="font-mono text-xs bg-background p-2 rounded border">
                {{ componentName }}
              </div>
            </div>

            <div v-if="error.message">
              <div class="font-semibold text-foreground mb-1">
                {{ t('nav.error.errorMessage') }}:
              </div>
              <div class="font-mono text-xs bg-background p-2 rounded border">
                {{ error.message }}
              </div>
            </div>

            <div v-if="errorInfo">
              <div class="font-semibold text-foreground mb-1">
                {{ t('nav.error.errorLocation') }}:
              </div>
              <div class="font-mono text-xs bg-background p-2 rounded border">
                {{ errorInfo }}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </EmptyHeader>
  </Empty>
</template>

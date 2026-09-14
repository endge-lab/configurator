<script setup lang="ts">
import { Endge, restoreProgramArtifactSource } from '@endge/core'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import { useSmartTabViewState } from '@/features/endge-ide/ui/smart-tabs'
import InspectionTextEditor from './InspectionText_Editor.vue'

const props = defineProps<{ documentKey: string }>()
const section = useSmartTabViewState<string>('inspection.section', {
  defaultValue: () => 'general',
})
const document = computed(
  () => Endge.program.catalog.documents[props.documentKey],
)
const selectedArtifact = useSmartTabViewState<string>('inspection.artifact', {
  defaultValue: () => document.value?.artifactKeys[0] ?? '',
})
const artifact = computed(() =>
  Endge.program
    .getArtifacts()
    .find(
      value =>
        `${value.ref.entityType}:${value.ref.id}` === selectedArtifact.value,
    ),
)
const ast = computed(
  () => (artifact.value?.payload as { ast?: unknown } | undefined)?.ast,
)
const text = computed(() => {
  if (!artifact.value) {
    return null
  }
  try {
    return restoreProgramArtifactSource(artifact.value)
  }
  catch {
    return null
  }
})
const { t } = useI18n()
</script>

<template>
  <Tabs v-model="section" class="flex h-full min-h-0 flex-col gap-0">
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b p-2">
      <TabsList>
        <TabsTrigger value="general">
          {{ t('bundleInspection.general') }}
        </TabsTrigger><TabsTrigger value="text">
          {{ t('bundleInspection.text') }}
        </TabsTrigger><TabsTrigger value="ast">
          {{ t('bundleInspection.ast') }}
        </TabsTrigger><TabsTrigger value="artifact">
          {{ t('bundleInspection.artifact') }}
        </TabsTrigger><TabsTrigger value="diagnostics">
          {{ t('bundleInspection.diagnostics') }}
        </TabsTrigger>
      </TabsList>
      <Select
        v-if="(document?.artifactKeys.length ?? 0) > 1"
        v-model="selectedArtifact"
      >
        <SelectTrigger class="w-52">
          <SelectValue />
        </SelectTrigger><SelectContent>
          <SelectItem
            v-for="key in document?.artifactKeys"
            :key="key"
            :value="key"
          >
            {{ key }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        v-if="artifact"
        variant="ghost"
        size="sm"
        class="ml-auto"
        @click="Configurator.remoteDebugger.downloadArtifact(selectedArtifact)"
      >
        {{ t('bundleInspection.exportArtifact') }}
      </Button>
    </div>
    <TabsContent value="general" class="m-0 min-h-0 flex-1 overflow-auto p-3">
      <p class="mb-3 text-xs text-muted-foreground">
        {{ t('bundleInspection.catalogHelp') }}
      </p>
      <SourceJsonTree :data="document" />
    </TabsContent>
    <TabsContent value="text" class="m-0 flex min-h-0 flex-1 flex-col">
      <p class="shrink-0 px-3 py-2 text-xs text-muted-foreground">
        {{
          text === null
            ? ast
              ? "Текстовый просмотр этого AST не поддерживается. Дерево доступно во вкладке AST."
              : "Source недоступен в этом Bundle: AST не включён."
            : t('bundleInspection.reconstructed')
        }}
      </p>
      <InspectionTextEditor v-if="text !== null" :text="text" class="flex-1" />
    </TabsContent>
    <TabsContent value="ast" class="m-0 min-h-0 flex-1 overflow-auto p-3">
      <SourceJsonTree v-if="ast" :data="ast" />
      <p v-else class="text-sm text-muted-foreground">
        {{ t('bundleInspection.noAst') }}
      </p>
    </TabsContent>
    <TabsContent value="artifact" class="m-0 min-h-0 flex-1 overflow-auto p-3">
      <SourceJsonTree v-if="artifact" :data="artifact" />
      <p v-else class="text-sm text-muted-foreground">
        {{ t('bundleInspection.noArtifact') }}
      </p>
    </TabsContent>
    <TabsContent
      value="diagnostics"
      class="m-0 min-h-0 flex-1 overflow-auto p-3"
    >
      <SourceJsonTree :data="artifact?.diagnostics ?? []" />
    </TabsContent>
  </Tabs>
</template>

<script setup lang="ts">
import type { RPageTemplateEditor } from '@/features/endge-ide/domain/entities/RPageTemplateEditor.ts'
import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/ui-vue'
import { computed, ref, watch } from 'vue'

import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import TemplatePreviewGrid from '@/features/endge-ide/ui/components/TemplatePreviewGrid.vue'

const props = defineProps<{
  tabContext?: { editor?: RPageTemplateEditor }
}>()

const editor = computed<RPageTemplateEditor | null>(() => props.tabContext?.editor ?? null)

const areaLabels = computed(() =>
  editor.value?.areas?.map(a => ({ identity: a.identity, title: a.title || a.identity })) ?? [],
)
const debuggerRef = useSubscribableRefAuto(Endge.runtimeDebugger)
const firstRuntimeTab = computed(() => debuggerRef.value.tabs[0] ?? null)
const runtimeTargets = computed(() => {
  const tab = firstRuntimeTab.value
  return tab ? (Endge.runtimeDebugger.getAnalysis(tab.id) ?? []) : []
})
const lastRequestedRuntimeTabId = ref<string | null>(null)

function requestTemplateAnalysis(): void {
  const tab = firstRuntimeTab.value
  const tabId = String(tab?.id ?? '').trim()
  if (!tab || !tabId) {
    return
  }
  lastRequestedRuntimeTabId.value = tabId
  Endge.runtimeDebugger.sendCommand('template-analysis', {
    tabId,
    url: tab.url ?? '',
    title: tab.title ?? '',
  })
}

function applyRuntimeTargets(): void {
  const current = editor.value
  if (!current || !runtimeTargets.value.length) {
    return
  }
  for (const target of runtimeTargets.value) {
    const identity = String(target ?? '').trim()
    if (!identity || current.areas.some(area => area.identity === identity)) {
      continue
    }
    current.areas.push({ identity, title: identity, description: '' })
  }
  toast.success('Области обновлены', {
    description: 'Список областей шаблона обновлён по Runtime Debug',
  })
}

watch(
  () => firstRuntimeTab.value?.id,
  (id) => {
    if (!id) {
      return
    }
    if (lastRequestedRuntimeTabId.value === id && runtimeTargets.value.length > 0) {
      return
    }
    requestTemplateAnalysis()
  },
  { immediate: true },
)

function addArea(): void {
  if (!editor.value) {
    return
  }
  editor.value.areas.push({
    identity: '',
    title: '',
    description: '',
  })
}

function removeArea(index: number): void {
  if (!editor.value) {
    return
  }
  editor.value.areas.splice(index, 1)
}

/** Заполняет превью по умолчанию: одна колонка - одна область. */
function fillDefaultPreview(): void {
  if (!editor.value?.areas?.length) {
    return
  }
  const rows = editor.value.areas.map(a => [a.identity])
  const rowHeights = editor.value.areas.map(() => 'normal' as const)
  editor.value.preview = { rows, rowHeights }
}

const showPreviewJson = ref(false)
const previewJsonText = computed({
  get: () => (editor.value?.preview ? JSON.stringify(editor.value.preview, null, 2) : ''),
  set: (v: string) => {
    if (!editor.value) {
      return
    }
    if (!v?.trim()) {
      editor.value.preview = null
      return
    }
    try {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed?.rows)) {
        editor.value.preview = { rows: parsed.rows, rowHeights: parsed.rowHeights ?? undefined }
      }
    }
    catch {
      /* ignore */
    }
  },
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <div class="p-3 border-b flex items-center justify-between gap-3 shrink-0">
      <div class="text-lg font-semibold truncate">
        {{ $t('uiText.pageTemplateE92cbb03') }} {{ editor?.displayName ?? '-' }}
      </div>
      <div class="flex items-center gap-2">
        <SaveDocumentButton :loading="EndgeIDE.busy.value" @click="save" />
      </div>
    </div>

    <ScrollArea class="flex-1 px-4 py-3">
      <div class="max-w-3xl space-y-6">
        <Card class="p-4 space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">
                {{ $t('uiText.identity1db089a9') }}
              </Label>
              <DocumentIdentityInput
                v-model="editor!.identity"
                placeholder="page-template.default"
              />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">
                {{ $t('uiText.name3de49828') }}
              </Label>
              <Input
                v-model="editor!.displayName"
                placeholder="Шаблон макета"
              />
            </div>
          </div>

          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground">
              {{ $t('uiText.descriptionF5441f6a') }}
            </Label>
            <Textarea
              v-model="editor!.description"
              :rows="3"
              placeholder="Краткое описание шаблона и его назначения"
            />
          </div>
        </Card>

        <Card class="p-4 space-y-3">
          <div class="font-semibold">
            {{ $t('uiText.layoutPreview585b5098') }}
          </div>
          <p class="text-xs text-muted-foreground">
            {{ $t('uiText.thumbnailForPageEditorRowsAndColumns6ba08e9b') }}
          </p>
          <div v-if="editor?.preview?.rows?.length" class="max-w-md">
            <TemplatePreviewGrid
              :preview="editor.preview"
              :area-labels="areaLabels"
            />
          </div>
          <div v-else class="text-xs text-muted-foreground">
            {{ $t('uiText.noPreviewIsSet8816481a') }}
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!editor?.areas?.length"
              @click="fillDefaultPreview"
            >
              {{ $t('uiText.fillPreviewByDefault4604e614') }}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="showPreviewJson = !showPreviewJson"
            >
              {{ showPreviewJson ? $t('uiText.hideJson195d8d30') : $t('uiText.editJsonC715198c') }}
            </Button>
          </div>
          <Textarea
            v-if="showPreviewJson"
            v-model="previewJsonText"
            class="font-mono text-xs min-h-[120px]"
            placeholder="{&quot;rows&quot;:[[&quot;slot1&quot;],[&quot;slot2&quot;,&quot;slot3&quot;]],&quot;rowHeights&quot;:[&quot;short&quot;,&quot;tall&quot;]}"
          />
        </Card>

        <Card class="p-4 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold">
              {{ $t('uiText.areasLayoutZones105229e7') }}
            </div>
            <Button size="sm" variant="outline" @click="addArea">
              {{ $t('uiText.addAreaE2905414') }}
            </Button>
          </div>

          <div class="rounded-md border bg-muted/20 p-3 space-y-2">
            <div class="text-sm font-medium">
              {{ $t('uiText.areasFromRuntimeDebug2957e786') }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t('uiText.analysisIsPerformedOnTheFirstRegiste1b6ec440') }}
            </p>
            <div v-if="firstRuntimeTab" class="text-xs text-muted-foreground">
              {{ $t('uiText.tab13e9402e') }} {{ firstRuntimeTab.title || firstRuntimeTab.url || firstRuntimeTab.id }}
            </div>
            <template v-if="runtimeTargets.length">
              <ul class="list-disc list-inside text-xs text-muted-foreground">
                <li v-for="target in runtimeTargets" :key="target">
                  {{ target }}
                </li>
              </ul>
              <Button size="sm" variant="outline" @click="applyRuntimeTargets">
                {{ $t('uiText.insertAreasIntoTemplateDe5b1370') }}
              </Button>
            </template>
            <p v-else class="text-xs text-muted-foreground">
              {{ $t('uiText.noAreasFoundYetA4fcc86d') }}
            </p>
          </div>

          <div v-if="editor?.areas?.length" class="space-y-3">
            <div
              v-for="(area, idx) in editor!.areas"
              :key="idx"
              class="grid grid-cols-[minmax(0,1.5fr)_auto] gap-3 items-center border rounded-md p-3"
            >
              <div class="space-y-1">
                <Label class="text-xs text-muted-foreground">
                  {{ $t('uiText.text63db3f20') }}
                </Label>
                <Input
                  v-model="area.identity"
                  placeholder="app-header / app-toolbar / app-main"
                />
              </div>
              <div class="flex justify-end items-start pt-5">
                <Button
                  size="icon"
                  variant="ghost"
                  class="text-destructive"
                  @click="removeArea(idx)"
                >
                  {{ $t('uiText.symbol0951b9a0') }}
                </Button>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-muted-foreground">
            {{ $t('uiText.noAreasYetAddAtLeastOneAreaToLinkCc80d706') }}
          </p>
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>

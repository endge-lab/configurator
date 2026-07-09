<script setup lang="ts">
import type { RPageTemplatePreviewSchema } from '@endge/core'

import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { RPageTemplateEditor } from '@/features/endge-ide/domain/entities/RPageTemplateEditor.ts'
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'
import TemplatePreviewGrid from '@/features/endge-ide/ui/components/TemplatePreviewGrid.vue'

const props = defineProps<{
  tabContext?: { editor?: RPageTemplateEditor }
}>()

const editor = computed<RPageTemplateEditor | null>(() => props.tabContext?.editor ?? null)

const areaLabels = computed(() =>
  editor.value?.areas?.map(a => ({ identity: a.identity, title: a.title || a.identity })) ?? [],
)

function addArea(): void {
  if (!editor.value)
    return
  editor.value.areas.push({
    identity: '',
    title: '',
    description: '',
  })
}

function removeArea(index: number): void {
  if (!editor.value)
    return
  editor.value.areas.splice(index, 1)
}

/** Заполняет превью по умолчанию: одна колонка - одна область. */
function fillDefaultPreview(): void {
  if (!editor.value?.areas?.length)
    return
  const rows = editor.value.areas.map(a => [a.identity])
  const rowHeights = editor.value.areas.map((): RPageTemplatePreviewSchema['rowHeights'][number] => 'normal')
  editor.value.preview = { rows, rowHeights }
}

const showPreviewJson = ref(false)
const previewJsonText = computed({
  get: () => (editor.value?.preview ? JSON.stringify(editor.value.preview, null, 2) : ''),
  set: (v: string) => {
    if (!editor.value)
      return
    if (!v?.trim()) {
      editor.value.preview = null
      return
    }
    try {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed?.rows))
        editor.value.preview = { rows: parsed.rows, rowHeights: parsed.rowHeights ?? undefined }
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
        Шаблон страницы - {{ editor?.displayName ?? '-' }}
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
                identity
              </Label>
              <Input
                v-model="editor!.identity"
                placeholder="page-template.default"
              />
            </div>

            <div class="space-y-1">
              <Label class="text-xs text-muted-foreground">
                Название
              </Label>
              <Input
                v-model="editor!.displayName"
                placeholder="Шаблон макета"
              />
            </div>
          </div>

          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground">
              Описание
            </Label>
            <Textarea
              v-model="editor!.description"
              rows="3"
              placeholder="Краткое описание шаблона и его назначения"
            />
          </div>
        </Card>

        <Card class="p-4 space-y-3">
          <div class="font-semibold">
            Превью раскладки
          </div>
          <p class="text-xs text-muted-foreground">
            Миниатюра для редактора страницы: строки и колонки областей.
          </p>
          <div v-if="editor?.preview?.rows?.length" class="max-w-md">
            <TemplatePreviewGrid
              :preview="editor.preview"
              :area-labels="areaLabels"
            />
          </div>
          <div v-else class="text-xs text-muted-foreground">
            Превью не задано.
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!editor?.areas?.length"
              @click="fillDefaultPreview"
            >
              Заполнить превью по умолчанию
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="showPreviewJson = !showPreviewJson"
            >
              {{ showPreviewJson ? 'Скрыть JSON' : 'Редактировать JSON' }}
            </Button>
          </div>
          <Textarea
            v-if="showPreviewJson"
            v-model="previewJsonText"
            class="font-mono text-xs min-h-[120px]"
            placeholder='{"rows":[["slot1"],["slot2","slot3"]],"rowHeights":["short","tall"]}'
          />
        </Card>

        <Card class="p-4 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold">
              Области (зоны layout)
            </div>
            <Button size="sm" variant="outline" @click="addArea">
              Добавить область
            </Button>
          </div>

          <div v-if="editor?.areas?.length" class="space-y-3">
            <div
              v-for="(area, idx) in editor!.areas"
              :key="idx"
              class="grid grid-cols-[minmax(0,1.5fr)_auto] gap-3 items-center border rounded-md p-3"
            >
              <div class="space-y-1">
                <Label class="text-xs text-muted-foreground">
                  identity области
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
                  ✕
                </Button>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-muted-foreground">
            Областей пока нет. Добавьте хотя бы одну область, чтобы связать layout с зонами.
          </p>
        </Card>

        <Card class="p-4">
          <BehaviorBindingEditor
            :editor-model="editor"
            owner-type="page-template"
            :owner-id="editor?.id ?? null"
            target-type="page-template"
            :target-id="editor?.id ?? null"
            document-type="page-template"
          />
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>

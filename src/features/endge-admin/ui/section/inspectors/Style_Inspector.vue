<script setup lang="ts">
import type { StyleBlocksPayload } from '@endge/core'
import type { TableTreeRow } from '@/components/ui/table-tree'

import { ComponentType, DomainSectionType, Endge } from '@endge/core'
import { Eraser, Loader2, Paintbrush } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import DomainEntityDropTarget from '@/features/endge-admin/ui/components/DomainEntityDropTarget.vue'
import OpenEntityButton from '@/features/endge-admin/ui/components/OpenEntityButton.vue'

const props = defineProps<{
  tabContext?: { document?: { editor?: { identity: string, displayName: string, styles: Record<string, unknown> }, previewModel?: any, component?: any } }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value)
const isSystem = computed(() => (model.value as { isSystem?: boolean } | null)?.isSystem === true)

async function save(): Promise<void> {
  await EndgeAdmin.tabs.save()
}

// ===== Selector blocks (mock, но завязан на editor.styles) =====

interface PathSegmentUI {
  type: 'component' | 'column'
  refId?: string
}

interface BlockUI {
  path: PathSegmentUI[]
  properties: Array<{ key: string, value: string }>
}

const components = computed(() =>
  Endge.domain.getComponents().map(c => ({ id: c.id, label: (c as { name?: string }).name ?? c.identity ?? c.id })),
)
const tableComponents = computed(() =>
  components.value.filter((c: any) => {
    const comp = Endge.domain.getComponent(c.id)
    return (comp as any)?.type === ComponentType.Table
  }),
)
const tableSelectOptions = computed(() =>
  tableComponents.value.map(c => ({ value: c.id, label: `${c.label} (${c.id})` })),
)

const selectedTableColumnsOptions = computed(() => {
  const tableId = selectedTableId.value
  if (!tableId)
    return []
  const comp = Endge.domain.getComponent(tableId) as any
  if (!comp || comp.type !== ComponentType.Table)
    return []
  const cols = Array.isArray(comp.columns) ? comp.columns : []
  return cols.map((col: any, index: number) => {
    const id = String(col.id ?? index)
    const title = (col.title as string | undefined) ?? id
    return { value: id, label: title }
  })
})

function segmentKeyFromUI(seg: PathSegmentUI): string {
  if ((seg.type === 'component' || seg.type === 'column') && seg.refId)
    return `${seg.type === 'component' ? 'table' : 'column'}:${seg.refId}`
  return 'table:'
}

function payloadFromBlocks(blocks: BlockUI[]): StyleBlocksPayload {
  const out: StyleBlocksPayload = []
  for (const b of blocks) {
    if (!b.path.length)
      continue
    const root: any = {}
    let cursor = root
    for (const seg of b.path) {
      const key = segmentKeyFromUI(seg)
      if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key]))
        cursor[key] = {}
      cursor = cursor[key]
    }
    for (const prop of b.properties) {
      if (!prop.key.trim())
        continue
      const num = Number(prop.value)
      cursor[prop.key.trim()] = Number.isNaN(num) ? prop.value : num
    }
    out.push(root)
  }
  return out
}

function payloadToBlocks(payload: StyleBlocksPayload): BlockUI[] {
  const blocks: BlockUI[] = []
  if (!Array.isArray(payload))
    return blocks

  function segmentFromKey(key: string): PathSegmentUI | null {
    const idx = key.indexOf(':')
    if (idx <= 0)
      return null
    const type = key.slice(0, idx)
    const id = key.slice(idx + 1)
    if (type === 'table')
      return { type: 'component', refId: id || undefined }
    if (type === 'column')
      return { type: 'column', refId: id || undefined }
    return null
  }

  function walk(node: any, path: PathSegmentUI[]): void {
    if (!node || typeof node !== 'object')
      return
    const props: Array<{ key: string, value: string }> = []
    const nested: Array<{ key: string, value: any }> = []

    for (const [k, v] of Object.entries(node)) {
      const seg = segmentFromKey(k)
      if (seg && v && typeof v === 'object' && !Array.isArray(v)) {
        nested.push({ key: k, value: v })
      }
      else if (typeof v === 'string' || typeof v === 'number') {
        props.push({ key: k, value: String(v) })
      }
    }

    if (props.length && path.length) {
      blocks.push({ path: [...path], properties: props })
    }

    for (const n of nested) {
      const seg = segmentFromKey(n.key)
      if (!seg)
        continue
      walk(n.value, [...path, seg])
    }
  }

  payload.forEach((block) => {
    walk(block, [])
  })

  return blocks
}

const ENDGE_STYLE_PREVIEW_ID = 'endge-style-editor-preview'
const ENDGE_GLOBAL_STYLES_ID = 'endge-styles-injected'
const showCssModal = ref(false)
const compiledCssText = ref('')
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите документ
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Идентификатор</label>
          <Input
            :model-value="editor?.identity ?? model?.identity ?? model?.id ?? ''"
            :disabled="isSystem"
            placeholder="например: default"
            @update:model-value="(v) => editor && (editor.identity = String(v ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Название</label>
          <Input
            :model-value="editor?.displayName ?? model?.name ?? ''"
            :disabled="isSystem"
            placeholder="Отображаемое имя"
            @update:model-value="(v) => editor && (editor.displayName = String(v ?? ''))"
          />
        </div>

        <!-- Инспектор селектора перенесён в редактор стилей -->
      </div>
    </ScrollArea>
    <div class="border-t p-4 flex flex-col gap-2">
      <Button class="w-full" :disabled="isSystem || EndgeAdmin.busy.value" @click="save">
        <Loader2 v-if="EndgeAdmin.busy.value" class="size-4 animate-spin mr-2" />
        {{ EndgeAdmin.busy.value ? 'Сохранение…' : 'Сохранить' }}
      </Button>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          class="h-9 w-9 shrink-0"
          aria-label="Применить стили"
          @click="() => {
            if (!editor?.styles) return
            const payload = editor.styles as StyleBlocksPayload
            const css = Endge.styles.compile(payload)
            const existing = document.getElementById(ENDGE_STYLE_PREVIEW_ID)
            if (existing) existing.remove()
            const styleEl = document.createElement('style')
            styleEl.id = ENDGE_STYLE_PREVIEW_ID
            styleEl.textContent = css
            document.head.appendChild(styleEl)
            compiledCssText.value = css || '/* пусто */'
            showCssModal.value = true
          }"
        >
          <Paintbrush class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="h-9 w-9 shrink-0"
          aria-label="Удалить применённые стили"
          @click="() => {
            document.getElementById(ENDGE_STYLE_PREVIEW_ID)?.remove()
            document.getElementById(ENDGE_GLOBAL_STYLES_ID)?.remove()
          }"
        >
          <Eraser class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

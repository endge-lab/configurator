<script setup lang="ts">
import { ComponentType, Endge, RComponentDSL } from '@endge/core'
import { ComponentRenderer } from '@endge/vue'
import { useLocalStorage } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatJsx } from '@/features/endge-admin/tools/format-jsx'
import ScriptEditor from '@/features/endge-admin/ui/components/ScriptEditor.vue'

const SPLIT_MIN = 0.15
const SPLIT_MAX = 0.7
const SPLIT_DEFAULT = 1 / 3

/** Демо-примеры из документации DSL (jsx/). */
const DSL_DEMO_OPTIONS: { id: string; label: string; jsx: string }[] = [
  { id: 'text', label: 'Text', jsx: '<Text bold color="#d32f2f" size="16">Привет, мир</Text>' },
  { id: 'box', label: 'Box', jsx: '<Box p="2" bg="#f0f0f0">\n  <Text>Box с отступами и фоном</Text>\n</Box>' },
  { id: 'flex', label: 'Flex (row)', jsx: '<Flex row>\n  <Text>Первый</Text>\n  <Text>Второй</Text>\n</Flex>' },
  { id: 'flex-col', label: 'Flex (col)', jsx: '<Flex col gap="2">\n  <Text>Сверху</Text>\n  <Text>Снизу</Text>\n</Flex>' },
  { id: 'layout', label: 'Layout', jsx: '<Layout direction="row" gap="1rem" align="center">\n  <Text>Слева</Text>\n  <Text>Справа</Text>\n</Layout>' },
  { id: 'if-else', label: 'If / Else', jsx: '<Text if="{ true }">Показано (if=true)</Text>\n<Text else>Скрыто (else)</Text>' },
  { id: 'datetime', label: 'DateTime', jsx: '<DateTime value="2024-10-01T12:00:00Z" format="dd.MM.yyyy HH:mm" timezone="Europe/Moscow" />' },
  { id: 'tooltip', label: 'Tooltip', jsx: '<Text tooltip:text="Подсказка при наведении">Наведи на меня</Text>' },
  { id: 'styles', label: 'Стили (p, b, r)', jsx: '<Box p="2" b="1 #ddd" r="8">\n  <Text>Отступы, рамка, скругление</Text>\n</Box>' },
]

const version = ref(0)
const previewModel = ref<RComponentDSL>(new RComponentDSL())
const jsxScript = useLocalStorage('dsl-playground-jsx', '<Text>Hello World</Text>')
const selectedDemoId = ref<string>('')
const splitRatio = useLocalStorage('dsl-playground-split', SPLIT_DEFAULT)
const splitContainerRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

function clampSplit(value: number): number {
  return Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, value))
}

function onSplitterMouseDown(e: MouseEvent): void {
  if (e.button !== 0)
    return
  e.preventDefault()
  isDragging.value = true
  document.body.classList.add('select-none')
  document.body.style.cursor = 'ew-resize'
}

function onMouseMove(e: MouseEvent): void {
  if (!isDragging.value || !splitContainerRef.value)
    return
  const rect = splitContainerRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  splitRatio.value = clampSplit(x)
}

function onMouseUp(): void {
  isDragging.value = false
  document.body.classList.remove('select-none')
  document.body.style.cursor = ''
}

onMounted(() => {
  Endge.script.declareJSX()
  previewModel.value.id = 'dsl-playground'
  previewModel.value.name = 'dsl-playground'
  previewModel.value.type = ComponentType.DSL
  compilePreview()
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
})
onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})

function compilePreview(): void {
  try {
    previewModel.value.jsxScript = jsxScript.value
    previewModel.value.compile()
    version.value++
  }
  catch {
    // ignore
  }
}

async function insertDemo(): Promise<void> {
  const opt = DSL_DEMO_OPTIONS.find(o => o.id === selectedDemoId.value)
  if (!opt)
    return
  jsxScript.value = await formatJsx(opt.jsx)
  compilePreview()
}
</script>

<template>
  <div class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0">
        <div class="size-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
          <i class="ti ti-device-gamepad-3 text-orange-600 text-2xl" />
        </div>
        <div class="min-w-0">
          <div class="text-lg font-semibold truncate">
            DSL Песочница
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Select v-model="selectedDemoId">
          <SelectTrigger class="w-[220px] h-9">
            <SelectValue placeholder="Демо-пример из документации" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in DSL_DEMO_OPTIONS"
              :key="opt.id"
              :value="opt.id"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="shrink-0 h-9 w-9"
          title="Подставить пример в редактор"
          :disabled="!selectedDemoId"
          @click="insertDemo"
        >
          <i class="ti ti-file-import text-lg" />
        </Button>
      </div>

      <Card class="flex-1 min-h-0 flex flex-col p-4">
        <div
          ref="splitContainerRef"
          class="flex flex-1 min-h-0 w-full"
        >
          <div
            class="flex flex-col min-h-0 shrink-0 overflow-hidden"
            :style="{ width: `${clampSplit(Number(splitRatio)) * 100}%` }"
          >
            <Label class="font-semibold mb-2">JSX шаблон</Label>
            <ScriptEditor
              v-model="jsxScript"
              class="flex-1 min-h-0"
              @update:model-value="compilePreview"
            />
          </div>
          <div
            class="shrink-0 w-2 cursor-ew-resize hover:bg-primary/20 transition-colors flex items-center justify-center group"
            aria-label="Изменить ширину панелей"
            @mousedown="onSplitterMouseDown"
          >
            <div class="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
          </div>
          <div class="flex flex-col min-h-0 min-w-0 flex-1 overflow-hidden">
            <Label class="font-semibold mb-2">Превью</Label>
            <ScrollArea class="flex-1 border rounded-md min-h-0">
              <ComponentRenderer
                :key="version"
                class="p-4 min-h-full"
                :model="previewModel"
                store-key="dsl-playground"
              />
            </ScrollArea>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

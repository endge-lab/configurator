<script setup lang="ts">
import { ref } from 'vue'

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
import { formatJsx } from '@/features/endge-ide/tools/format-jsx'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

const DSL_DEMO_OPTIONS: { id: string, label: string, jsx: string }[] = [
  { id: 'text', label: 'Text', jsx: '<Text bold color="#d32f2f" size="16">Привет, мир</Text>' },
  { id: 'box', label: 'Box', jsx: '<Box p="2" bg="#f0f0f0">\n  <Text>Box с отступами и фоном</Text>\n</Box>' },
  { id: 'flex', label: 'Flex', jsx: '<Flex row>\n  <Text>Первый</Text>\n  <Text>Второй</Text>\n</Flex>' },
  { id: 'layout', label: 'Layout', jsx: '<Layout direction="row" gap="1rem" align="center">\n  <Text>Слева</Text>\n  <Text>Справа</Text>\n</Layout>' },
  { id: 'datetime', label: 'DateTime', jsx: '<DateTime value="2024-10-01T12:00:00Z" format="dd.MM.yyyy HH:mm" timezone="Europe/Moscow" />' },
]

const jsxScript = useSafeLocalStorage('dsl-playground-jsx', '<Text>Hello World</Text>')
const selectedDemoId = ref('')

async function insertDemo(): Promise<void> {
  const option = DSL_DEMO_OPTIONS.find(item => item.id === selectedDemoId.value)
  if (option) {
    jsxScript.value = await formatJsx(option.jsx)
  }
}

async function formatSource(): Promise<void> {
  jsxScript.value = await formatJsx(jsxScript.value)
}
</script>

<template>
  <div class="w-full h-full p-5 flex flex-col gap-5 min-h-0">
    <div class="flex items-center gap-3 min-w-0">
      <div class="size-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
        <i class="ti ti-file-type-jsx text-orange-600 text-2xl" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-lg font-semibold">
          Legacy DSL source
        </div>
        <div class="text-xs text-muted-foreground">
          Документ доступен для просмотра и редактирования, runtime preview удалён.
        </div>
      </div>
      <Select v-model="selectedDemoId">
        <SelectTrigger class="w-44">
          <SelectValue placeholder="Пример" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in DSL_DEMO_OPTIONS" :key="option.id" :value="option.id">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" :disabled="!selectedDemoId" @click="insertDemo">
        Вставить
      </Button>
      <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
        <SourceFormatButton @click="formatSource" />
      </div>
    </div>

    <Card class="flex-1 min-h-0 flex flex-col p-4">
      <Label class="font-semibold mb-2">JSX source</Label>
      <ScriptEditor v-model="jsxScript" class="flex-1 min-h-0" />
    </Card>
  </div>
</template>

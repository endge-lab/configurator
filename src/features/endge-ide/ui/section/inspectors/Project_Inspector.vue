<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  tabContext?: {
    document?: {
      editor?: { identity: string; displayName: string; extendSettings: boolean; description?: string | null; slug?: string | null; order?: number | null }
      previewModel?: { identity?: string; name?: string; displayName?: string; extendSettings?: boolean; description?: string | null; slug?: string | null; order?: number | null }
      component?: unknown
    }
  }
}>()

const editor = computed(() => props.tabContext?.document?.editor ?? null)
const model = computed(() => props.tabContext?.document?.previewModel ?? props.tabContext?.document?.component ?? editor.value)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="!model" class="flex items-center justify-center h-full text-sm text-muted-foreground">
    Выберите проект
  </div>
  <div v-else class="flex flex-col h-full">
    <ScrollArea class="flex-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <Label class="text-sm font-medium">Идентификатор</Label>
          <Input
            :model-value="editor?.identity ?? (model as { identity?: string })?.identity ?? ''"
            placeholder="my-project"
            @update:model-value="(v) => editor && (editor.identity = String(v ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">Название</Label>
          <Input
            :model-value="editor?.displayName ?? (model as { displayName?: string })?.displayName ?? (model as { name?: string })?.name ?? ''"
            placeholder="Мой проект"
            @update:model-value="(v) => editor && (editor.displayName = String(v ?? ''))"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">Slug (URL)</Label>
          <Input
            :model-value="editor?.slug ?? (model as { slug?: string })?.slug ?? ''"
            placeholder="my-project"
            @update:model-value="(v) => editor && (editor.slug = v || null)"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">Описание</Label>
          <textarea
            :value="editor?.description ?? (model as { description?: string })?.description ?? ''"
            class="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Краткое описание"
            @input="(e) => editor && (editor.description = (e.target as HTMLTextAreaElement).value || null)"
          />
        </div>
        <div class="space-y-2">
          <Label class="text-sm font-medium">Порядок сортировки</Label>
          <Input
            type="number"
            :model-value="editor?.order ?? (model as { order?: number })?.order ?? ''"
            placeholder="0"
            @update:model-value="(v) => editor && (editor.order = v === '' || v == null ? null : Number(v))"
          />
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            :checked="editor?.extendSettings ?? (model as { extendSettings?: boolean })?.extendSettings ?? true"
            @update:checked="(v) => editor && (editor.extendSettings = !!v)"
          />
          <Label class="text-sm">Наследовать настройки</Label>
        </div>
      </div>
    </ScrollArea>
    <div class="border-t p-4">
      <Button class="w-full" :disabled="isBusy" @click="save">
        <Loader2 v-if="isBusy" class="size-4 animate-spin mr-2" />
        {{ isBusy ? 'Сохранение…' : 'Сохранить' }}
      </Button>
    </div>
  </div>
</template>

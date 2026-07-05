<script setup lang="ts">
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'

import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Endge } from '@endge/core'
import { uiEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'

const props = defineProps<{
  state?: UIEditorDemoState
}>()

const state = computed<UIEditorDemoState>(() => props.state ?? uiEditorDemoState)

const selectedNode = computed<UIEditorNode | null>(() => state.value.getSelectedNode())
const selectedProps = computed<Record<string, any>>(() => ((selectedNode.value?.props as Record<string, any> | undefined) ?? {}))
const selectedDefinition = computed(() => selectedNode.value ? Endge.uiRegistry.getDefinition(selectedNode.value.definitionRef) : null)
const canEditRendererRef = computed(() => selectedDefinition.value?.allowsRendererRefOverride === true)
const selectedSourceType = computed<string>(() => String(selectedNode.value?.meta?.sourceType ?? 'definition'))
const selectedSourceLabel = computed<string>(() => {
  const node = selectedNode.value
  if (!node) {
    return ''
  }

  const explicit = String(node.meta?.sourceLabel ?? '').trim()
  if (explicit) {
    return explicit
  }

  return selectedDefinition.value?.title ?? node.name
})
const selectedSourceSummary = computed<string>(() => {
  if (selectedSourceType.value === 'preset') {
    return 'Preset component'
  }
  if (selectedSourceType.value === 'jsx') {
    return 'JSX component'
  }
  return 'Definition component'
})

function updateNumeric(field: string, value: string | number): void {
  const node = selectedNode.value
  if (!node) {
    return
  }
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return
  }
  state.value.patchNodeProps(node.id, { [field]: numericValue })
}

</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden border border-border/70 bg-card/95">
    <div class="border-b border-border/70 px-4 py-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-foreground">
          Inspector
        </h3>
      </div>
    </div>

    <ScrollArea class="flex-1">
      <div class="space-y-4 p-4">
        <div v-if="selectedNode" class="space-y-4">
          <div class="space-y-2 border border-border/70 bg-muted/15 p-3">
            <div class="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Definition
            </div>
            <div class="text-sm font-medium text-foreground">
              {{ selectedDefinition?.title ?? selectedNode.definitionRef }}
            </div>
            <div class="font-mono text-[11px] text-muted-foreground">
              {{ selectedNode.definitionRef }}
            </div>
            <div v-if="selectedDefinition?.description" class="text-xs text-muted-foreground">
              {{ selectedDefinition.description }}
            </div>
          </div>

          <div v-if="selectedNode.kind !== 'page'" class="space-y-3 border border-border/70 bg-muted/15 p-3">
            <div class="space-y-2">
              <Label>Width span</Label>
              <Input
                type="number"
                min="1"
                max="12"
                :model-value="selectedNode.layout?.span ?? 12"
                @update:model-value="value => state.patchNodeLayout(selectedNode.id, { span: Number(value) })"
              />
            </div>
            <div class="space-y-2">
              <Label>Height rows</Label>
              <Input
                type="number"
                min="1"
                max="40"
                :model-value="selectedNode.layout?.rowSpan ?? 4"
                @update:model-value="value => state.patchNodeLayout(selectedNode.id, { rowSpan: Number(value) })"
              />
            </div>
          </div>

          <div
            v-if="selectedNode.kind === 'page'"
            class="space-y-3"
          >
            <div class="space-y-2">
              <Label>Title</Label>
              <Input
                :model-value="selectedProps.title"
                @update:model-value="value => state.patchNodeProps(selectedNode.id, { title: String(value ?? '') })"
              />
            </div>
            <div class="space-y-2">
              <Label>Gap</Label>
              <Input
                type="number"
                :model-value="selectedProps.gap"
                @update:model-value="value => updateNumeric('gap', value as string)"
              />
            </div>
            <div class="space-y-2">
              <Label>Padding</Label>
              <Input
                type="number"
                :model-value="selectedProps.padding"
                @update:model-value="value => updateNumeric('padding', value as string)"
              />
            </div>
            <div class="space-y-2">
              <Label>Row height</Label>
              <Input
                type="number"
                min="20"
                :model-value="selectedProps.rowHeight"
                @update:model-value="value => updateNumeric('rowHeight', value as string)"
              />
            </div>
          </div>

          <div v-if="selectedNode.kind !== 'page'" class="space-y-3 border border-border/70 bg-muted/15 p-3">
            <div class="space-y-1">
              <div class="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Source
              </div>
              <div class="text-sm font-medium text-foreground">
                {{ selectedSourceLabel }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ selectedSourceSummary }}
              </div>
              <div
                v-if="selectedDefinition?.configKind && selectedSourceType !== 'definition'"
                class="text-xs text-muted-foreground"
              >
                Внутренние config/asset ссылки скрыты и управляются через catalog source.
              </div>
            </div>
          </div>

          <div
            v-if="selectedNode.kind === 'flex'"
            class="space-y-3"
          >
            <div class="space-y-2">
              <Label>Direction</Label>
              <Select
                :model-value="selectedProps.direction"
                @update:model-value="value => state.patchNodeProps(selectedNode.id, { direction: value === 'row' ? 'row' : 'column' })"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите направление" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="column">
                    Column
                  </SelectItem>
                  <SelectItem value="row">
                    Row
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Gap</Label>
              <Input
                type="number"
                :model-value="selectedProps.gap"
                @update:model-value="value => updateNumeric('gap', value as string)"
              />
            </div>
            <div class="space-y-2">
              <Label>Padding</Label>
              <Input
                type="number"
                :model-value="selectedProps.padding"
                @update:model-value="value => updateNumeric('padding', value as string)"
              />
            </div>
          </div>

          <div
            v-if="selectedNode.kind === 'grid'"
            class="space-y-3"
          >
            <div class="space-y-2">
              <Label>Columns</Label>
              <Input
                type="number"
                :model-value="selectedProps.columns"
                @update:model-value="value => updateNumeric('columns', value as string)"
              />
            </div>
            <div class="space-y-2">
              <Label>Gap</Label>
              <Input
                type="number"
                :model-value="selectedProps.gap"
                @update:model-value="value => updateNumeric('gap', value as string)"
              />
            </div>
            <div class="space-y-2">
              <Label>Padding</Label>
              <Input
                type="number"
                :model-value="selectedProps.padding"
                @update:model-value="value => updateNumeric('padding', value as string)"
              />
            </div>
            <div class="space-y-2">
              <Label>Min height</Label>
              <Input
                type="number"
                :model-value="selectedProps.minHeight"
                @update:model-value="value => updateNumeric('minHeight', value as string)"
              />
            </div>
          </div>

          <div
            v-if="selectedNode.kind === 'box'"
            class="space-y-3"
          >
            <div class="space-y-2">
              <Label>Title</Label>
              <Input
                :model-value="selectedProps.title"
                @update:model-value="value => state.patchNodeProps(selectedNode.id, { title: String(value ?? '') })"
              />
            </div>
            <div class="space-y-2">
              <Label>Padding</Label>
              <Input
                type="number"
                :model-value="selectedProps.padding"
                @update:model-value="value => updateNumeric('padding', value as string)"
              />
            </div>
          </div>

          <div
            v-if="selectedNode.kind === 'custom-component'"
            class="space-y-3"
          >
            <div class="space-y-2">
              <Label>Title</Label>
              <Input
                :model-value="selectedProps.title"
                @update:model-value="value => state.patchNodeProps(selectedNode.id, { title: String(value ?? '') })"
              />
            </div>
            <div v-if="canEditRendererRef" class="space-y-2">
              <Label>Renderer ref</Label>
              <Input
                :model-value="selectedProps.rendererRef"
                placeholder="repo.custom.component"
                @update:model-value="value => state.patchNodeProps(selectedNode.id, { rendererRef: String(value ?? '') })"
              />
            </div>
            <div class="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {{ selectedDefinition?.stubDescription || 'Placeholder для definition-компонента. Позже сюда можно будет привязать live renderer через registry/resolver.' }}
            </div>
          </div>

          <div
            v-if="selectedNode.kind === 'text'"
            class="space-y-2"
          >
            <Label>Text</Label>
            <Textarea
              :model-value="selectedProps.text"
              :rows="4"
              @update:model-value="value => state.patchNodeProps(selectedNode.id, { text: String(value ?? '') })"
            />
          </div>

          <div
            v-if="selectedNode.kind === 'button'"
            class="space-y-2"
          >
            <Label>Label</Label>
            <Input
              :model-value="selectedProps.label"
              @update:model-value="value => state.patchNodeProps(selectedNode.id, { label: String(value ?? '') })"
            />
          </div>
        </div>

        <div v-else class="border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
          Выберите узел на холсте, чтобы редактировать его props.
        </div>
      </div>
    </ScrollArea>

    <div class="border-t border-border/70 bg-background/90 px-4 py-3">
      <Button variant="outline" class="w-full" @click="state.reset()">
        Сбросить макет
      </Button>
    </div>
  </div>
</template>

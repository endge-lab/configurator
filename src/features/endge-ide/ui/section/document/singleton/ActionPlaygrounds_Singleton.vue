<script setup lang="ts">
import type { EndgeFlowDefinition } from '@endge/core'

import { RField } from '@endge/core'
import { StorageSerializers } from '@vueuse/core'
import { ref, watch } from 'vue'

import { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'
import EndgeFlowEditor from '@/features/endge-ide/ui/section/action/EndgeFlowEditor.vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

interface PlaygroundPersistedState {
  identity: string
  displayName: string
  description: string | null
  active: boolean
  input: {
    name: string
    type: string
    isArray: boolean
    optional: boolean
  } | null
  output: {
    name: string
    type: string
    isArray: boolean
    optional: boolean
  } | null
  flow: EndgeFlowDefinition
}

function createDefaultPlaygroundFlow(): EndgeFlowDefinition {
  return {
    version: 1,
    entrypoint: 'flow-entry',
    nodes: [],
    edges: [],
  }
}

function createPlaygroundEditor(snapshot?: PlaygroundPersistedState | null): RActionEditor {
  const editor = new RActionEditor()
  editor.id = 0
  editor.identity = snapshot?.identity || 'playground.action'
  editor.displayName = snapshot?.displayName || 'Action Playground'
  editor.description = snapshot?.description ?? 'Локальный playground для тестирования flow blocks.'
  editor.active = snapshot?.active ?? true
  editor.input = snapshot?.input
    ? new RField(
        snapshot.input.name,
        snapshot.input.type,
        snapshot.input.isArray === true,
        snapshot.input.optional === true,
      )
    : null
  editor.output = snapshot?.output
    ? new RField(
        snapshot.output.name,
        snapshot.output.type,
        snapshot.output.isArray === true,
        snapshot.output.optional === true,
      )
    : null
  editor.flowEditor.fillFromDefinition(snapshot?.flow ?? createDefaultPlaygroundFlow())
  editor.syncDefinitionFromFlowEditor()
  return editor
}

function toPersistedState(editor: RActionEditor): PlaygroundPersistedState {
  return {
    identity: editor.identity,
    displayName: editor.displayName,
    description: editor.description ?? null,
    active: editor.active,
    input: editor.input
      ? {
          name: editor.input.name,
          type: editor.input.type,
          isArray: editor.input.isArray === true,
          optional: editor.input.optional === true,
        }
      : null,
    output: editor.output
      ? {
          name: editor.output.name,
          type: editor.output.type,
          isArray: editor.output.isArray === true,
          optional: editor.output.optional === true,
        }
      : null,
    flow: editor.flowEditor.toDefinition(),
  }
}

const persistedPlayground = useSafeLocalStorage<PlaygroundPersistedState | null>(
  'endge-action-playground',
  null,
  {
    serializer: StorageSerializers.object,
  },
)
const editor = ref<RActionEditor>(createPlaygroundEditor(persistedPlayground.value))

watch(editor, () => {
  persistedPlayground.value = toPersistedState(editor.value)
}, { deep: true })
</script>

<template>
  <div class="h-full w-full">
    <div class="flex h-full min-h-0 flex-col gap-5 p-5">
      <EndgeFlowEditor v-model="editor" />
    </div>
  </div>
</template>

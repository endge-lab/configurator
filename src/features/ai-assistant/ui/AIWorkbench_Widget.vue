<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { Bot, Loader2, Plus, Send } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { AIWorkbench } from '@/features/ai-assistant/model/AIWorkbench_Module'

const prompt = ref('')
const viewport = ref<HTMLElement | null>(null)
const state = AIWorkbench.state
const models = AIWorkbench.enabledModels
const currentModelAvailable = computed(() => models.value.some(model => model.id === state.conversation?.model.profileId))
const hasMessages = computed(() => (state.conversation?.messageCount ?? state.messages.length) > 0)
const readOnly = computed(() => hasMessages.value && !currentModelAvailable.value)
const canSend = computed(() => state.capabilities?.canRun === true && !!state.selectedModelId && !readOnly.value && !state.running)
const showConfigurationEmptyState = computed(() => models.value.length === 0 && !hasMessages.value && !state.streamingText && !state.loading)

watch(() => [state.messages.length, state.streamingText], async () => {
  await nextTick()
  viewport.value?.scrollTo({ top: viewport.value.scrollHeight, behavior: 'smooth' })
})

async function send(): Promise<void> {
  const value = prompt.value
  if (!canSend.value || !value.trim()) {
    return
  }
  prompt.value = ''
  await AIWorkbench.send(value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void send()
  }
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-background">
    <Loader2 v-if="state.loading && models.length === 0 && !hasMessages" class="m-auto size-5 animate-spin text-muted-foreground" />

    <div v-else-if="showConfigurationEmptyState" class="m-auto flex max-w-xs flex-col items-center px-5 text-center">
      <span class="flex size-12 items-center justify-center rounded-xl bg-fuchsia-500/10">
        <Bot class="size-6 text-fuchsia-500" />
      </span>
      <p class="mt-4 text-sm font-semibold">
        Модели не настроены
      </p>
      <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
        Добавьте личное подключение или попросите Platform Admin настроить общее.
      </p>
      <Button class="mt-5 w-full" size="lg" @click="AIWorkbench.openManagement()">
        Настроить подключение
      </Button>
    </div>

    <template v-else>
    <header class="flex items-center gap-2 border-b px-3 py-2">
      <Bot class="size-4 text-fuchsia-500" />
      <select
        class="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
        :value="state.selectedModelId"
        :disabled="(hasMessages && !readOnly) || state.running || models.length === 0"
        aria-label="Модель AI"
        @change="AIWorkbench.setModel(($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>
          Выберите модель
        </option>
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.displayName }} · {{ model.adapter }}
        </option>
      </select>
      <Button size="icon" variant="ghost" :disabled="!state.selectedModelId || state.running" title="Создать новый диалог" @click="AIWorkbench.newConversation()">
        <Plus class="size-4" />
      </Button>
    </header>

    <ScrollArea class="min-h-0 flex-1">
      <div ref="viewport" class="flex min-h-full flex-col gap-3 p-3">
        <Button v-if="state.previousCursor" size="sm" variant="ghost" :disabled="state.loading" class="self-center text-xs" @click="AIWorkbench.loadPrevious()">
          Загрузить предыдущие сообщения
        </Button>

        <div v-if="!state.loading && state.messages.length === 0 && !state.streamingText" class="m-auto max-w-xs text-center text-sm text-muted-foreground">
          <Bot class="mx-auto mb-3 size-8 opacity-50" />
          <p>
            Задайте вопрос о текущем Workspace.
          </p>
        </div>

        <article
          v-for="message in state.messages"
          :key="message.id"
          class="max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed"
          :class="message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'mr-auto border bg-muted/40'"
        >
          {{ message.content }}
        </article>
        <article v-if="state.streamingText" class="mr-auto max-w-[92%] whitespace-pre-wrap rounded-xl border bg-muted/40 px-3 py-2 text-sm leading-relaxed">
          {{ state.streamingText }}<span class="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-fuchsia-500" />
        </article>
      </div>
    </ScrollArea>

    <div v-if="readOnly" class="border-t bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      Модель этого диалога удалена или отключена. История доступна только для чтения — создайте новый диалог.
    </div>
    <div v-if="state.error" class="border-t bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {{ state.error }}
    </div>
    <footer class="border-t p-3">
      <div class="flex items-end gap-2">
        <Textarea
          v-model="prompt"
          class="min-h-16 resize-none text-sm"
          :disabled="!canSend"
          :placeholder="models.length === 0 ? 'Модели не настроены' : readOnly ? 'Диалог доступен только для чтения' : 'Сообщение ассистенту…'"
          @keydown="onKeydown"
        />
        <Button size="icon" :disabled="!canSend || !prompt.trim()" @click="send">
          <Loader2 v-if="state.running" class="size-4 animate-spin" />
          <Send v-else class="size-4" />
        </Button>
      </div>
    </footer>
    </template>
  </section>
</template>

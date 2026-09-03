<script setup lang="ts">
import { Bot, Loader2, MessageCircleQuestion, Plus, Send } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import { AIWorkbench } from '@/features/ai-assistant/AIWorkbench_Module'
import { Button } from '@/shared/ui/button'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Textarea } from '@/shared/ui/textarea'

const prompt = ref('')
const viewport = ref<HTMLElement | null>(null)
const state = AIWorkbench.state
const models = AIWorkbench.enabledModels
const currentModelAvailable = computed(() => models.value.some(model => model.id === state.conversation?.model.profileId))
const hasMessages = computed(() => (state.conversation?.messageCount ?? state.messages.length) > 0)
const readOnly = computed(() => hasMessages.value && !currentModelAvailable.value)
const canSend = computed(() => state.capabilities?.canRun === true && !!state.selectedModelId && !readOnly.value && !state.running)
const showConfigurationEmptyState = computed(() => models.value.length === 0 && !hasMessages.value && !state.streamingText && !state.loading)
const clarificationQuestionInHistory = computed(() => state.openClarification
  ? state.messages.some(message => message.role === 'assistant' && message.content === state.openClarification?.question)
  : false)

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
        {{ $t('uiText.modelsNotConfigured0db91768') }}
      </p>
      <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
        {{ $t('uiText.addAPersonalConnectionOrAskAPlatformAdminToSetUpASha7d1ccaac') }}
      </p>
      <Button class="mt-5 w-full" size="lg" @click="AIWorkbench.openManagement()">
        {{ $t('uiText.configureConnection31457710') }}
      </Button>
    </div>

    <template v-else>
      <header class="flex items-center gap-2 border-b px-3 py-2">
        <Bot class="size-4 text-fuchsia-500" />
        <select
          class="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
          :value="state.selectedModelId"
          :disabled="(hasMessages && !readOnly) || state.running || models.length === 0"
          :aria-label="$t('aiWorkbench.widget.model')"
          @change="AIWorkbench.setModel(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>
            {{ $t('uiText.selectModel78923c3f') }}
          </option>
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.displayName }} {{ $t('uiText.symbol1fdf0d90') }} {{ model.adapter }}
          </option>
        </select>
        <Button size="icon" variant="ghost" :disabled="!state.selectedModelId || state.running" :title="$t('aiWorkbench.widget.newDialog')" @click="AIWorkbench.newConversation()">
          <Plus class="size-4" />
        </Button>
      </header>

      <ScrollArea class="min-h-0 flex-1">
        <div ref="viewport" class="flex min-h-full flex-col gap-3 p-3">
          <Button v-if="state.previousCursor" size="sm" variant="ghost" :disabled="state.loading" class="self-center text-xs" @click="AIWorkbench.loadPrevious()">
            {{ $t('uiText.loadPreviousMessagesdc068b65') }}
          </Button>

          <div v-if="!state.loading && state.messages.length === 0 && !state.streamingText" class="m-auto max-w-xs text-center text-sm text-muted-foreground">
            <Bot class="mx-auto mb-3 size-8 opacity-50" />
            <p>
              {{ $t('uiText.askAQuestionAboutTheCurrentWorkspacefda86fe9') }}
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

          <section v-if="state.openClarification" class="mr-auto w-full max-w-[92%] rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
            <div v-if="!clarificationQuestionInHistory" class="flex items-start gap-2 text-sm font-medium">
              <MessageCircleQuestion class="mt-0.5 size-4 shrink-0 text-fuchsia-500" />
              <span>{{ state.openClarification.question }}</span>
            </div>
            <div v-if="state.openClarification.candidates.length" class="mt-3 flex flex-wrap gap-2">
              <Button
                v-for="candidate in state.openClarification.candidates"
                :key="candidate.candidateId"
                size="sm"
                variant="outline"
                :disabled="state.running"
                @click="AIWorkbench.answerClarification(candidate)"
              >
                <span class="flex min-w-0 flex-col items-start text-left">
                  <span class="max-w-56 truncate">{{ candidate.displayName || candidate.identity }}</span>
                  <span class="max-w-56 truncate text-[10px] font-normal text-muted-foreground">
                    {{ candidate.documentType }} {{ $t('uiText.symbol1fdf0d90') }} {{ candidate.identity }}
                  </span>
                </span>
              </Button>
            </div>
            <Button class="mt-2 px-0 text-xs" size="sm" variant="link" :disabled="state.running" @click="AIWorkbench.startIndependentQuestion()">
              {{ $t('aiWorkbench.widget.newQuestion') }}
            </Button>
          </section>
        </div>
      </ScrollArea>

      <div v-if="readOnly" class="border-t bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        {{ $t('uiText.thisDialogModelHasBeenDeletedOrDisabledHistoryIsReadfef302d1') }}
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
            :placeholder="models.length === 0 ? $t('aiWorkbench.widget.modelsUnavailable') : readOnly ? $t('aiWorkbench.widget.readOnly') : $t('aiWorkbench.widget.messagePlaceholder')"
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

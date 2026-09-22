<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import { computed, useId } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const props = defineProps<{
  documentId?: string | number | null
}>()

const inputId = `document-id-${useId()}`
const documentIdText = computed(() => String(props.documentId ?? ''))

async function copyDocumentId(): Promise<void> {
  if (!documentIdText.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(documentIdText.value)
    toast.success('ID скопирован')
  }
  catch {
    toast.error('Не удалось скопировать ID')
  }
}
</script>

<template>
  <div class="space-y-2">
    <Label :for="inputId">{{ $t('uiText.id89f89c02') }}</Label>
    <div class="flex items-center gap-2">
      <Input
        :id="inputId"
        :model-value="documentIdText"
        class="font-mono"
        disabled
      />
      <TooltipProvider :delay-duration="200">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              size="icon"
              variant="outline"
              class="size-9 shrink-0"
              aria-label="Скопировать ID"
              :disabled="!documentIdText"
              @click="copyDocumentId"
            >
              <Copy class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ $t('uiText.copyIDb4d7e208') }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>

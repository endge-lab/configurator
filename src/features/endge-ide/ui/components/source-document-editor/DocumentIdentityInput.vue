<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import { computed, useAttrs } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: string | number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const attrs = useAttrs()
const identityText = computed(() => String(props.modelValue ?? ''))

async function copyIdentity(): Promise<void> {
  if (!identityText.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(identityText.value)
    toast.success('Identity скопирован')
  }
  catch {
    toast.error('Не удалось скопировать identity')
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Input
      v-bind="attrs"
      :model-value="identityText"
      @update:model-value="emit('update:modelValue', String($event ?? ''))"
    />
    <TooltipProvider :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            type="button"
            size="icon"
            variant="outline"
            class="size-9 shrink-0"
            aria-label="Скопировать identity"
            :disabled="!identityText"
            @click="copyIdentity"
          >
            <Copy class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ $t('uiText.copyIdentity59e71fc3') }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

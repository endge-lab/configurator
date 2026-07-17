<script setup lang="ts">
import { GitBranchPlus, RotateCcw } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

defineProps<{
  label: string
  inherited?: boolean
  overridden?: boolean
}>()

const emit = defineEmits<{
  enable: []
  reset: []
}>()
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-3">
      <Label>{{ label }}</Label>
      <Button
        v-if="inherited"
        type="button"
        variant="ghost"
        size="icon"
        class="size-8"
        :title="overridden ? 'Вернуть наследование' : 'Переопределить значение'"
        @click="overridden ? emit('reset') : emit('enable')"
      >
        <RotateCcw v-if="overridden" class="size-4" />
        <GitBranchPlus v-else class="size-4" />
      </Button>
    </div>
    <slot
      :disabled="inherited && !overridden"
      inherited-placeholder="Значение определяется контекстом"
    />
    <p v-if="inherited && !overridden" class="text-xs text-muted-foreground">
      Наследуется из предыдущих слоёв конфигурации
    </p>
  </div>
</template>

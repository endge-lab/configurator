<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = withDefaults(defineProps<{ modelValue: string, label: string, secret?: boolean, placeholder?: string }>(), {
  secret: true,
  placeholder: '{VARIABLE} или тестовое значение',
})
const emit = defineEmits<{ 'update:modelValue': [string] }>()
const revealed = ref(false)
const literal = computed(() => {
  const value = props.modelValue.trim()
  return Boolean(value) && !/^\{[A-Z_][\w.-]*\}$/i.test(value)
})
</script>

<template>
  <div class="space-y-1.5">
    <Label class="text-xs text-muted-foreground">{{ label }}</Label>
    <div class="flex gap-2">
      <Input :model-value="modelValue" :type="secret && !revealed ? 'password' : 'text'" :placeholder="placeholder" autocomplete="off" @update:model-value="emit('update:modelValue', String($event ?? ''))" />
      <Button v-if="secret" type="button" size="icon" variant="outline" @click="revealed = !revealed">
        <EyeOff v-if="revealed" class="size-4" /><Eye v-else class="size-4" />
      </Button>
    </div>
    <p v-if="literal" class="text-xs text-destructive">
      Литеральное значение будет открыто храниться в workspace, API, истории и экспортах и останется доступно через DevTools.
    </p>
  </div>
</template>

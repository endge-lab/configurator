<script setup lang="ts">
const props = defineProps<{
  tabContext?: {
    document?: {
      model?: {
        identity?: string
        displayName?: string
        adapterId?: string
        active?: boolean
      }
    }
  }
}>()
</script>

<template>
  <div class="p-3 space-y-3 text-sm">
    <div class="font-medium">
      Профиль авторизации
    </div>
    <div class="grid gap-2 text-xs">
      <div>
        <span class="text-muted-foreground">identity:</span>
        {{ props.tabContext?.document?.model?.identity ?? '-' }}
      </div>
      <div>
        <span class="text-muted-foreground">adapter:</span>
        {{ props.tabContext?.document?.model?.adapterId ?? '-' }}
      </div>
      <div>
        <span class="text-muted-foreground">active:</span>
        {{ props.tabContext?.document?.model?.active !== false ? 'true' : 'false' }}
      </div>
    </div>
  </div>
</template>

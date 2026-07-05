<script setup lang="ts">
import { ComponentType } from '@endge/core'

interface Props {
  value: ComponentType
}

const props = withDefaults(defineProps<Props>(), {})
</script>

<template>
  <Tag
    v-if="props.value === ComponentType.Component"
    severity="success"
    value="Компонент"
    class="text-xs"
  ></Tag>
  <Tag
    v-else-if="props.value === ComponentType.Html"
    severity="info"
    value="html"
    class="text-xs"
  ></Tag>
</template>

<style scoped lang="scss"></style>

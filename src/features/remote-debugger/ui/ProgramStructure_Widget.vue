<script setup lang="ts">
import { Endge } from '@endge/core'
import { computed, onBeforeUnmount, ref } from 'vue'
import DomainWidget from '@/features/endge-ide/ui/widgets/Domain_Widget.vue'

const revision = ref(0)
const off = Endge.program.subscribe(() => {
  revision.value++
})
onBeforeUnmount(off)
const catalog = computed(() => {
  void revision.value
  return Endge.program.catalog
})
</script>

<template>
  <DomainWidget :key="Endge.program.programId ?? ''" :program-catalog="catalog" />
</template>

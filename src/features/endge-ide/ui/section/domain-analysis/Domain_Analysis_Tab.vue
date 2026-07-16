<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { Paintbrush } from 'lucide-vue-next'
</script>

<template>
  <div class="flex h-full min-h-0 items-center justify-center p-8">
    <div class="max-w-lg text-center">
      <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-fuchsia-500/10">
        <Paintbrush class="size-5 text-fuchsia-500" />
      </div>
      <h2 class="text-base font-semibold">
        EndgeCSS analysis
      </h2>
      <p class="mt-2 text-sm leading-6 text-muted-foreground">
        RStyle documents now keep canonical source text. Syntax diagnostics and compiled artifacts will appear here after the EndgeCSS parser and compiler are introduced.
      </p>
    </div>
  </div>
</template>

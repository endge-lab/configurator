<script setup lang="ts">
import type { ModuleManifest } from '@endge/core'
import { Download, FileText } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

defineProps<{ manifest: ModuleManifest, archiveUrl: string }>()
const { t } = useI18n()
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        :aria-label="t('moduleCatalog.versionDetails', { version: manifest.version })"
        :title="t('moduleCatalog.versionDetails', { version: manifest.version })"
      >
        <FileText aria-hidden="true" />
      </Button>
    </DialogTrigger>

    <DialogContent class="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-xl">
      <DialogHeader class="min-w-0 pe-6">
        <DialogTitle class="break-words">
          {{ t('moduleCatalog.versionDetails', { version: manifest.version }) }}
        </DialogTitle>
        <DialogDescription class="break-all font-mono">
          {{ manifest.identity }}
        </DialogDescription>
      </DialogHeader>

      <div class="min-w-0 space-y-4 overflow-y-auto">
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt class="text-muted-foreground">
            {{ t('moduleCatalog.formatVersion') }}
          </dt>
          <dd class="font-mono">
            {{ manifest.formatVersion }}
          </dd>
          <dt class="text-muted-foreground">
            {{ t('moduleCatalog.hostApi') }}
          </dt>
          <dd class="font-mono">
            {{ manifest.hostApi }}
          </dd>
        </dl>

        <section class="space-y-2">
          <h3 class="text-sm font-medium">
            {{ t('moduleCatalog.manifestRenderers') }}
          </h3>
          <div v-if="manifest.contributes?.renderers?.length" class="overflow-x-auto rounded-md border">
            <table class="w-full text-start text-sm">
              <thead class="bg-muted/50 text-muted-foreground">
                <tr class="border-b">
                  <th scope="col" class="px-3 py-2 text-start font-medium">
                    {{ t('moduleCatalog.rendererTag') }}
                  </th>
                  <th scope="col" class="px-3 py-2 text-start font-medium">
                    {{ t('moduleCatalog.name') }}
                  </th>
                  <th scope="col" class="px-3 py-2 text-start font-medium">
                    {{ t('moduleCatalog.rendererId') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="renderer in manifest.contributes.renderers" :key="`${renderer.primitive}/${renderer.id}`" class="border-b last:border-b-0">
                  <td class="break-words px-3 py-2 font-mono">
                    {{ renderer.primitive }}
                  </td>
                  <td class="break-words px-3 py-2">
                    {{ renderer.label }}
                  </td>
                  <td class="break-all px-3 py-2 font-mono">
                    {{ renderer.id }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            {{ t('moduleCatalog.noManifestRenderers') }}
          </p>
        </section>

        <section class="space-y-2">
          <h3 class="text-sm font-medium">
            {{ t('moduleCatalog.manifestTimelinePresets') }}
          </h3>
          <ul v-if="manifest.contributes?.timelinePresets?.length" class="divide-y rounded-md border text-sm">
            <li v-for="preset in manifest.contributes.timelinePresets" :key="preset.name" class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
              <span v-if="preset.label" class="break-words">{{ preset.label }}</span>
              <code class="break-all">{{ preset.name }}</code>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">
            {{ t('moduleCatalog.noManifestTimelinePresets') }}
          </p>
        </section>
      </div>

      <DialogFooter class="flex-row justify-end">
        <Button as-child size="icon-sm" variant="outline">
          <a :href="archiveUrl" download :aria-label="t('moduleCatalog.download')" :title="t('moduleCatalog.download')">
            <Download aria-hidden="true" />
          </a>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

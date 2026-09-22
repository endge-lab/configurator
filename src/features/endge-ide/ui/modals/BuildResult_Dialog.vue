<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

const { t } = useI18n()
const module = EndgeIDE.buildProfiles
const result = module.result
const filename = computed(() => result.value ? `${result.value.name}.endge-bundle.${result.value.fileFormat === 'gzip' ? 'gz' : 'json'}` : '')
const size = computed(() => result.value ? `${(result.value.sizeBytes / 1024).toFixed(1)} KiB (${result.value.sizeBytes} bytes)` : '')
const format = computed(() => result.value?.fileFormat === 'gzip' ? 'Gzip' : 'JSON')
const parameters = computed(() => result.value ? `${result.value.metadata.profile?.displayName ?? t('releaseBuild.defaultProfile')} · ${result.value.metadata.runtime}` : '')
const releaseForm = ref(false)
const name = ref('')
const description = ref('')
const commitMessage = ref('')
const error = ref('')
const canWrite = computed(() => ['editor', 'admin', 'platform_admin'].includes(Configurator.context.workspaceRole ?? ''))
const canCommit = computed(() => ['admin', 'platform_admin'].includes(Configurator.context.workspaceRole ?? ''))
watch(module.resultOpen, (open) => {
  if (open) {
    releaseForm.value = false
    name.value = ''
    description.value = ''
    commitMessage.value = ''
    error.value = ''
  }
})
async function prepare(): Promise<void> {
  error.value = ''
  try {
    await module.prepareRelease()
    releaseForm.value = true
  }
  catch (value) {
    error.value = value instanceof Error ? value.message : String(value)
  }
}
async function publish(): Promise<void> {
  error.value = ''
  try {
    await module.publishResult(name.value, description.value, commitMessage.value)
  }
  catch (value) {
    error.value = value instanceof Error ? value.message : String(value)
  }
}
</script>

<template>
  <Dialog :open="module.resultOpen.value" @update:open="(value) => !value && module.closeResult()">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-xl" @escape-key-down="(event) => module.publishing.value && event.preventDefault()" @interact-outside="(event) => module.publishing.value && event.preventDefault()">
      <DialogHeader>
        <DialogTitle>{{ t('releaseBuild.ready') }}</DialogTitle>
        <DialogDescription>{{ t('releaseBuild.help') }}</DialogDescription>
      </DialogHeader>
      <div v-if="result" class="space-y-3 text-sm" data-testid="build-result">
        <p class="break-all font-medium">
          {{ filename }}
        </p>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt class="text-muted-foreground">
            {{ t('releaseBuild.size') }}
          </dt><dd>{{ size }}</dd>
          <dt class="text-muted-foreground">
            {{ t('releaseBuild.format') }}
          </dt><dd>{{ format }}</dd>
          <dt class="text-muted-foreground">
            {{ t('releaseBuild.parameters') }}
          </dt><dd>{{ parameters }}</dd>
          <dt class="text-muted-foreground">
            {{ t('releaseBuild.ast') }}
          </dt><dd>{{ result.metadata.includeAst ? t('releaseBuild.yes') : t('releaseBuild.no') }}</dd>
          <template v-if="result.source">
            <dt class="text-muted-foreground">
              {{ t('releaseBuild.sourceRevision') }}
            </dt><dd>{{ result.source.headSequence }}</dd>
          </template>
        </dl>
        <p class="text-xs text-muted-foreground">
          {{ t('releaseBuild.currentContext') }}
        </p>
        <p v-if="!result.source" class="text-xs text-muted-foreground">
          {{ t('releaseBuild.noSource') }}
        </p>
        <p v-if="module.publishedRelease.value" role="status" class="rounded border p-3">
          {{ t('releaseBuild.created') }}: {{ module.publishedRelease.value }}
        </p>
        <form v-else-if="releaseForm" id="publish-build" class="space-y-3 border-t pt-3" @submit.prevent="publish">
          <label class="grid gap-1">{{ t('releaseBuild.name') }}<Input v-model="name" required maxlength="160" :disabled="module.publishing.value" /></label>
          <label class="grid gap-1">{{ t('releaseBuild.description') }}<Textarea v-model="description" maxlength="16000" :disabled="module.publishing.value" /></label>
          <template v-if="module.needsCommit.value">
            <p class="text-xs text-muted-foreground">
              {{ t('releaseBuild.commitHelp') }}
            </p>
            <label class="grid gap-1">{{ t('releaseBuild.commitMessage') }}<Input v-model="commitMessage" required maxlength="1000" :disabled="module.publishing.value || !canCommit" /></label>
            <p v-if="!canCommit" class="text-xs text-amber-600">
              {{ t('releaseBuild.noPermission') }}
            </p>
          </template>
          <p v-else class="break-all text-xs text-muted-foreground">
            {{ t('releaseBuild.sourceCommit') }}: {{ module.sourceCommitId.value }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('releaseBuild.releaseGzip') }}
          </p>
        </form>
        <p v-if="error" role="alert" class="text-destructive">
          {{ error }}
        </p>
      </div>
      <DialogFooter class="flex-wrap gap-2">
        <Button variant="ghost" :disabled="module.publishing.value" @click="module.closeResult()">
          {{ t('releaseBuild.close') }}
        </Button>
        <Button variant="outline" @click="module.downloadResult()">
          {{ t('releaseBuild.downloadBundle') }}
        </Button>
        <Button v-if="!releaseForm && !module.publishedRelease.value" :disabled="!result?.source || !canWrite || module.publishing.value" @click="prepare">
          {{ module.publishing.value ? t('releaseBuild.publishing') : t('releaseBuild.createRelease') }}
        </Button>
        <Button v-else-if="!module.publishedRelease.value" type="submit" form="publish-build" :disabled="module.publishing.value || (module.needsCommit.value && !canCommit)">
          {{ module.publishing.value ? t('releaseBuild.publishing') : t('releaseBuild.publish') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

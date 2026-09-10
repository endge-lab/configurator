<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const { t } = useI18n()
const identity = ref('')
const displayName = ref('')
const description = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => {
    if (!submitting.value) {
      emit('update:open', value)
    }
  },
})

watch(() => props.open, (open) => {
  if (open) {
    identity.value = ''
    displayName.value = ''
    description.value = ''
    errorMessage.value = ''
  }
})

/** Отправляет создание один раз; не повторяет его при ошибке обновления списка. */
async function create(): Promise<void> {
  if (submitting.value || !identity.value.trim() || !displayName.value.trim()) {
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const refreshed = await Configurator.createWorkspace({
      identity: identity.value,
      displayName: displayName.value,
      description: description.value,
    })
    emit('update:open', false)
    toast.success(t('workspaceTree.created'), { description: displayName.value.trim() })
    if (!refreshed) {
      toast.warning(t('workspaceTree.refreshFailed'))
    }
  }
  catch (error) {
    const code = error instanceof Error ? error.message : ''
    errorMessage.value = code === 'workspace_identity_conflict'
      ? t('workspaceTree.identityConflict')
      : code === 'workspace_creation_forbidden'
        ? t('workspaceTree.creationForbidden')
        : t('workspaceTree.createFailed')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('workspaceTree.create') }}</DialogTitle>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="create">
        <div class="space-y-2">
          <Label for="create-workspace-name">{{ t('workspaceTree.displayName') }}</Label>
          <Input id="create-workspace-name" v-model="displayName" required :disabled="submitting" />
        </div>
        <div class="space-y-2">
          <Label for="create-workspace-identity">{{ t('workspaceTree.identity') }}</Label>
          <Input id="create-workspace-identity" v-model="identity" required :maxlength="160" :disabled="submitting" />
        </div>
        <div class="space-y-2">
          <Label for="create-workspace-description">{{ t('workspaceTree.description') }}</Label>
          <Textarea id="create-workspace-description" v-model="description" :disabled="submitting" :rows="3" />
        </div>
        <p v-if="errorMessage" role="alert" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="openModel = false">
            {{ t('uiText.cancel555ad1c0') }}
          </Button>
          <Button type="submit" :disabled="submitting || !identity.trim() || !displayName.trim()">
            {{ submitting ? t('uiText.creating573e3eda') : t('uiText.create84370a20') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

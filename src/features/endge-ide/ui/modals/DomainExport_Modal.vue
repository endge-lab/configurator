<script setup lang="ts">
import type { ServiceBackendDomainExportOptions } from '@/features/endge-ide/domain/types/domain-transfer.type'

import { Download, KeyRound, Loader2, ShieldAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

type TransferMode = 'none' | 'own' | 'all'

const openState = ref(false)
const activeTab = ref<'data' | 'protection'>('data')
const privateBuildProfiles = ref<TransferMode>('own')
const privateAIConnections = ref<TransferMode>('none')
const includePublicAI = ref(false)
const password = ref('')
const confirmPassword = ref('')
const acknowledgePlaintext = ref(false)
const exporting = ref(false)

const session = computed(() => Configurator.session.state.status === 'authenticated' ? Configurator.session.state.session : null)
const platformAdmin = computed(() => session.value?.platformAdmin === true)
const workspaceAdmin = computed(() => Configurator.context.workspaceRole === 'admin' || platformAdmin.value)
const includesAI = computed(() => privateAIConnections.value !== 'none' || includePublicAI.value)
const needsPlaintextAcknowledgement = computed(() => includesAI.value && password.value.length === 0)
const passwordMismatch = computed(() => password.value.length > 0 && password.value !== confirmPassword.value)
const canExport = computed(() => !exporting.value && !passwordMismatch.value && (!needsPlaintextAcknowledgement.value || acknowledgePlaintext.value))
const copy = {
  title: 'Экспорт workspace',
  description: 'Выберите операционные данные и способ защиты переносимого файла.',
  data: 'Данные',
  protection: 'Защита',
  privateProfiles: 'Личные профили сборки',
  privateAI: 'Личные AI-подключения и ключи',
  none: 'Не включать',
  own: 'Только мои',
  allProfiles: 'Все в workspace',
  allPrivate: 'Все личные',
  publicAI: 'Публичный AI-каталог',
  platformOnly: 'Доступно только Platform Admin',
  filePassword: 'Пароль файла',
  protectionHint: 'Если пароль задан, весь внутренний JSON шифруется. Пароль нигде не сохраняется.',
  password: 'Пароль',
  repeatPassword: 'Повторите пароль',
  mismatch: 'Пароли не совпадают.',
  plaintextWarning: 'Без пароля выбранные AI credentials попадут в JSON открытым текстом.',
  plaintextAction: 'Подтвердите риск на вкладке «Защита» или задайте пароль.',
  acknowledge: 'Я понимаю риск и хочу скачать незашифрованный файл',
  cancel: 'Отмена',
  download: 'Скачать',
}

function open(): void {
  activeTab.value = 'data'
  privateBuildProfiles.value = workspaceAdmin.value ? 'all' : 'own'
  privateAIConnections.value = 'none'
  includePublicAI.value = false
  password.value = ''
  confirmPassword.value = ''
  acknowledgePlaintext.value = false
  openState.value = true
}

defineExpose({ open })

async function download(): Promise<void> {
  if (!canExport.value) {
    return
  }
  exporting.value = true
  const options: ServiceBackendDomainExportOptions = {
    privateBuildProfiles: privateBuildProfiles.value,
    privateAIConnections: privateAIConnections.value,
    includePublicAI: includePublicAI.value,
    ...(password.value ? { password: password.value } : {}),
  }
  try {
    await EndgeIDE.domainTransfer.downloadExport(Configurator.context.workspaceIdentity, options)
    openState.value = false
    toast.success(password.value ? 'Зашифрованный экспорт сформирован' : 'Экспорт сформирован')
  }
  catch (error) {
    toast.error('Не удалось экспортировать workspace', { description: error instanceof Error ? error.message : String(error) })
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="openState">
    <DialogContent class="overflow-hidden p-0 sm:max-w-[620px]">
      <DialogHeader class="border-b bg-muted/20 px-6 py-5">
        <DialogTitle class="flex items-center gap-2 text-left">
          <Download class="size-5 text-primary" />{{ copy.title }}
        </DialogTitle>
        <DialogDescription class="text-left">
          {{ copy.description }}
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab">
        <TabsList class="mx-6 mt-4 grid grid-cols-2">
          <TabsTrigger value="data">
            {{ copy.data }}
          </TabsTrigger><TabsTrigger value="protection">
            {{ copy.protection }}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="data" class="space-y-5 px-6 py-5">
          <div class="space-y-2">
            <Label>{{ copy.privateProfiles }}</Label><Select v-model="privateBuildProfiles">
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="none">
                  {{ copy.none }}
                </SelectItem><SelectItem value="own">
                  {{ copy.own }}
                </SelectItem><SelectItem v-if="workspaceAdmin" value="all">
                  {{ copy.allProfiles }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>{{ copy.privateAI }}</Label><Select v-model="privateAIConnections">
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="none">
                  {{ copy.none }}
                </SelectItem><SelectItem value="own">
                  {{ copy.own }}
                </SelectItem><SelectItem v-if="platformAdmin" value="all">
                  {{ copy.allPrivate }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label class="flex items-center gap-3 rounded-md border p-3 text-sm" :class="!platformAdmin ? 'opacity-60' : ''"><Checkbox v-model="includePublicAI" :disabled="!platformAdmin" /><span><span class="block font-medium">{{ copy.publicAI }}</span><span class="text-xs text-muted-foreground">{{ copy.platformOnly }}</span></span></label>
          <div v-if="needsPlaintextAcknowledgement" class="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert class="mt-0.5 size-4 shrink-0" />
            <p>{{ copy.plaintextWarning }} {{ copy.plaintextAction }}</p>
          </div>
        </TabsContent>

        <TabsContent value="protection" class="space-y-5 px-6 py-5">
          <div class="rounded-md border bg-muted/20 p-4 text-sm">
            <div class="flex items-center gap-2 font-medium">
              <KeyRound class="size-4" />{{ copy.filePassword }}
            </div><p class="mt-1 text-xs leading-5 text-muted-foreground">
              {{ copy.protectionHint }}
            </p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="workspace-export-password">{{ copy.password }}</Label><Input id="workspace-export-password" v-model="password" type="password" autocomplete="new-password" />
            </div><div class="space-y-2">
              <Label for="workspace-export-password-confirm">{{ copy.repeatPassword }}</Label><Input id="workspace-export-password-confirm" v-model="confirmPassword" type="password" autocomplete="new-password" />
            </div>
          </div>
          <p v-if="passwordMismatch" class="text-xs text-destructive">
            {{ copy.mismatch }}
          </p>
          <div v-if="needsPlaintextAcknowledgement" class="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            <div class="flex gap-2">
              <ShieldAlert class="mt-0.5 size-4 shrink-0" /><p>{{ copy.plaintextWarning }}</p>
            </div><label class="flex items-center gap-2 text-xs font-medium"><Checkbox v-model="acknowledgePlaintext" />{{ copy.acknowledge }}</label>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter class="border-t bg-muted/15 px-6 py-4">
        <Button variant="outline" :disabled="exporting" @click="openState = false">
          {{ copy.cancel }}
        </Button><Button :disabled="!canExport" @click="download">
          <Loader2 v-if="exporting" class="size-4 animate-spin" /><Download v-else class="size-4" />{{ copy.download }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { StyleBlocksPayload } from '@endge/core'

import { Endge } from '@endge/core'
import { Paintbrush, Play } from 'lucide-vue-next'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

interface StyleCheckError {
  styleId: string
  styleIdentity?: string
  blockIndex?: number
  message: string
}

const VALID_SELECTOR_TYPES = ['table', 'column', 'tag'] as const

function isCamelCase(s: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(s)
}

function isSelectorKey(key: string): boolean {
  const idx = key.indexOf(':')
  if (idx <= 0) return false
  const t = key.slice(0, idx)
  return VALID_SELECTOR_TYPES.includes(t as any)
}

function parseSelectorKey(key: string): { type: string; id: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  return { type: key.slice(0, idx), id: key.slice(idx + 1) }
}

function runStyleValidation(): StyleCheckError[] {
  const errors: StyleCheckError[] = []
  const styles = Endge.domain.getStyles()
  const componentIds = new Set(Endge.domain.getComponents().map(c => c.id))

  for (const style of styles) {
    const payload = (style.styles || []) as StyleBlocksPayload
    const blocks = Array.isArray(payload) ? payload : []
    const styleLabel = style.identity || style.id

    blocks.forEach((block, bi) => {
      if (!block || typeof block !== 'object')
        return

      function walk(node: Record<string, any>, path: string[]): void {
        for (const [key, value] of Object.entries(node)) {
          if (isSelectorKey(key) && value && typeof value === 'object' && !Array.isArray(value)) {
            const sel = parseSelectorKey(key)
            if (!sel) {
              errors.push({ styleId: style.id, styleIdentity: styleLabel, blockIndex: bi, message: `Блок ${bi}: неверный ключ селектора "${key}"` })
              continue
            }
            if (!VALID_SELECTOR_TYPES.includes(sel.type as any)) {
              errors.push({
                styleId: style.id,
                styleIdentity: styleLabel,
                blockIndex: bi,
                message: `Блок ${bi}: неизвестный тип селектора "${sel.type}", допустимы: ${VALID_SELECTOR_TYPES.join(', ')}`,
              })
            }
            if ((sel.type === 'component' || sel.type === 'component-root') && sel.id && !componentIds.has(sel.id)) {
              errors.push({
                styleId: style.id,
                styleIdentity: styleLabel,
                blockIndex: bi,
                message: `Блок ${bi}: компонент с id "${sel.id}" не найден в домене`,
              })
            }
            // Внутри селектора: свойства и вложенные селекторы
            const inner = value as Record<string, any>
            for (const [propKey, propVal] of Object.entries(inner)) {
              if (!isSelectorKey(propKey) && (typeof propVal === 'string' || typeof propVal === 'number')) {
                if (!isCamelCase(propKey)) {
                  errors.push({
                    styleId: style.id,
                    styleIdentity: styleLabel,
                    blockIndex: bi,
                    message: `Блок ${bi}: свойство "${propKey}" должно быть в camelCase`,
                  })
                }
              }
            }
            walk(inner, [...path, key])
          }
        }
      }

      walk(block as Record<string, any>, [])
    })
  }

  return errors
}

const activeMenuId = ref<string>('styles-check')
const styleErrors = ref<StyleCheckError[]>([])
const stylesCheckRun = ref(false)

const menuItems = [
  { id: 'styles-check', label: 'Проверка стилей', icon: Paintbrush },
] as const

function runStylesCheck(): void {
  styleErrors.value = runStyleValidation()
  stylesCheckRun.value = true
  if (styleErrors.value.length > 0) {
    toast.warning('Проверка стилей', { description: `Найдено проблем: ${styleErrors.value.length}` })
  } else {
    toast.success('Проверка стилей', { description: 'Проблем не найдено' })
  }
}

function openStyle(styleId: string): void {
  EndgeIDE.tabs.openDocument(styleId, 'style')
}

</script>

<template>
  <div class="flex h-full min-h-0">
    <nav class="w-48 shrink-0 border-r flex flex-col bg-muted/30">
      <div class="p-2 border-b text-xs font-medium text-muted-foreground">
        Поиск проблем
      </div>
      <ScrollArea class="flex-1">
        <ul class="p-1 space-y-0.5">
          <li
            v-for="item in menuItems"
            :key="item.id"
          >
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors"
              :class="activeMenuId === item.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'"
              @click="activeMenuId = item.id"
            >
              <component :is="item.icon" class="size-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </ScrollArea>
    </nav>
    <div class="flex-1 min-w-0 flex flex-col">
      <template v-if="activeMenuId === 'styles-check'">
        <div class="shrink-0 flex items-center gap-2 px-4 py-2 border-b">
          <Button
            size="sm"
            @click="runStylesCheck"
          >
            <Play class="size-4 mr-1" />
            Проверить стили
          </Button>
        </div>
        <ScrollArea class="flex-1">
          <div class="p-4 space-y-4">
            <p v-if="!stylesCheckRun" class="text-sm text-muted-foreground">
              Проверка стилей домена: camelCase свойств, допустимые теги (tag-root, tag, component), наличие id компонентов в домене.
            </p>
            <section v-if="stylesCheckRun" class="space-y-2">
              <h3 class="text-sm font-medium">
                Результат проверки стилей
              </h3>
              <p v-if="styleErrors.length === 0" class="text-sm text-muted-foreground">
                Проблем не найдено.
              </p>
              <ul v-else class="space-y-1">
                <li
                  v-for="(err, idx) in styleErrors"
                  :key="idx"
                  class="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50"
                >
                  <button
                    type="button"
                    class="flex-1 min-w-0 text-left text-sm"
                    @click="openStyle(err.styleId)"
                  >
                    <span class="font-medium">{{ err.styleIdentity || err.styleId }}</span>
                    <span v-if="err.blockIndex !== undefined" class="text-muted-foreground"> - блок {{ err.blockIndex }}</span>
                    <span class="block text-muted-foreground truncate">{{ err.message }}</span>
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DomainDocumentType, StyleBlocksPayload } from '@endge/core'

import { ComponentType, Endge, FilterType, QueryType } from '@endge/core'
import { AlertTriangle, Loader2, Paintbrush, Play, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isDeleted as isEntityDeleted } from '@/features/endge-ide/model/domain/domain-tree'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

/** Родительский вид удалён (нет в домене или помечен удалённым). */
function isParentViewDead(viewIdentity: string): boolean {
  const view = Endge.domain.getView(viewIdentity)
  if (!view) return true
  const softId = Endge.domain.getFolderByIdentity('soft-deleted')?.id ?? null
  return isEntityDeleted(view, softId)
}

interface LeakItem {
  id: string
  docType: DomainDocumentType
  name: string
}

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

const activeMenuId = ref<string>('inherited-leaks')
const leaks = ref<LeakItem[]>([])
const styleErrors = ref<StyleCheckError[]>([])
const running = ref(false)
const hasRun = ref(false)
const stylesCheckRun = ref(false)

const menuItems = [
  { id: 'inherited-leaks', label: 'Утечки inherited', icon: AlertTriangle },
  { id: 'styles-check', label: 'Проверка стилей', icon: Paintbrush },
] as const

async function runInheritedLeaks(): Promise<void> {
  running.value = true
  hasRun.value = false
  toast.info('Запуск анализа…', { description: 'Поиск утечек inherited' })

  await new Promise<void>(r => setTimeout(r, 0))

  const result: LeakItem[] = []
  const checkInherited = (entity: { inherited?: boolean; id?: string; identity?: string; name?: string; displayName?: string; meta?: { inheritedFrom?: Array<{ docType?: string; docIdentity?: string }> } }, docType: DomainDocumentType) => {
    if (!entity?.inherited) return
    const from = entity.meta?.inheritedFrom
    if (!Array.isArray(from)) return
    for (const ref of from) {
      if (ref?.docType !== 'view' || !ref?.docIdentity) continue
      if (isParentViewDead(ref.docIdentity)) {
        const id = entity.id ?? entity.identity ?? ''
        const name = entity.name ?? entity.displayName ?? id
        result.push({ id, docType, name })
        break
      }
    }
  }

  try {
    for (const c of Endge.domain.getComponents()) {
      checkInherited(c as any, c.type as DomainDocumentType)
    }
    for (const q of Endge.domain.getQueries()) {
      checkInherited(q as any, q.type)
    }
    for (const f of Endge.domain.getFilters()) {
      checkInherited(f as any, FilterType.DefaultFilter as DomainDocumentType)
    }
    leaks.value = result
    hasRun.value = true
    if (result.length > 0) {
      toast.success('Анализ завершён', { description: `Найдено утечек: ${result.length}` })
    } else {
      toast.success('Анализ завершён', { description: 'Проблем не найдено' })
    }
  } catch (e) {
    hasRun.value = true
    leaks.value = []
    console.error(e)
    toast.error('Ошибка анализа', { description: (e as Error)?.message })
  } finally {
    running.value = false
  }
}

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

function openEntity(item: LeakItem): void {
  EndgeIDE.tabs.openDocument(item.id, item.docType)
}

async function deleteLeak(item: LeakItem): Promise<void> {
  const id = item.id
  const type = item.docType
  try {
    await Endge.schema.deleteDocumentHard(id, type)
    if (type === (FilterType.DefaultFilter as DomainDocumentType)) Endge.domain.removeFilter(id)
    else if (type === QueryType.REST || type === QueryType.GraphQL || type === QueryType.Custom) Endge.domain.removeQuery(id)
    else if (type === ComponentType.Table || type === ComponentType.DSL) Endge.domain.removeComponent(id)
    EndgeIDE.tabs.closeTab(`${type}-${id}`)
    leaks.value = leaks.value.filter(l => l.id !== id || l.docType !== type)
    Endge.domain.notify()
    toast.success('Сущность удалена')
  } catch (e) {
    console.error(e)
    toast.error('Не удалось удалить', { description: (e as Error)?.message })
  }
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
      <template v-if="activeMenuId === 'inherited-leaks'">
        <div class="shrink-0 flex items-center gap-2 px-4 py-2 border-b">
          <Button
            size="sm"
            :disabled="running"
            @click="runInheritedLeaks"
          >
            <Loader2 v-if="running" class="size-4 mr-1 animate-spin" />
            <Play v-else class="size-4 mr-1" />
            {{ running ? 'Анализ…' : 'Запустить' }}
          </Button>
        </div>
        <ScrollArea class="flex-1">
          <div class="p-4 space-y-4">
            <p v-if="!hasRun && !running" class="text-sm text-muted-foreground">
              Нажмите «Запустить», чтобы найти сущности с флагом inherited, у которых родительский вид удалён.
            </p>

            <section v-if="hasRun" class="space-y-2">
              <h3 class="text-sm font-medium">
                Результат анализа
              </h3>
              <p v-if="leaks.length === 0" class="text-sm text-muted-foreground">
                Проблем не найдено.
              </p>
              <ul v-else class="space-y-1">
                <li
                  v-for="item in leaks"
                  :key="`${item.docType}-${item.id}`"
                  class="flex items-center gap-2 rounded-md border px-3 py-2 group hover:bg-muted/50"
                >
                  <button
                    type="button"
                    class="flex-1 min-w-0 text-left text-sm truncate"
                    @click="openEntity(item)"
                  >
                    {{ item.name || item.id }}
                  </button>
                  <button
                    type="button"
                    class="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition"
                    title="Удалить сущность"
                    @click.stop="deleteLeak(item)"
                  >
                    <Trash2 class="size-4" />
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </template>

      <template v-else-if="activeMenuId === 'styles-check'">
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

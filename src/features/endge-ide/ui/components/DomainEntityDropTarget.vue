<script setup lang="ts">
import { DomainSectionType } from '@endge/core'
import { computed, ref } from 'vue'

import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'

const DOMAIN_ENTITY_MIME = 'application/x-endge-domain-entity'

/** Подписи типов сущностей для подсказки */
const SECTION_LABELS: Record<string, string> = {
  [DomainSectionType.Component]: 'компонент',
  [DomainSectionType.Converter]: 'конвертер',
  [DomainSectionType.Computation]: 'вычисление',
  [DomainSectionType.Action]: 'действие',
  [DomainSectionType.Filters]: 'фильтр',
  [DomainSectionType.Query]: 'запрос',
  [DomainSectionType.Type]: 'тип',
  [DomainSectionType.Integration]: 'интеграция',
  [DomainSectionType.Parameters]: 'параметр',
  [DomainSectionType.PageTemplate]: 'шаблон страницы',
  [DomainSectionType.Page]: 'страница',
  [DomainSectionType.Navigation]: 'навигация',
}

const props = withDefaults(
  defineProps<{
    /** Какие сущности домена принимает зона (один или несколько) */
    acceptSectionTypes: DomainSectionType[]
    /** Показывать подсказку «перетащите сюда» */
    showHint?: boolean
    /** Свой текст подсказки (иначе по типу сущности) */
    hintText?: string
    /** Принимаемые виды элементов дерева. */
    acceptKinds?: Array<'document' | 'folder'>
    /** Какое поле payload сохраняется в reference value. */
    valueField?: 'id' | 'identity'
  }>(),
  { showHint: true, acceptKinds: () => ['document'], valueField: 'id' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', id: string | number): void
  (e: 'entity-drop', payload: { id: string | number; sectionType: DomainSectionType }): void
}>()

const dropOver = ref(false)

/** Рамка видна при наведении или пока из домена тащат подходящий тип */
const showHighlight = computed(() => {
  if (dropOver.value) return true
  const drag = EndgeIDE.domainDrag.state.value
  if (!drag.active || !drag.sectionTypes.length) return false
  if (!props.acceptKinds.includes('document')) return false
  return !props.acceptSectionTypes.length
    || drag.sectionTypes.some(t => props.acceptSectionTypes.includes(t as DomainSectionType))
})

function getHintText(): string {
  if (props.hintText) return props.hintText
  if (props.acceptKinds.includes('folder') && !props.acceptKinds.includes('document'))
    return 'Или перетащите папку из виджета Домен'
  const names = props.acceptSectionTypes
    .map(t => SECTION_LABELS[t] ?? t)
    .filter(Boolean)
  const str = names.length ? names.join(' или ') : 'сущность'
  return `Или перетащите ${str} из виджета Домен`
}

function parsePayload(e: DragEvent): Array<{ kind?: 'document' | 'folder'; id: string | number; identity?: string; sectionType: string }> {
  let raw: string | null = null
  if (e.dataTransfer?.types.includes(DOMAIN_ENTITY_MIME))
    raw = e.dataTransfer.getData(DOMAIN_ENTITY_MIME)
  if (!raw) raw = e.dataTransfer?.getData('text/plain') ?? null
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function isAccepted(item: { kind?: 'document' | 'folder'; sectionType: string }): boolean {
  const kind = item.kind === 'folder' ? 'folder' : 'document'
  return props.acceptKinds.includes(kind)
    && (!props.acceptSectionTypes.length || props.acceptSectionTypes.includes(item.sectionType as DomainSectionType))
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer)
    e.dataTransfer.dropEffect = 'copy'
  dropOver.value = true
}

function onDragLeave(): void {
  dropOver.value = false
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  dropOver.value = false
  const payload = parsePayload(e)
  const first = payload.find(isAccepted)
  if (first) {
    const value = props.valueField === 'identity' ? first.identity : first.id
    if (value == null || String(value).trim() === '') return
    emit('update:modelValue', value)
    emit('entity-drop', { id: first.id, sectionType: first.sectionType as DomainSectionType })
  }
}
</script>

<template>
  <div
    class="domain-entity-drop-target rounded-md p-1.5 transition-colors"
    :class="[
      showHighlight ? 'ring-2 ring-primary bg-primary/5' : 'border border-dashed border-muted-foreground/25',
    ]"
    data-drop-target="domain-entity"
    :data-accept-types="acceptSectionTypes.join(',')"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <slot />
    <p
      v-if="showHint"
      class="mt-1.5 text-xs text-muted-foreground"
    >
      {{ getHintText() }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Значение узла (объект, массив, примитив). */
    data: unknown
    /** Имя ключа для отображения (опционально). */
    name?: string
    /** Глубина вложенности (для отступа). */
    depth?: number
    /** Сколько элементов массива показывать за один раз. */
    chunkSize?: number
  }>(),
  { depth: 0, chunkSize: 50 },
)

const expanded = ref(false)
/** Для массивов: сколько элементов уже показано. */
const shownCount = ref(props.chunkSize)

const isArray = computed(() => Array.isArray(props.data))
const isObject = computed(
  () => props.data !== null && typeof props.data === 'object' && !Array.isArray(props.data),
)
const isPrimitive = computed(() => !isArray.value && !isObject.value)

const arrayLength = computed(() => (Array.isArray(props.data) ? props.data.length : 0))
const allObjectKeys = computed(() =>
  isObject.value ? Object.keys(props.data as Record<string, unknown>) : [],
)
/** Показано ключей объекта (лениво). */
const objectKeysShown = ref(props.chunkSize)
const objectKeys = computed(() => allObjectKeys.value.slice(0, objectKeysShown.value))
const objectHasMore = computed(() => allObjectKeys.value.length > objectKeysShown.value)
const objectMoreCount = computed(() =>
  Math.min(props.chunkSize, allObjectKeys.value.length - objectKeysShown.value),
)
function showMoreKeys(): void {
  objectKeysShown.value = Math.min(
    objectKeysShown.value + props.chunkSize,
    allObjectKeys.value.length,
  )
}

/** Видимый срез массива. */
const arraySlice = computed(() => {
  if (!Array.isArray(props.data)) return []
  return props.data.slice(0, shownCount.value)
})

const hasMore = computed(() => Array.isArray(props.data) && shownCount.value < props.data.length)
const moreCount = computed(() =>
  Array.isArray(props.data) ? Math.min(props.chunkSize, props.data.length - shownCount.value) : 0,
)

function showMore(): void {
  if (!Array.isArray(props.data)) return
  shownCount.value = Math.min(shownCount.value + props.chunkSize, props.data.length)
}

function primitivePreview(val: unknown): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'string') return JSON.stringify(val)
  return String(val)
}
</script>

<template>
  <div class="lazy-json-node text-xs font-mono" :style="{ paddingLeft: depth ? `${depth * 12}px` : '0' }">
    <!-- Примитив -->
    <template v-if="isPrimitive">
      <span v-if="name" class="text-muted-foreground">{{ name }}: </span>
      <span class="text-foreground">{{ primitivePreview(data) }}</span>
    </template>

    <!-- Массив: свёрнуто - только подпись -->
    <template v-else-if="isArray">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded hover:bg-muted/50 py-0.5 pr-1 text-left"
        @click="expanded = !expanded"
      >
        <i :class="expanded ? 'ti ti-chevron-down' : 'ti ti-chevron-right'" class="shrink-0 text-muted-foreground" />
        <span v-if="name" class="text-muted-foreground">{{ name }}: </span>
        <span class="text-blue-600 dark:text-blue-400">Array({{ arrayLength }})</span>
      </button>
      <div v-if="expanded" class="mt-0.5 space-y-0.5 border-l border-border pl-2">
        <LazyJsonNode
          v-for="(item, index) in arraySlice"
          :key="index"
          :data="item"
          :name="`[${index}]`"
          :depth="0"
          :chunk-size="chunkSize"
        />
        <button
          v-if="hasMore"
          type="button"
          class="text-muted-foreground hover:text-foreground py-0.5"
          @click="showMore"
        >
          + ещё {{ moreCount }} из {{ arrayLength }}
        </button>
      </div>
    </template>

    <!-- Объект: свёрнуто - только подпись -->
    <template v-else-if="isObject">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded hover:bg-muted/50 py-0.5 pr-1 text-left"
        @click="expanded = !expanded"
      >
        <i :class="expanded ? 'ti ti-chevron-down' : 'ti ti-chevron-right'" class="shrink-0 text-muted-foreground" />
        <span v-if="name" class="text-muted-foreground">{{ name }}: </span>
        <span class="text-amber-600 dark:text-amber-400">Object</span>
        <span class="text-muted-foreground">({{ allObjectKeys.length }})</span>
      </button>
      <div v-if="expanded" class="mt-0.5 space-y-0.5 border-l border-border pl-2">
        <LazyJsonNode
          v-for="k in objectKeys"
          :key="k"
          :data="(data as Record<string, unknown>)[k]"
          :name="k"
          :depth="0"
          :chunk-size="chunkSize"
        />
        <button
          v-if="objectHasMore"
          type="button"
          class="text-muted-foreground hover:text-foreground py-0.5"
          @click="showMoreKeys"
        >
          + ещё {{ objectMoreCount }} ключей (всего {{ allObjectKeys.length }})
        </button>
      </div>
    </template>
  </div>
</template>

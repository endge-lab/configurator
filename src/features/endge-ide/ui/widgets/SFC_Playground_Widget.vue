<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<script setup lang="ts">
import { compileComponentSFC } from '@endge/core'
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

const SPLIT_MIN = 0.22
const SPLIT_MAX = 0.68
const SPLIT_DEFAULT = 0.42
const SCRIPT_OPEN = '<script setup lang="ts">'
const SCRIPT_CLOSE = '</scr' + 'ipt>'
const PAGE_TITLE = 'SFC Playground'
const PAGE_SUBTITLE = 'Compiler preview: source -> AST -> IR'
const SOURCE_LABEL = 'SFC source'
const CONTEXT_LABEL = 'Preview context override'
const EMPTY_IR_MESSAGE = 'IR пока не построен. Проверь diagnostics.'
const EMPTY_DIAGNOSTICS_MESSAGE = 'Diagnostics empty.'
const TAB_LABELS = {
  preview: 'Preview',
  diagnostics: 'Diagnostics',
  ir: 'IR',
  ast: 'AST',
  contract: 'Contract',
}

type SFCDemoOption = { id: string, label: string, source: string, context: string }

const DEFAULT_SOURCE = createDemoSource(
  `defineProps<{
  flight: FlightLeg
  compact?: boolean
}>()

definePreviewProps({
  flight: {
    number: 'SU 1402',
    status: 'Boarding',
    statusTone: 'success',
    std: '2026-07-05T13:45:00Z',
    route: 'SVO -> LED',
  },
  compact: false,
})`,
  `<Flex col gap="2" p="4">
  <Flex row gap="4" align="center">
    <Text weight="600">{{ flight.number }}</Text>
    <Badge :tone="flight.statusTone">{{ flight.status }}</Badge>
  </Flex>

  <Flex row gap="4" if="!compact">
    <DateTime :value="flight.std" format="HH:mm" />
    <Text color="muted">{{ flight.route }}</Text>
  </Flex>
</Flex>`,
  '',
)

const DEFAULT_CONTEXT = '{}'

const DEMO_OPTIONS: SFCDemoOption[] = [
  {
    id: 'flight-cell',
    label: 'Flight cell',
    source: DEFAULT_SOURCE,
    context: DEFAULT_CONTEXT,
  },
  {
    id: 'status',
    label: 'Status badge',
    source: createDemoSource(
      `defineProps<{
  status: string
  tone: string
}>()

definePreviewProps({
  status: 'Delayed',
  tone: 'warning',
})`,
      `<Flex row gap="2" align="center">
  <Dot :tone="tone" />
  <Badge :tone="tone">{{ status }}</Badge>
</Flex>`,
    ),
    context: DEFAULT_CONTEXT,
  },
  {
    id: 'numbers',
    label: 'Numbers',
    source: createDemoSource(
      `defineProps<{
  delay: number
  gate: string
}>()

definePreviewProps({
  delay: 12,
  gate: 'D14',
})`,
      `<Flex col gap="1">
  <Text color="muted">Gate {{ gate }}</Text>
  <Flex row gap="2" align="center">
    <Text>Delay</Text>
    <Number :value="delay" />
    <Text>min</Text>
  </Flex>
</Flex>`,
    ),
    context: DEFAULT_CONTEXT,
  },
]

const LEGACY_DEMO_OPTIONS: SFCDemoOption[] = [
  {
    id: 'flight-cell',
    label: 'Flight cell',
    source: createDemoSource(
      `defineProps<{
  flight: FlightLeg
  compact?: boolean
}>()`,
      `<Flex col gap="2" p="4">
  <Flex row gap="4" align="center">
    <Text weight="600">{{ flight.number }}</Text>
    <Badge :tone="flight.statusTone">{{ flight.status }}</Badge>
  </Flex>

  <Flex row gap="4" if="!compact">
    <DateTime :value="flight.std" format="HH:mm" />
    <Text color="muted">{{ flight.route }}</Text>
  </Flex>
</Flex>`,
      '',
    ),
    context: `{
  "flight": {
    "number": "SU 1402",
    "status": "Boarding",
    "statusTone": "success",
    "std": "2026-07-05T13:45:00Z",
    "route": "SVO -> LED"
  },
  "compact": false
}`,
  },
  {
    id: 'status',
    label: 'Status badge',
    source: createDemoSource(
      `defineProps<{
  status: string
  tone: string
}>()`,
      `<Flex row gap="2" align="center">
  <Dot :tone="tone" />
  <Badge :tone="tone">{{ status }}</Badge>
</Flex>`,
    ),
    context: `{
  "status": "Delayed",
  "tone": "warning"
}`,
  },
  {
    id: 'numbers',
    label: 'Numbers',
    source: createDemoSource(
      `defineProps<{
  delay: number
  gate: string
}>()`,
      `<Flex col gap="1">
  <Text color="muted">Gate {{ gate }}</Text>
  <Flex row gap="2" align="center">
    <Text>Delay</Text>
    <Number :value="delay" />
    <Text>min</Text>
  </Flex>
</Flex>`,
    ),
    context: `{
  "delay": 12,
  "gate": "D14"
}`,
  },
]

const source = useSafeLocalStorage('sfc-playground-source', DEFAULT_SOURCE)
const contextJson = useSafeLocalStorage('sfc-playground-context', DEFAULT_CONTEXT)
const splitRatio = useSafeLocalStorage('sfc-playground-split', SPLIT_DEFAULT)
const selectedDemoId = ref('')
const activeTab = ref('preview')
const splitContainerRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

migrateLegacyDemoStorage()

const compileResult = computed(() => compileComponentSFC(source.value))
const diagnostics = computed(() => compileResult.value.diagnostics)
const hasErrors = computed(() => diagnostics.value.some(item => item.severity === 'error'))
const contextState = computed(() => parseContext(contextJson.value))
const previewContext = computed(() => ({
  ...(compileResult.value.previewProps ?? {}),
  ...contextState.value.data,
}))

const summaryItems = computed(() => [
  { label: 'Diagnostics', value: diagnostics.value.length, tone: hasErrors.value ? 'destructive' : diagnostics.value.length ? 'warning' : 'success' },
  { label: 'AST', value: compileResult.value.ast ? 'ready' : 'empty', tone: compileResult.value.ast ? 'success' : 'muted' },
  { label: 'IR', value: compileResult.value.ir ? 'ready' : 'empty', tone: compileResult.value.ir ? 'success' : 'muted' },
  { label: 'Inputs', value: compileResult.value.contract.inputs.length, tone: 'muted' },
])

function createDemoSource(script: string, template: string, style?: string): string {
  const chunks = [
    SCRIPT_OPEN,
    script.trim(),
    SCRIPT_CLOSE,
    '',
    '<template>',
    template.trim(),
    '</template>',
  ]

  if (style != null) {
    chunks.push(
      '',
      '<style lang="endgecss" scoped>',
      style.trim(),
      '</style>',
    )
  }

  return `${chunks.join('\n')}\n`
}

function clampSplit(value: number): number {
  return Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, value))
}

function onSplitterMouseDown(e: MouseEvent): void {
  if (e.button !== 0) {
    return
  }
  e.preventDefault()
  isDragging.value = true
  document.body.classList.add('select-none')
  document.body.style.cursor = 'ew-resize'
}

function onMouseMove(e: MouseEvent): void {
  if (!isDragging.value || !splitContainerRef.value) {
    return
  }
  const rect = splitContainerRef.value.getBoundingClientRect()
  splitRatio.value = clampSplit((e.clientX - rect.left) / rect.width)
}

function onMouseUp(): void {
  isDragging.value = false
  document.body.classList.remove('select-none')
  document.body.style.cursor = ''
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})

function insertDemo(): void {
  const demo = DEMO_OPTIONS.find(item => item.id === selectedDemoId.value)
  if (!demo) {
    return
  }
  source.value = demo.source
  contextJson.value = demo.context
}

function migrateLegacyDemoStorage(): void {
  const legacyDemo = LEGACY_DEMO_OPTIONS.find(item => normalizeStoredText(item.source) === normalizeStoredText(source.value))
  if (!legacyDemo)
    return

  const currentDemo = DEMO_OPTIONS.find(item => item.id === legacyDemo.id)
  if (!currentDemo)
    return

  source.value = currentDemo.source

  if (normalizeStoredText(contextJson.value) === normalizeStoredText(legacyDemo.context))
    contextJson.value = currentDemo.context
}

function normalizeStoredText(value: string): string {
  return value.trim().replace(/\r\n/g, '\n')
}

function parseContext(raw: string): { data: Record<string, unknown>, error: string | null } {
  try {
    const parsed = JSON.parse(raw || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        data: {},
        error: 'Context должен быть JSON-объектом.',
      }
    }
    return {
      data: parsed as Record<string, unknown>,
      error: null,
    }
  }
  catch (error: any) {
    return {
      data: {},
      error: error?.message ?? String(error),
    }
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function badgeClass(tone: string | number): string {
  if (tone === 'destructive') {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  return 'border-border bg-muted text-muted-foreground'
}

function valueToText(value: unknown): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function readValue(input: any, ctx: Record<string, unknown>): unknown {
  if (!input) {
    return null
  }
  if (input.kind === 'literal') {
    return input.value
  }
  if (input.kind !== 'expression') {
    return null
  }

  return readExpression(input.source, ctx)
}

function readExpression(source: string, ctx: Record<string, unknown>): unknown {
  const expression = source.trim()
  if (!expression) {
    return ''
  }

  if (expression.startsWith('!')) {
    return !readExpression(expression.slice(1), ctx)
  }

  if (expression === 'true') {
    return true
  }
  if (expression === 'false') {
    return false
  }
  if (expression === 'null') {
    return null
  }

  const numericValue = Number(expression)
  if (Number.isFinite(numericValue) && expression !== '') {
    return numericValue
  }

  if (
    (expression.startsWith('"') && expression.endsWith('"'))
    || (expression.startsWith('\'') && expression.endsWith('\''))
  ) {
    return expression.slice(1, -1)
  }

  return readPath(ctx, expression) ?? `{{ ${source} }}`
}

function readPath(ctx: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce<unknown>((current, part) => {
      if (current && typeof current === 'object' && part in current) {
        return (current as Record<string, unknown>)[part]
      }

      return undefined
    }, ctx)
}

function shouldRender(node: any, ctx: Record<string, unknown>): boolean {
  const directives = node?.directives ?? {}
  if (directives.else) {
    return true
  }
  if (directives.if) {
    return Boolean(readValue(directives.if, ctx))
  }
  if (directives.elseIf) {
    return Boolean(readValue(directives.elseIf, ctx))
  }
  return true
}

function summaryText(item: { label: string, value: string | number }): string {
  return `${item.label}: ${item.value}`
}

function diagnosticTitle(diagnostic: { severity: string, code: string }): string {
  return `${diagnostic.severity} / ${diagnostic.code}`
}

function diagnosticLocation(diagnostic: { sourcePath?: string, start?: number, end?: number }): string {
  const sourcePath = diagnostic.sourcePath ?? 'source'
  const rangeStart = diagnostic.start ?? ''
  const rangeEnd = diagnostic.end != null ? `-${diagnostic.end}` : ''
  return `${sourcePath} ${rangeStart}${rangeEnd}`.trim()
}

const SFCPreviewNode = defineComponent({
  name: 'SFCPreviewNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    context: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const node = props.node as any
      const ctx = props.context as Record<string, unknown>

      if (!shouldRender(node, ctx)) {
        return null
      }

      if (node.kind === 'text') {
        return h('span', node.value)
      }

      if (node.kind === 'expression') {
        return h('span', valueToText(readValue(node.value, ctx)))
      }

      if (node.kind !== 'element') {
        return null
      }

      const propValue = (name: string) => readValue(node.props?.[name], ctx)
      const children = renderChildren(node, ctx)

      if (node.tag === 'Flex') {
        const isColumn = node.props?.col || propValue('direction') === 'column'
        return h('div', {
          class: ['sfc-preview-flex', isColumn ? 'sfc-preview-flex--col' : 'sfc-preview-flex--row'],
          style: {
            gap: `${Number(propValue('gap') ?? 2) * 4}px`,
            padding: node.props?.p ? `${Number(propValue('p') ?? 0) * 4}px` : undefined,
            alignItems: String(propValue('align') ?? 'stretch'),
          },
        }, children)
      }

      if (node.tag === 'Box') {
        return h('div', {
          class: 'sfc-preview-box',
          style: {
            padding: node.props?.p ? `${Number(propValue('p') ?? 0) * 4}px` : undefined,
          },
        }, children)
      }

      if (node.tag === 'Text') {
        return h('span', {
          class: 'sfc-preview-text',
          style: {
            fontWeight: propValue('weight') ? String(propValue('weight')) : undefined,
            color: propValue('color') === 'muted' ? 'var(--muted-foreground)' : String(propValue('color') ?? ''),
          },
        }, children)
      }

      if (node.tag === 'Badge') {
        return h('span', {
          class: ['sfc-preview-badge', `sfc-preview-badge--${String(propValue('tone') ?? 'neutral')}`],
        }, children)
      }

      if (node.tag === 'Dot') {
        return h('span', {
          class: ['sfc-preview-dot', `sfc-preview-dot--${String(propValue('tone') ?? 'neutral')}`],
        })
      }

      if (node.tag === 'Divider') {
        return h('hr', { class: 'sfc-preview-divider' })
      }

      if (node.tag === 'DateTime') {
        const value = propValue('value')
        const date = value ? new Date(String(value)) : null
        const text = date && !Number.isNaN(date.getTime())
          ? date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          : valueToText(value)
        return h('span', { class: 'sfc-preview-datetime' }, text)
      }

      if (node.tag === 'Number') {
        return h('span', { class: 'sfc-preview-number' }, valueToText(propValue('value')))
      }

      if (node.tag === 'Icon') {
        return h('i', { class: ['ti', `ti-${String(propValue('name') ?? 'circle')}`] })
      }

      if (node.tag === 'Component') {
        return h('span', { class: 'sfc-preview-component' }, `Component: ${valueToText(propValue('is'))}`)
      }

      return h('span', children)
    }
  },
})

function renderChildren(node: any, ctx: Record<string, unknown>): any[] {
  return (node.children ?? []).map((child: any) => h(SFCPreviewNode, {
    node: child,
    context: ctx,
  }))
}
</script>

<template>
  <div class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center justify-between gap-4 min-w-0">
        <div class="flex items-center gap-3 min-w-0">
          <div class="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <i class="ti ti-code-dots text-emerald-600 text-2xl" />
          </div>
          <div class="min-w-0">
            <div class="text-lg font-semibold truncate">
              {{ PAGE_TITLE }}
            </div>
            <div class="text-xs text-muted-foreground truncate">
              {{ PAGE_SUBTITLE }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap justify-end">
          <Badge
            v-for="item in summaryItems"
            :key="item.label"
            variant="outline"
            :class="badgeClass(item.tone)"
          >
            {{ summaryText(item) }}
          </Badge>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Select v-model="selectedDemoId">
          <SelectTrigger class="w-[220px] h-9">
            <SelectValue placeholder="SFC пример" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="demo in DEMO_OPTIONS"
              :key="demo.id"
              :value="demo.id"
            >
              {{ demo.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="shrink-0 h-9 w-9"
          title="Подставить пример в редактор"
          :disabled="!selectedDemoId"
          @click="insertDemo"
        >
          <i class="ti ti-file-import text-lg" />
        </Button>
      </div>

      <Card class="flex-1 min-h-0 flex flex-col p-4">
        <div
          ref="splitContainerRef"
          class="flex flex-1 min-h-0 w-full"
        >
          <div
            class="flex flex-col min-h-0 shrink-0 overflow-hidden gap-3"
            :style="{ width: `${clampSplit(Number(splitRatio)) * 100}%` }"
          >
            <div class="flex flex-col min-h-0 flex-[3]">
              <Label class="font-semibold mb-2">
                {{ SOURCE_LABEL }}
              </Label>
              <ScriptEditor
                v-model="source"
                language="html"
                class="flex-1 min-h-0"
              />
            </div>

            <div class="flex flex-col min-h-0 flex-[2]">
              <Label class="font-semibold mb-2">
                {{ CONTEXT_LABEL }}
              </Label>
              <ScriptEditor
                v-model="contextJson"
                language="json"
                class="flex-1 min-h-0"
              />
            </div>
          </div>

          <div
            class="shrink-0 w-2 cursor-ew-resize hover:bg-primary/20 transition-colors flex items-center justify-center group"
            aria-label="Изменить ширину панелей"
            @mousedown="onSplitterMouseDown"
          >
            <div class="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
          </div>

          <Tabs
            v-model="activeTab"
            class="flex flex-col min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            <TabsList class="w-fit shrink-0">
              <TabsTrigger value="preview">
                {{ TAB_LABELS.preview }}
              </TabsTrigger>
              <TabsTrigger value="diagnostics">
                {{ TAB_LABELS.diagnostics }}
              </TabsTrigger>
              <TabsTrigger value="ir">
                {{ TAB_LABELS.ir }}
              </TabsTrigger>
              <TabsTrigger value="ast">
                {{ TAB_LABELS.ast }}
              </TabsTrigger>
              <TabsTrigger value="contract">
                {{ TAB_LABELS.contract }}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" class="flex-1 mt-3 min-h-0 overflow-hidden">
              <ScrollArea class="h-full border rounded-md">
                <div class="p-4 min-h-full">
                  <div
                    v-if="contextState.error"
                    class="rounded-md border border-red-200 bg-red-50 text-red-700 text-sm p-3"
                  >
                    {{ contextState.error }}
                  </div>
                  <div
                    v-else-if="!compileResult.ir"
                    class="rounded-md border border-dashed p-6 text-sm text-muted-foreground"
                  >
                    {{ EMPTY_IR_MESSAGE }}
                  </div>
                  <div
                    v-else
                    class="sfc-preview-surface"
                  >
                    <SFCPreviewNode
                      v-for="rootNode in compileResult.ir.template.roots"
                      :key="rootNode.id"
                      :node="rootNode"
                      :context="previewContext"
                    />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="diagnostics" class="flex-1 mt-3 min-h-0 overflow-hidden">
              <ScrollArea class="h-full border rounded-md">
                <div class="p-3 space-y-2">
                  <div
                    v-if="!diagnostics.length"
                    class="text-sm text-muted-foreground"
                  >
                    {{ EMPTY_DIAGNOSTICS_MESSAGE }}
                  </div>
                  <div
                    v-for="diagnostic in diagnostics"
                    :key="`${diagnostic.code}-${diagnostic.message}-${diagnostic.start ?? ''}`"
                    class="rounded-md border p-3 text-sm"
                    :class="diagnostic.severity === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'"
                  >
                    <div class="font-medium">
                      {{ diagnosticTitle(diagnostic) }}
                    </div>
                    <div>{{ diagnostic.message }}</div>
                    <div
                      v-if="diagnostic.sourcePath || diagnostic.start != null"
                      class="text-xs opacity-75 mt-1"
                    >
                      {{ diagnosticLocation(diagnostic) }}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="ir" class="flex-1 mt-3 min-h-0 overflow-hidden">
              <ScriptEditor
                :model-value="stringify(compileResult.ir)"
                language="json"
                read-only
                class="h-full min-h-0"
              />
            </TabsContent>

            <TabsContent value="ast" class="flex-1 mt-3 min-h-0 overflow-hidden">
              <ScriptEditor
                :model-value="stringify(compileResult.ast)"
                language="json"
                read-only
                class="h-full min-h-0"
              />
            </TabsContent>

            <TabsContent value="contract" class="flex-1 mt-3 min-h-0 overflow-hidden">
              <ScriptEditor
                :model-value="stringify({ contract: compileResult.contract, dependencies: compileResult.dependencies, sourceParts: compileResult.sourceParts })"
                language="json"
                read-only
                class="h-full min-h-0"
              />
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.sfc-preview-surface {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: hsl(var(--foreground));
}

:deep(.sfc-preview-flex) {
  display: flex;
}

:deep(.sfc-preview-flex--row) {
  flex-direction: row;
}

:deep(.sfc-preview-flex--col) {
  flex-direction: column;
}

:deep(.sfc-preview-box) {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card));
}

:deep(.sfc-preview-text),
:deep(.sfc-preview-datetime),
:deep(.sfc-preview-number) {
  font-size: 14px;
  line-height: 1.35;
}

:deep(.sfc-preview-badge) {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  width: fit-content;
}

:deep(.sfc-preview-badge--success) {
  border-color: rgb(167 243 208);
  background: rgb(236 253 245);
  color: rgb(4 120 87);
}

:deep(.sfc-preview-badge--warning) {
  border-color: rgb(253 230 138);
  background: rgb(255 251 235);
  color: rgb(180 83 9);
}

:deep(.sfc-preview-dot) {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: hsl(var(--muted-foreground));
}

:deep(.sfc-preview-dot--success) {
  background: rgb(16 185 129);
}

:deep(.sfc-preview-dot--warning) {
  background: rgb(245 158 11);
}

:deep(.sfc-preview-divider) {
  width: 100%;
  border: 0;
  border-top: 1px solid hsl(var(--border));
}

:deep(.sfc-preview-component) {
  display: inline-flex;
  width: fit-content;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px dashed hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>

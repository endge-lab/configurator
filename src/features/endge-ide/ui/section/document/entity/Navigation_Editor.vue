<script setup lang="ts">
import type { NavigationTreeNodeEditor, NavigationTreeNodeType, RNavigationEditor } from '@/features/endge-ide/domain/entities/RNavigationEditor'

import { FolderTree, Link2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { isBusy } from '@/features/endge-ide/model/core/endge-ide-busy.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import NavigationEditorTreeNode from '@/features/endge-ide/ui/components/NavigationEditorTreeNode.vue'
import SaveDocumentButton from '@/features/endge-ide/ui/components/SaveDocumentButton.vue'

const props = defineProps<{
  tabContext?: { editor?: RNavigationEditor }
}>()

const editor = computed<RNavigationEditor | null>(() => props.tabContext?.editor ?? null)
const selectedNodeId = ref<string | null>(null)
const collapsedGroupIds = ref<Set<string>>(new Set())
const draggedNodeId = ref<string | null>(null)

type DropPosition = 'before' | 'inside' | 'after'

interface LocatedNode {
  node: NavigationTreeNodeEditor
  parent: NavigationTreeNodeEditor | null
  siblings: NavigationTreeNodeEditor[]
  index: number
}

function makeNodeId(): string {
  return `nav-ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createNode(type: NavigationTreeNodeType): NavigationTreeNodeEditor {
  return {
    id: makeNodeId(),
    type,
    title: '',
    icon: '',
    hidden: false,
    disabled: false,
    collapsedTitle: '',
    path: '',
    routeName: '',
    external: false,
    children: type === 'link' ? [] : [],
  }
}

function walkNodes(
  nodes: NavigationTreeNodeEditor[],
  visit: (node: NavigationTreeNodeEditor, index: number, siblings: NavigationTreeNodeEditor[]) => boolean | void,
): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node) { continue }
    if (visit(node, index, nodes)) { return true }
    if (node.type !== 'link' && node.children?.length && walkNodes(node.children, visit)) { return true }
  }
  return false
}

function findNode(nodeId: string | null): NavigationTreeNodeEditor | null {
  if (!nodeId || !editor.value) { return null }

  let result: NavigationTreeNodeEditor | null = null
  walkNodes(editor.value.tree, (node) => {
    if (node.id === nodeId) {
      result = node
      return true
    }
  })
  return result
}

function findLocatedNode(nodeId: string | null): LocatedNode | null {
  if (!nodeId || !editor.value) { return null }

  const walk = (
    nodes: NavigationTreeNodeEditor[],
    parent: NavigationTreeNodeEditor | null,
  ): LocatedNode | null => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (!node) { continue }

      if (node.id === nodeId) {
        return { node, parent, siblings: nodes, index }
      }

      if (node.type !== 'link') {
        const result = walk(node.children ?? [], node)
        if (result) { return result }
      }
    }

    return null
  }

  return walk(editor.value.tree, null)
}

function nodeContainsNode(parentNode: NavigationTreeNodeEditor, targetId: string | null): boolean {
  if (parentNode.type === 'link' || !targetId) { return false }

  let found = false
  walkNodes(parentNode.children ?? [], (node) => {
    if (node.id === targetId) {
      found = true
      return true
    }
  })

  return found
}

function syncCollapsedGroups(): void {
  const validContainerIds = new Set<string>()
  const walk = (nodes: NavigationTreeNodeEditor[]): void => {
    for (const node of nodes) {
      if (node.type === 'link') { continue }
      validContainerIds.add(node.id)
      walk(node.children ?? [])
    }
  }

  walk(editor.value?.tree ?? [])

  collapsedGroupIds.value = new Set(
    [...collapsedGroupIds.value].filter(nodeId => validContainerIds.has(nodeId)),
  )
}

function ensureSelection(): void {
  if (!editor.value) { return }

  if (!editor.value.tree.length) {
    selectedNodeId.value = null
    return
  }

  const selected = findNode(selectedNodeId.value)
  if (!selected) { selectedNodeId.value = editor.value.tree[0]?.id ?? null }
}

watch(
  () => editor.value?.tree,
  () => {
    syncCollapsedGroups()
    ensureSelection()
  },
  { immediate: true, deep: true },
)

const selectedNode = computed(() => findNode(selectedNodeId.value))

const treeStats = computed(() => {
  let sections = 0
  let groups = 0
  let links = 0

  const walk = (nodes: NavigationTreeNodeEditor[]): void => {
    for (const node of nodes) {
      if (node.type === 'section') {
        sections += 1
        walk(node.children ?? [])
      }
      else if (node.type === 'group') {
        groups += 1
        walk(node.children ?? [])
      }
      else {
        links += 1
      }
    }
  }

  walk(editor.value?.tree ?? [])

  return {
    sections,
    groups,
    links,
    total: sections + groups + links,
  }
})

function nodeTypeLabel(type: NavigationTreeNodeType): string {
  if (type === 'section') { return 'секция' }
  if (type === 'group') { return 'группа' }
  return 'ссылка'
}

function changeSelectedNodeTypeFromSelect(value: unknown): void {
  if (value === 'section' || value === 'group' || value === 'link') {
    changeSelectedNodeType(value)
  }
}

function updateSelectedFlag(
  key: 'external' | 'hidden' | 'disabled',
  value: unknown,
): void {
  const node = selectedNode.value
  if (!node) { return }
  node[key] = !!value
}

function selectNode(nodeId: string): void {
  selectedNodeId.value = nodeId
}

function toggleGroup(nodeId: string): void {
  const node = findNode(nodeId)
  if (!node || node.type === 'link') { return }

  const next = new Set(collapsedGroupIds.value)
  if (next.has(nodeId)) {
    next.delete(nodeId)
  }
  else {
    next.add(nodeId)
    if (selectedNodeId.value !== nodeId && nodeContainsNode(node, selectedNodeId.value)) {
      selectedNodeId.value = nodeId
    }
  }

  collapsedGroupIds.value = next
}

function addRoot(type: NavigationTreeNodeType): void {
  if (!editor.value) { return }
  const node = createNode(type)
  editor.value.tree.push(node)
  selectedNodeId.value = node.id
}

function canHaveChild(node: NavigationTreeNodeEditor, childType: NavigationTreeNodeType): boolean {
  if (node.type === 'section') { return childType === 'group' || childType === 'link' }
  if (node.type === 'group') { return childType === 'link' }
  return false
}

function canContainNode(
  parent: NavigationTreeNodeEditor | null,
  childType: NavigationTreeNodeType,
): boolean {
  if (!parent) { return true }
  return canHaveChild(parent, childType)
}

function beginDrag(nodeId: string): void {
  draggedNodeId.value = nodeId
}

function endDrag(): void {
  draggedNodeId.value = null
}

function moveNode(targetId: string, position: DropPosition): void {
  const sourceId = draggedNodeId.value
  if (!editor.value || !sourceId || sourceId === targetId) { return }

  const source = findLocatedNode(sourceId)
  const target = findLocatedNode(targetId)
  if (!source || !target) { return }

  if (nodeContainsNode(source.node, targetId)) { return }

  const destinationParent = position === 'inside' ? target.node : target.parent
  if (!canContainNode(destinationParent, source.node.type)) { return }

  source.siblings.splice(source.index, 1)

  if (position === 'inside') {
    if (!target.node.children) { target.node.children = [] }
    target.node.children.push(source.node)
    collapsedGroupIds.value = new Set([...collapsedGroupIds.value].filter(id => id !== target.node.id))
  }
  else {
    const nextTarget = findLocatedNode(targetId)
    if (!nextTarget) { return }
    const nextIndex = position === 'before' ? nextTarget.index : nextTarget.index + 1
    nextTarget.siblings.splice(nextIndex, 0, source.node)
  }

  selectedNodeId.value = source.node.id
  draggedNodeId.value = null
}

function moveNodeToRootEnd(): void {
  const sourceId = draggedNodeId.value
  if (!editor.value || !sourceId) { return }

  const source = findLocatedNode(sourceId)
  if (!source) { return }

  source.siblings.splice(source.index, 1)
  editor.value.tree.push(source.node)
  selectedNodeId.value = source.node.id
  draggedNodeId.value = null
}

function addAfter(targetId: string, type: NavigationTreeNodeType): void {
  if (!editor.value) { return }

  const node = createNode(type)
  walkNodes(editor.value.tree, (current, index, siblings) => {
    if (current.id !== targetId) { return false }
    siblings.splice(index + 1, 0, node)
    selectedNodeId.value = node.id
    return true
  })
}

function addChild(targetId: string, type: NavigationTreeNodeType): void {
  const target = findNode(targetId)
  if (!target || !canHaveChild(target, type)) { return }

  const node = createNode(type)
  if (!target.children) { target.children = [] }
  target.children.push(node)
  const next = new Set(collapsedGroupIds.value)
  next.delete(targetId)
  collapsedGroupIds.value = next
  selectedNodeId.value = node.id
}

function removeNode(targetId: string): void {
  if (!editor.value) { return }

  walkNodes(editor.value.tree, (current, index, siblings) => {
    if (current.id !== targetId) { return false }
    siblings.splice(index, 1)
    return true
  })
  ensureSelection()
}

function changeSelectedNodeType(nextType: NavigationTreeNodeType): void {
  const current = selectedNode.value
  if (!current || current.type === nextType || !editor.value) { return }

  const replacement: NavigationTreeNodeEditor = {
    id: current.id,
    type: nextType,
    title: current.title,
    icon: current.icon ?? '',
    hidden: current.hidden ?? false,
    disabled: current.disabled ?? false,
    collapsedTitle: nextType === 'section' ? current.collapsedTitle ?? '' : '',
    path: nextType === 'section' ? '' : current.path ?? '',
    routeName: nextType === 'section' ? '' : current.routeName ?? '',
    external: nextType === 'link' ? current.external ?? false : false,
    children: nextType === 'link' ? [] : [],
  }

  walkNodes(editor.value.tree, (node, index, siblings) => {
    if (node.id !== current.id) { return false }
    siblings.splice(index, 1, replacement)
    return true
  })
  selectedNodeId.value = replacement.id
}

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="editor" class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="border-b px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-lg font-semibold">
            Navigation - {{ editor.displayName || 'Без названия' }}
          </div>
          <div class="mt-1 flex flex-wrap gap-2">
            <Badge variant="outline">
              {{ treeStats.sections }} sections
            </Badge>
            <Badge variant="outline">
              {{ treeStats.groups }} groups
            </Badge>
            <Badge variant="outline">
              {{ treeStats.links }} links
            </Badge>
            <Badge variant="outline">
              {{ treeStats.total }} total
            </Badge>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <SaveDocumentButton :loading="isBusy" @click="save" />
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div class="grid min-h-full items-start gap-3 xl:grid-cols-[minmax(420px,1fr)_minmax(420px,0.95fr)]">
        <Card class="flex min-h-0 overflow-visible py-0">
          <div class="flex h-full min-h-0 flex-col">
            <div class="border-b px-4 py-3">
              <div class="flex items-center gap-2 text-sm font-semibold">
                <FolderTree class="size-4 text-sky-500" />
                Навигация
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button size="icon-sm" variant="outline" @click="addRoot('section')">
                        <FolderTree class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Добавить корневую секцию</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button size="icon-sm" variant="outline" @click="addRoot('group')">
                        <FolderTree class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Добавить корневую группу</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button size="icon-sm" variant="outline" @click="addRoot('link')">
                        <Link2 class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Добавить корневую ссылку</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div class="min-h-0 flex-1">
              <div class="space-y-2 p-4">
                <NavigationEditorTreeNode
                  v-for="node in editor.tree"
                  :key="node.id"
                  :node="node"
                  :collapsed-group-ids="collapsedGroupIds"
                  :selected-id="selectedNodeId"
                  @select="selectNode"
                  @toggle-group="toggleGroup"
                  @add-after="({ targetId, type }) => addAfter(targetId, type)"
                  @add-child="({ targetId, type }) => addChild(targetId, type)"
                  @drag-start="beginDrag"
                  @drag-end="endDrag"
                  @drop-node="({ targetId, position }) => moveNode(targetId, position)"
                  @remove="removeNode"
                />

                <div
                  v-if="editor.tree.length"
                  class="rounded-xl border border-dashed px-4 py-3 text-center text-xs text-muted-foreground transition"
                  :class="draggedNodeId ? 'border-sky-400 bg-sky-500/5' : 'border-border/70'"
                  @dragover.prevent
                  @drop.prevent="moveNodeToRootEnd"
                >
                  Перетащите сюда, чтобы переместить в конец корня
                </div>

                <div
                  v-if="!editor.tree.length"
                  class="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Начните со структуры: добавьте root group или root link.
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card class="flex min-h-0 overflow-visible py-0">
          <div class="flex h-full min-h-0 flex-col">
            <div class="border-b px-4 py-3">
              <div class="flex items-center gap-2 text-sm font-semibold">
                <Link2 class="size-4 text-emerald-500" />
                Детали
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                Выберите элемент в дереве слева, чтобы редактировать его свойства.
              </div>
            </div>

            <div class="min-h-0 flex-1">
              <div v-if="selectedNode" class="space-y-4 p-4">
                <div class="flex items-center justify-between gap-2">
                  <div class="text-sm font-semibold">
                    Выбранный элемент
                  </div>
                  <Badge variant="outline">
                    {{ nodeTypeLabel(selectedNode.type) }}
                  </Badge>
                </div>

                <div class="space-y-2">
                  <Label>Тип</Label>
                  <Select :model-value="selectedNode.type" @update:model-value="changeSelectedNodeTypeFromSelect">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="section">
                        Секция
                      </SelectItem>
                      <SelectItem value="group">
                        Группа
                      </SelectItem>
                      <SelectItem value="link">
                        Ссылка
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-2">
                  <Label>Название</Label>
                  <Input v-model="selectedNode.title" placeholder="Панель управления" />
                </div>

                <div class="space-y-2">
                  <Label>Иконка</Label>
                  <Input v-model="selectedNode.icon" placeholder="ti ti-layout-grid" />
                </div>

                <div v-if="selectedNode.type === 'section'" class="space-y-2">
                  <Label>Короткое название</Label>
                  <Input v-model="selectedNode.collapsedTitle" placeholder="Demo" />
                </div>

                <template v-if="selectedNode.type === 'group'">
                  <Label>Путь группы</Label>
                  <Input v-model="selectedNode.path" placeholder="/schedule" />

                  <div class="space-y-2">
                    <Label>Имя роута группы</Label>
                    <Input v-model="selectedNode.routeName" placeholder="schedule" />
                  </div>
                </template>

                <template v-if="selectedNode.type === 'link'">
                  <div class="space-y-2">
                    <Label>Путь</Label>
                    <Input v-model="selectedNode.path" placeholder="/dashboard" />
                  </div>

                  <div class="space-y-2">
                    <Label>Имя роута</Label>
                    <Input v-model="selectedNode.routeName" placeholder="dashboard" />
                  </div>

                  <Label class="flex items-center gap-2 text-sm">
                    <Checkbox :model-value="!!selectedNode.external" @update:model-value="(value) => updateSelectedFlag('external', value)" />
                    Внешняя ссылка
                  </Label>
                </template>

                <div class="grid gap-2 sm:grid-cols-2">
                  <Label class="flex items-center gap-2 text-sm">
                    <Checkbox :model-value="!!selectedNode.hidden" @update:model-value="(value) => updateSelectedFlag('hidden', value)" />
                    Скрыт
                  </Label>
                  <Label class="flex items-center gap-2 text-sm">
                    <Checkbox :model-value="!!selectedNode.disabled" @update:model-value="(value) => updateSelectedFlag('disabled', value)" />
                    Отключен
                  </Label>
                </div>

                <div class="rounded-2xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                  Секция разделяет меню на блоки. Группа отображается как пункт с вложенными ссылками. Ссылка ведёт на маршрут или внешний URL.
                </div>
              </div>

              <div
                v-else
                class="flex h-full min-h-[260px] items-center justify-center px-6 text-center text-sm text-muted-foreground"
              >
                Ничего не выбрано. Нажмите на любой элемент слева, чтобы открыть детали.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>

  <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
    Выберите navigation документ.
  </div>
</template>

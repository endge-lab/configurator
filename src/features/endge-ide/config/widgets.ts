import type { WidgetDefinition } from '@/components/layouts/grid'

import { defineAsyncComponent, markRaw } from 'vue'

import { ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID } from '@/features/endge-admin-ui-editor/entities/ui-editor-workspace'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { ENDGE_IDE_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-ide/domain/types/runtime-preview.types'

const UIEditorLibrary_Widget = defineAsyncComponent(() => import('@/features/endge-admin-ui-editor/ui/UIEditorLibrary_Widget.vue'))
const Releases_Widget = defineAsyncComponent(() => import('@/features/configurator-releases/ui/Releases_Widget.vue'))
const Domain_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/Domain_Widget.vue'))
const Events_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/Events_Widget.vue'))
const Problems_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/Problems_Widget.vue'))
const Raph_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/Raph_Widget.vue'))
const RuntimeTree_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/RuntimeTree_Widget.vue'))
const Storage_Widget = defineAsyncComponent(() => import('@/features/endge-ide/ui/widgets/Storage_Widget.vue'))

export const endgeIDEWidgetsConfig: WidgetDefinition[] = [
  {
    id: 'project',
    title: 'Проект',
    icon: 'FolderTree',
    iconClass: 'text-teal-600 dark:text-[#89DDFF]',
    content: 'component',
    defaultComponent: markRaw(Domain_Widget),
    singleton: true,
    defaultPosition: 'left',
    allowedPositions: ['left', 'right', 'floating'],
    floatingConstraints: {
      minWidth: 250,
      maxWidth: 500,
      minHeight: 300,
      maxHeight: 600,
      defaultWidth: 300,
      defaultHeight: 400,
    },
  },
  {
    id: ENDGE_IDE_RUNTIME_TREE_WIDGET_ID,
    title: 'Runtime Tree',
    icon: 'Network',
    iconClass: 'text-violet-600 dark:text-[#C792EA]',
    content: 'component',
    defaultComponent: markRaw(RuntimeTree_Widget),
    singleton: true,
    permanent: true,
    defaultPosition: 'left',
    allowedPositions: ['left'],
  },
  {
    id: 'releases',
    title: 'Версии',
    icon: 'GitBranch',
    iconClass: 'text-emerald-600 dark:text-[#C3E88D]',
    content: 'component',
    defaultComponent: markRaw(Releases_Widget),
    singleton: true,
    defaultPosition: 'left',
    allowedPositions: ['left', 'right', 'floating'],
    floatingConstraints: {
      minWidth: 250,
      maxWidth: 500,
      minHeight: 300,
      maxHeight: 600,
      defaultWidth: 300,
      defaultHeight: 400,
    },
  },
  {
    id: ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID,
    title: 'UI Library',
    icon: 'LibraryBig',
    iconClass: 'text-indigo-600 dark:text-[#82AAFF]',
    content: 'component',
    defaultComponent: markRaw(UIEditorLibrary_Widget),
    singleton: true,
    defaultPosition: 'left',
    allowedPositions: ['left', 'right', 'floating'],
    floatingConstraints: {
      minWidth: 250,
      maxWidth: 520,
      minHeight: 300,
      maxHeight: 900,
      defaultWidth: 320,
      defaultHeight: 540,
    },
  },
  {
    id: ENDGE_IDE_PROBLEMS_WIDGET_ID,
    title: 'Problems',
    icon: 'ShieldAlert',
    iconClass: 'text-amber-600 dark:text-[#FFCB6B]',
    content: 'component',
    defaultComponent: markRaw(Problems_Widget),
    singleton: true,
    permanent: true,
    defaultPosition: 'left',
    allowedPositions: ['left'],
  },
  // {
  //   id: 'terminal',
  //   title: 'Терминал',
  //   icon: 'Terminal',
  //   content: 'component',
  //   defaultComponent: markRaw(Terminal_Widget),
  //   singleton: true,
  //   defaultPosition: 'bottom',
  //   allowedPositions: ['bottom', 'left', 'right', 'floating'],
  //   floatingConstraints: {
  //     minWidth: 300,
  //     maxWidth: 800,
  //     minHeight: 200,
  //     maxHeight: 500,
  //     defaultWidth: 600,
  //     defaultHeight: 300,
  //   },
  // },
  {
    id: 'storage',
    title: 'Локальное хранилище',
    icon: 'Database',
    iconClass: 'text-orange-600 dark:text-[#F78C6C]',
    content: 'component',
    defaultComponent: markRaw(Storage_Widget),
    singleton: true,
    defaultPosition: 'right',
    allowedPositions: ['left', 'right', 'floating'],
    floatingConstraints: {
      minWidth: 300,
      maxWidth: 600,
      minHeight: 400,
      maxHeight: 800,
      defaultWidth: 400,
      defaultHeight: 600,
    },
  },
  {
    id: 'events',
    title: 'События',
    icon: 'Activity',
    iconClass: 'text-cyan-600 dark:text-[#89DDFF]',
    content: 'component',
    defaultComponent: markRaw(Events_Widget),
    singleton: true,
    defaultPosition: 'right',
    allowedPositions: ['left', 'right', 'floating'],
    floatingConstraints: {
      minWidth: 300,
      maxWidth: 600,
      minHeight: 400,
      maxHeight: 800,
      defaultWidth: 400,
      defaultHeight: 600,
    },
  },
  {
    id: 'raph',
    title: 'Raph',
    icon: 'Zap',
    iconClass: 'text-yellow-600 dark:text-[#FFCB6B]',
    content: 'component',
    defaultComponent: markRaw(Raph_Widget),
    singleton: true,
    defaultPosition: 'right',
    allowedPositions: ['left', 'right', 'floating'],
    floatingConstraints: {
      minWidth: 300,
      maxWidth: 600,
      minHeight: 400,
      maxHeight: 800,
      defaultWidth: 400,
      defaultHeight: 600,
    },
  },
]

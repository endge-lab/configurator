import Grid from '@/app/ui/layouts/grid/Grid.vue'
import Header from '@/app/ui/layouts/grid/Header.vue'

export {
  Grid,
  Header,
}

export { getIconComponent } from '@/app/ui/layouts/grid/icons.ts'

export {
  addHeaderAction,
  addOptionsAction,
  createWidgetInstance,
  destroyAllWidgetInstances,
  destroyWidgetInstance,
  getAreaActiveWidget,
  getAreaExpanded,
  getLayoutScope,
  getLayoutState,
  getWidget,
  getWidgetInstance,
  getWidgetInstances,
  getWidgetOrder,
  hideWidget,
  migratePersistedWidgetId,
  moveWidget,
  registerWidget,
  removeHeaderAction,
  removeOptionsAction,
  removePersistedWidgetId,
  reorderWidget,
  setAreaActiveWidget,
  setAreaExpanded,
  setLayoutScope,
  setWidgetInstanceLoading,
  setWidgetInstanceTitle,
  showWidget,
  toggleWidget,
  unregisterAllWidgets,
  unregisterWidget,
  useLayout,
} from '@/app/ui/layouts/grid/layout.ts'

export type { LayoutOptions } from '@/app/ui/layouts/grid/types.ts'

export type {
  FloatingWidgetState,
  LayoutState,
  LayoutWidgetAreaState,
  LayoutWidgetsState,
  WidgetDefinition,
  WidgetDefinitionBase,
  WidgetDefinitionComponent,
  WidgetDefinitionIframe,
  WidgetDefinitionState,
  WidgetFloatingConstraints,
  WidgetHeaderAction,
  WidgetInstance,
  WidgetInstanceBase,
  WidgetInstanceComponent,
  WidgetInstanceIframe,
  WidgetPosition,
} from '@/app/ui/layouts/grid/types.ts'

export { useWidgetIframe } from '@/app/ui/layouts/grid/useWidgetIframe.ts'

import Grid from '@/components/layouts/grid/Grid.vue'
import Header from '@/components/layouts/grid/Header.vue'

export {
  Grid,
  Header,
}

export { getIconComponent } from '@/components/layouts/grid/icons.ts'

export {
  addHeaderAction,
  addOptionsAction,
  createWidgetInstance,
  destroyAllWidgetInstances,
  destroyWidgetInstance,
  getAreaActiveWidget,
  getAreaExpanded,
  getLayoutState,
  getWidget,
  getWidgetInstance,
  getWidgetInstances,
  hideWidget,
  moveWidget,
  registerWidget,
  removeHeaderAction,
  removeOptionsAction,
  setAreaActiveWidget,
  setAreaExpanded,
  setWidgetInstanceLoading,
  setWidgetInstanceTitle,
  showWidget,
  toggleWidget,
  unregisterAllWidgets,
  unregisterWidget,
  useLayout,
} from '@/components/layouts/grid/layout.ts'

export type { LayoutOptions } from '@/components/layouts/grid/types.ts'

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
} from '@/components/layouts/grid/types.ts'

export { useWidgetIframe } from '@/components/layouts/grid/useWidgetIframe.ts'

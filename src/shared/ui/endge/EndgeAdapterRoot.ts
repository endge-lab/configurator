import type { Component } from 'vue'

import { Endge } from '@endge/core'
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  useAttrs,
  useSlots,
} from 'vue'

/** Renders an opaque root entry point owned by the active UI adapter. */
export default defineComponent({
  name: 'EndgeAdapterRoot',
  inheritAttrs: false,
  props: {
    rootKey: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const attrs = useAttrs()
    const slots = useSlots()
    const revision = ref(0)
    const unsubscribe = Endge.uiRegistry.subscribe(() => revision.value++)
    const root = computed(() => {
      void revision.value
      const adapter = Endge.uiRegistry.adapters.active
      const implementation = adapter?.roots?.[props.rootKey]
      if (!adapter) {
        throw new Error(`[EndgeAdapterRoot] active UI adapter is not selected for root "${props.rootKey}"`)
      }
      if (!implementation) {
        throw new Error(`[EndgeAdapterRoot] adapter "${adapter.id}" does not provide root "${props.rootKey}"`)
      }
      return implementation as Component
    })

    onBeforeUnmount(unsubscribe)

    return () => h(root.value, attrs, slots)
  },
})

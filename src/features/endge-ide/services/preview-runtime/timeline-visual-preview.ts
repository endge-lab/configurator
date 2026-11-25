import type { ComponentSFCPreviewOptions, ComponentSFCPreviewProps } from '@endge/core'
import type { Ref, ShallowRef } from 'vue'
import type { ComponentPreviewContext } from './component-preview-runtime'
import { Endge } from '@endge/core'
import { Raph } from '@raphy-js/raph'
import { computed, ref, shallowRef, watch } from 'vue'
import { destroyComponentPreviewContext, prepareComponentPreviewContext, resolveComponentPreviewInput } from './component-preview-runtime'

interface TimelinePreviewDeclarations {
  props: ComponentSFCPreviewProps
  options: ComponentSFCPreviewOptions | null
}

export function useTimelineVisualPreview(
  identity: () => string,
  declarations: Ref<TimelinePreviewDeclarations>,
  enabled: Ref<boolean>,
  scopeId: string,
): { data: ShallowRef<Record<string, unknown>>, status: Ref<'idle' | 'loading' | 'ready' | 'error'>, error: Ref<string> } {
  const data = shallowRef<Record<string, unknown>>({})
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  const key = computed(() => JSON.stringify(declarations.value))
  let generation = 0

  watch([enabled, identity, key], async ([open, currentIdentity], _, onCleanup) => {
    if (!open) {
      status.value = 'idle'
      data.value = {}
      return
    }
    const { props, options } = declarations.value
    const rootPath = `runtime-preview.timeline-visual.${scopeId}.${++generation}`
    let composition: ComponentPreviewContext | null = null
    let unwatch: (() => void) | undefined
    let cancelled = false
    onCleanup(() => {
      cancelled = true
      unwatch?.()
      void destroyComponentPreviewContext(composition).finally(() => Raph.delete(rootPath)).catch(console.error)
    })
    error.value = ''
    data.value = {}
    status.value = 'loading'
    try {
      const appScope = Endge.runtime.createAppScope({ id: rootPath, rootPath, persistence: 'disabled' })
      composition = await prepareComponentPreviewContext(options, props, { identity: currentIdentity }, {
        appScope,
        contextSuffix: `timeline-visual-${scopeId}-${generation}`,
        meta: { mode: 'preview' },
      })
      if (cancelled) {
        await destroyComponentPreviewContext(composition)
        return
      }
      const input = resolveComponentPreviewInput(props, composition, `${rootPath}.props`)
      if (input.kind === 'local') {
        data.value = input.props
      }
      else {
        const entries = Object.entries(input.bindings)
        const refresh = () => {
          data.value = { ...input.props, ...Object.fromEntries(entries.map(([name, binding]) => [name, Raph.get(binding.path)])) }
        }
        unwatch = Raph.kernel.watch(entries.flatMap(([, binding]) => [binding.path, `${binding.path}.*`]), refresh)
        refresh()
      }
      status.value = 'ready'
    }
    catch (cause) {
      if (cancelled) {
        return
      }
      data.value = {}
      error.value = cause instanceof Error ? cause.message : String(cause)
      status.value = 'error'
    }
  }, { immediate: true })
  return { data, status, error }
}

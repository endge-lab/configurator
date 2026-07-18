import { Endge } from '@endge/core'

import UIEditorNodeRendererBadge from '@/features/endge-admin-ui-editor/ui/renderers/UIEditorNodeRendererBadge.vue'
import UIEditorNodeRendererButton from '@/features/endge-admin-ui-editor/ui/renderers/UIEditorNodeRendererButton.vue'
import UIEditorNodeRendererContainer from '@/features/endge-admin-ui-editor/ui/renderers/UIEditorNodeRendererContainer.vue'
import UIEditorNodeRendererHost from '@/features/endge-admin-ui-editor/ui/renderers/UIEditorNodeRendererHost.vue'
import UIEditorNodeRendererText from '@/features/endge-admin-ui-editor/ui/renderers/UIEditorNodeRendererText.vue'
import UIEditorNodeRendererTextRuntime from '@/features/endge-admin-ui-editor/ui/renderers/UIEditorNodeRendererTextRuntime.vue'

let isRegistered = false

function registerRendererPair(definitionRef: string, adminRef: string, runtimeRef: string, component: any): void {
  Endge.uiRegistry.registerRenderer({
    ref: adminRef,
    definitionRef,
    surface: 'admin',
    role: 'main',
    component,
  })

  Endge.uiRegistry.registerRenderer({
    ref: runtimeRef,
    definitionRef,
    surface: 'runtime',
    role: 'main',
    component,
  })
}

export function ensureUIEditorDemoCoreRenderersRegistered(): void {
  if (isRegistered) {
    return
  }

  Endge.uiRegistry.registerRenderer({
    ref: 'ui.text.admin.main',
    definitionRef: 'ui.text',
    surface: 'admin',
    role: 'main',
    component: UIEditorNodeRendererText,
  })

  Endge.uiRegistry.registerRenderer({
    ref: 'ui.text.runtime.main',
    definitionRef: 'ui.text',
    surface: 'runtime',
    role: 'main',
    component: UIEditorNodeRendererTextRuntime,
  })

  registerRendererPair('ui.button', 'ui.button.admin.main', 'ui.button.runtime.main', UIEditorNodeRendererButton)
  registerRendererPair('sfc.badge', 'sfc.badge.admin.main', 'sfc.badge.runtime.main', UIEditorNodeRendererBadge)

  for (const definitionRef of ['ui.box', 'ui.stack', 'ui.inline', 'ui.grid', 'ui.form', 'ui.nav-panel']) {
    registerRendererPair(definitionRef, `${definitionRef}.admin.main`, `${definitionRef}.runtime.main`, UIEditorNodeRendererContainer)
  }

  for (const definitionRef of ['ui.table', 'ui.field', 'ui.component-host']) {
    registerRendererPair(definitionRef, `${definitionRef}.admin.main`, `${definitionRef}.runtime.main`, UIEditorNodeRendererHost)
  }

  isRegistered = true
}

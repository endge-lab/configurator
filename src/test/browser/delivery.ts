import type { ComponentSFCProgramPayload } from '@endge/core'
import * as core from '@endge/core'
import * as uiVue from '@endge/ui-vue'
import { Raph } from '@raphy-js/raph'
import * as vue from 'vue'

if (!Raph.configured) {
  Raph.configure({ mode: 'runtime' })
}
core.Endge.use(uiVue.EndgeVuePlugin)

document.querySelector('input')!.addEventListener('change', async (event) => {
  try {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) {
      return
    }
    const delivery = await new core.EndgeBundleCodec_Service().decode(new Uint8Array(await file.arrayBuffer()))
    await uiVue.bootVueDelivery(delivery, { tenant: 'customer-a', deployment: 'production', channel: 'mobile' }, { scope: { workspaceIdentity: 'workspace-test' }, vars: {} }, async () => ({
      core,
      vue,
      uiVue,
      timeline: await uiVue.loadVueModuleTimeline(),
    }))
    await core.Endge.runtime.mountStartup()
    const selected = core.Endge.program.getArtifact<ComponentSFCProgramPayload>('component-sfc', 'selected-table')
    vue.createApp({ render: () => vue.h(uiVue.SFC_Renderer, { ir: selected!.payload.ir }) }).mount('#app')
    document.body.dataset.ready = 'true'
  }
  catch (error) {
    document.body.dataset.error = error instanceof Error ? error.message : String(error)
  }
})

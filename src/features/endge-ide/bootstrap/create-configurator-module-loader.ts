import * as core from '@endge/core'
import * as uiVue from '@endge/ui-vue'
import * as endgeUtils from '@endge/utils'
import * as raph from '@raphy-js/raph'
import * as vue from 'vue'
import * as vueI18n from 'vue-i18n'
import * as router from 'vue-router'

export function createConfiguratorModuleLoader(backendURL: string) {
  return uiVue.createVueModuleCatalogLoader({
    backendURL,
    host: async () => ({
      core,
      uiVue,
      vue,
      timeline: await uiVue.loadVueModuleTimeline(),
      endgeUtils,
      raph,
      vueI18n,
      router,
    }),
  })
}

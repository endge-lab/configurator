import * as core from '@endge/core'
import * as uiVue from '@endge/ui-vue'
import * as endgeUtils from '@endge/utils'
import * as raph from '@raphy-js/raph'
import * as vue from 'vue'
import * as vueI18n from 'vue-i18n'
import * as router from 'vue-router'
import { ServiceBackendModulesHttpAdapter } from '@/features/endge-ide/adapters/backend/ServiceBackendModulesHttp_Adapter'

export function createConfiguratorModuleLoader(backendURL: string) {
  return new ServiceBackendModulesHttpAdapter(backendURL).loader(async () => ({
    core,
    uiVue,
    vue,
    timeline: await uiVue.loadVueModuleTimeline(),
    endgeUtils,
    raph,
    vueI18n,
    router,
  }))
}

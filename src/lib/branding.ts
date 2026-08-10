import { inject } from 'vue'

import { brandingBindingKey } from '@/app/model/adapters/branding.binding'

/** Vue-facing adapter over the application-scoped branding module. */
export function useBranding() {
  const branding = inject(brandingBindingKey)
  if (!branding) {
    throw new Error('[Branding] Configurator branding binding is unavailable')
  }
  return {
    branding: branding.value,
    brandings: branding.brandings,
    currentBranding: branding.currentBranding,
  }
}

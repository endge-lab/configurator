import type { ComputedRef, Ref } from 'vue'

export interface BrandingItem {
  brand: string
  name: string
  description: string
  iconHref?: string
  themeHref?: string
}

export interface BrandingBinding {
  value: Ref<string>
  brandings: ComputedRef<BrandingItem[]>
  currentBranding: ComputedRef<BrandingItem>
}

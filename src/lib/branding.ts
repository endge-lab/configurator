import type { Plugin, Ref } from 'vue'

import { useFavicon } from '@vueuse/core'
import { computed, inject, watch } from 'vue'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

const envBranding = import.meta.env.VITE_BRANDING ?? 'default'
const brandingRef = useSafeLocalStorage('app:branding', envBranding)

// HELPERS ============================================================================================================

function extractBrand(path: string) {
  const m = path.match(/\/assets\/branding\/([^/]+)\//)
  return m?.[1]
}

function applyTheme(href?: string) {
  if (typeof document === 'undefined' || !href)
    return
  let link = document.getElementById('branding-theme') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = 'branding-theme'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  if (link.href !== href)
    link.href = href
}

// LOAD ASSETS ========================================================================================================

// Eagerly include all manifest.json, icon.svg and theme.css so they are available in build
const brandingMetaFiles = import.meta.glob('/src/assets/branding/*/manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, { name?: string, description?: string }>

const iconFiles = import.meta.glob('/src/assets/branding/*/icon.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const themeFiles = import.meta.glob('/src/assets/branding/*/theme.css', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Build maps keyed by brand
const metaByBrand: Record<string, { name?: string, description?: string }> = {}
for (const path in brandingMetaFiles) {
  const b = extractBrand(path)
  if (b && brandingMetaFiles[path])
    metaByBrand[b] = brandingMetaFiles[path]
}

const iconHrefByBrand: Record<string, string> = {}
for (const path in iconFiles) {
  const b = extractBrand(path)
  if (b && iconFiles[path])
    iconHrefByBrand[b] = iconFiles[path]
}

const themeHrefByBrand: Record<string, string> = {}
for (const path in themeFiles) {
  const b = extractBrand(path)
  if (b && themeFiles[path])
    themeHrefByBrand[b] = themeFiles[path]
}

// BRANDINGS LIST =====================================================================================================

interface BrandingItem {
  brand: string
  name: string
  description: string
  iconHref?: string
  themeHref?: string
}

const brandings = computed<BrandingItem[]>(() => {
  const set = new Set<string>([
    ...Object.keys(metaByBrand),
    ...Object.keys(iconHrefByBrand),
    ...Object.keys(themeHrefByBrand),
    envBranding,
  ])

  const list: BrandingItem[] = []
  for (const brand of set) {
    const meta = metaByBrand[brand] || {}
    list.push({
      brand,
      name: meta.name || brand,
      description: meta.description || '',
      iconHref: iconHrefByBrand[brand],
      themeHref: themeHrefByBrand[brand],
    })
  }
  // Optional: stable sort by name
  return list.sort((a, b) => a.name.localeCompare(b.name))
})

// CURRENT BRAND DERIVATIVES ===========================================================================================

const currentBrandKey = computed(() => brandingRef.value || envBranding)

const currentBranding = computed<BrandingItem>(() => {
  const list = brandings.value
  return (
    list.find(b => b.brand === currentBrandKey.value)
    || list.find(b => b.brand === envBranding)
    || list[0]
  ) as BrandingItem
})

const iconHref = computed(() => currentBranding.value?.iconHref ?? iconHrefByBrand[envBranding])
const themeHref = computed(() => currentBranding.value?.themeHref ?? themeHrefByBrand[envBranding])

// PLUGIN ==============================================================================================================

const BRANDING_KEY = Symbol('branding')

export const branding: Plugin = {
  install(app) {
    // Set favicon and apply theme when branding changes
    useFavicon(iconHref)
    watch(themeHref, href => applyTheme(href), { immediate: true })

    // Provide globally
    app.provide(BRANDING_KEY, brandingRef)
    // Back-compat: expose current branding key on globalProperties
    app.config.globalProperties.$branding = brandingRef
  },
}

export function useBranding() {
  const injected = inject<Ref<string>>(BRANDING_KEY)
  return {
    branding: injected ?? brandingRef,
    brandings,
    currentBranding,
  }
}

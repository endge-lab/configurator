import type { BrandingBinding, BrandingItem } from '@/app/domain/types/branding.type'
import type { App } from 'vue'

import { computed, watch } from 'vue'

import { brandingBindingKey } from '@/app/model/adapters/branding.binding'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

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

/** Owns branding selection and its document-level favicon/theme adapters. */
export class ConfiguratorBranding_Module implements BrandingBinding {
  private readonly _defaultBrand = import.meta.env.VITE_BRANDING ?? 'default'
  private readonly _metaByBrand = collectBrandAssets(brandingMetaFiles)
  private readonly _iconHrefByBrand = collectBrandAssets(iconFiles)
  private readonly _themeHrefByBrand = collectBrandAssets(themeFiles)
  private readonly _stopHandles: Array<() => void> = []
  private _initialized = false

  public readonly value = useSafeLocalStorage('app:branding', this._defaultBrand)
  public readonly brandings = computed<BrandingItem[]>(() => {
    const brands = new Set([
      ...Object.keys(this._metaByBrand),
      ...Object.keys(this._iconHrefByBrand),
      ...Object.keys(this._themeHrefByBrand),
      this._defaultBrand,
    ])

    return [...brands]
      .map((brand) => {
        const meta = this._metaByBrand[brand] ?? {}
        return {
          brand,
          name: meta.name || brand,
          description: meta.description || '',
          iconHref: this._iconHrefByBrand[brand],
          themeHref: this._themeHrefByBrand[brand],
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  })

  public readonly currentBranding = computed<BrandingItem>(() => {
    const brand = this.value.value || this._defaultBrand
    return this.brandings.value.find(item => item.brand === brand)
      ?? this.brandings.value.find(item => item.brand === this._defaultBrand)
      ?? this.brandings.value[0]!
  })

  public setup(app: App): void {
    if (this._initialized) {
      return
    }
    this._initialized = true
    app.provide(brandingBindingKey, this)
    this._stopHandles.push(
      watch(
        () => this.currentBranding.value.iconHref,
        href => applyFavicon(href ?? this._iconHrefByBrand[this._defaultBrand]),
        { immediate: true },
      ),
      watch(
        () => this.currentBranding.value.themeHref,
        href => applyTheme(href ?? this._themeHrefByBrand[this._defaultBrand]),
        { immediate: true },
      ),
    )
  }

  public destroy(): void {
    for (const stop of this._stopHandles.splice(0).reverse()) {
      stop()
    }
    this._initialized = false
  }
}

function extractBrand(path: string): string | undefined {
  return path.match(/\/assets\/branding\/([^/]+)\//)?.[1]
}

function collectBrandAssets<T>(files: Record<string, T>): Record<string, T> {
  const assets: Record<string, T> = {}
  for (const [path, value] of Object.entries(files)) {
    const brand = extractBrand(path)
    if (brand) {
      assets[brand] = value
    }
  }
  return assets
}

function applyFavicon(href?: string): void {
  if (typeof document === 'undefined' || !href) {
    return
  }
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.append(link)
  }
  link.href = href
}

function applyTheme(href?: string): void {
  if (typeof document === 'undefined' || !href) {
    return
  }
  let link = document.getElementById('branding-theme') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = 'branding-theme'
    link.rel = 'stylesheet'
    document.head.append(link)
  }
  if (link.href !== href) {
    link.href = href
  }
}

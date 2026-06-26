import type { Component } from 'vue'

import { defineAsyncComponent } from 'vue'

import { useBranding } from '@/lib/branding'

export interface AppSwitcherGroup {
  label: string
  links: AppSwitcherLink[]
}

export interface AppSwitcherLink {
  title: string
  description?: string
  icon?: string
  isExternal?: boolean
  href: string
}

export type ResolvedIcon
  = | { type: 'url', src: string }
    | { type: 'component', component: Component }
    | null

function resolveLucideIcon(name: string): Component {
  return defineAsyncComponent(() =>
    import('lucide-vue-next').then((mod) => {
      const icon = (mod as unknown as Record<string, Component>)[name]
      if (!icon)
        throw new Error(`[AppSwitcher] Lucide icon "${name}" not found`)
      return icon
    }),
  )
}

function resolveStaticIcon(icon: string): ResolvedIcon {
  if (!icon)
    return null

  if (icon.startsWith('/') || icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:'))
    return { type: 'url', src: icon }

  if (icon !== 'branding')
    return { type: 'component', component: resolveLucideIcon(icon) }

  return null
}

export function useAppSwitcherIcon() {
  const { currentBranding } = useBranding()

  function resolveIcon(icon: string | undefined): ResolvedIcon {
    if (!icon)
      return null

    if (icon === 'branding') {
      const href = currentBranding.value?.iconHref
      return href ? { type: 'url', src: href } : null
    }

    return resolveStaticIcon(icon)
  }

  return { resolveIcon }
}

const DEFAULT_APP_GROUP: AppSwitcherGroup = {
  label: 'Приложения',
  links: [
    { title: 'Конфигуратор', href: '/' },
  ],
}

function parseAppSwitcher(raw: string | undefined): AppSwitcherGroup[] {
  if (!raw)
    return [DEFAULT_APP_GROUP]
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0)
      return [DEFAULT_APP_GROUP]
    return parsed
  }
  catch {
    console.warn('[AppSwitcher] Failed to parse VITE_APP_SWITCHER:', raw)
    return [DEFAULT_APP_GROUP]
  }
}

export const appSwitcherGroups: AppSwitcherGroup[] = parseAppSwitcher(import.meta.env.VITE_APP_SWITCHER)

import * as icons from 'lucide-vue-next'

export function getIconComponent(iconName?: string) {
  if (!iconName)
    return null
  return (icons as Record<string, unknown>)[iconName] ?? null
}

import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/utils'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

function normalizePath(value: unknown): string | null {
  if (typeof value !== 'string') { return null }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function resolveNavigationPath(value: unknown): string | null {
  if (typeof value !== 'string') { return null }
  const resolved = Endge.vars.resolve<string>(value, {
    coerce: (next) => next == null ? '' : String(next),
    onInvalid: 'as-is',
    fallback: value,
  })
  return normalizePath(resolved)
}

function toLink(path?: string | null, routeName?: string | null, external?: boolean): string | RouteLocationRaw {
  if (external && path) { return path }
  if (path) { return routeName ? { path, name: routeName } as RouteLocationRaw : path }
  if (routeName) { return { name: routeName } as RouteLocationRaw }
  return '/'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function mapTreeLink(node: Record<string, unknown>): Omit<NavItemLink, 'icon'> | null {
  if (node.type !== 'link') { return null }

  const path = resolveNavigationPath(node.path)
  const routeName = normalizePath(node.routeName)

  return {
    type: 'link',
    title: String(node.title ?? ''),
    hidden: node.hidden === true,
    disabled: node.disabled === true,
    link: toLink(
      path,
      routeName,
      node.external === true,
    ),
    external: node.external === true,
    matchPath: path,
    matchRouteName: routeName,
  }
}

function collectTreeLinks(nodes: unknown[]): Omit<NavItemLink, 'icon'>[] {
  const links: Omit<NavItemLink, 'icon'>[] = []

  for (const rawNode of nodes) {
    if (!isRecord(rawNode)) { continue }

    if (rawNode.type === 'link') {
      const link = mapTreeLink(rawNode)
      if (link) { links.push(link) }
      continue
    }

    if (rawNode.type === 'group' && Array.isArray(rawNode.children)) { links.push(...collectTreeLinks(rawNode.children)) }
  }

  return links
}

function mapTreeItem(rawNode: unknown): NavItem | null {
  if (!isRecord(rawNode)) { return null }

  if (rawNode.type === 'link') {
    const link = mapTreeLink(rawNode)
    if (!link) { return null }

    return {
      ...link,
      asGroupButton: rawNode.external === true || rawNode.asGroupButton === true,
    }
  }

  if (rawNode.type !== 'group') { return null }

  return {
    type: 'group',
    title: String(rawNode.title ?? ''),
    hidden: rawNode.hidden === true,
    disabled: rawNode.disabled === true,
    path: resolveNavigationPath(rawNode.path),
    matchRouteName: normalizePath(rawNode.routeName),
    links: collectTreeLinks(Array.isArray(rawNode.children) ? rawNode.children : []),
  }
}

function buildNavItems(nodes: unknown): NavItem[] {
  if (!Array.isArray(nodes)) { return [] }

  return nodes
    .map(mapTreeItem)
    .filter((item): item is NavItem => !!item)
}

export interface NavGroup {
  title?: string
  collapsedTitle?: string
  hidden?: boolean
  items: NavItem[]
}

export interface NavItemGroup {
  type: 'group'
  title: string
  icon?: Component
  hidden?: boolean
  disabled?: boolean
  path?: string | null
  matchRouteName?: string | null
  links: Omit<NavItemLink, 'icon'>[]
}

export interface NavItemLink {
  type: 'link'
  title: string
  icon?: Component
  hidden?: boolean
  disabled?: boolean
  asGroupButton?: boolean
  link: string | RouteLocationRaw
  external?: boolean
  matchPath?: string | null
  matchRouteName?: string | null
}

export type NavItem = NavItemGroup | NavItemLink

export function isItemLink(item: NavItem): item is NavItemLink {
  return item.type === 'link'
}

export function isItemGroup(item: NavItem): item is NavItemGroup {
  return item.type === 'group'
}

export function isLinkActive(
  item: Pick<NavItemLink, 'external' | 'disabled' | 'matchPath' | 'matchRouteName'>,
  route: { path?: string, name?: unknown },
): boolean {
  if (item.external || item.disabled) { return false }

  const currentPath = String(route.path ?? '')
  const currentRouteName = typeof route.name === 'string' ? route.name : ''

  if (item.matchPath) { return currentPath === item.matchPath || currentPath.startsWith(`${item.matchPath}/`) }

  if (item.matchRouteName) { return currentRouteName === item.matchRouteName }

  return false
}

export function isGroupActiveByRoute(
  item: Pick<NavItemGroup, 'disabled' | 'path' | 'matchRouteName' | 'links'>,
  route: { path?: string, name?: unknown },
): boolean {
  if (item.disabled) { return false }

  const currentPath = String(route.path ?? '')
  const currentRouteName = typeof route.name === 'string' ? route.name : ''
  if (item.path) { return currentPath === item.path || currentPath.startsWith(`${item.path}/`) }
  if (item.matchRouteName) { return currentRouteName === item.matchRouteName }

  return item.links.some(link => isLinkActive(link, route))
}

const DEFAULT_NAVIGATION_ID = 'main'

function mapSection(rawNode: Record<string, unknown>): NavGroup | null {
  const items = buildNavItems(rawNode.children)
  if (!items.length) { return null }

  return {
    title: String(rawNode.title ?? ''),
    collapsedTitle: normalizePath(rawNode.collapsedTitle) ?? undefined,
    hidden: rawNode.hidden === true,
    items,
  }
}

function resolveNavigationGroups(identity = DEFAULT_NAVIGATION_ID): NavGroup[] {
  try {
    const doc = Endge.domain.getNavigationByIdentity(identity) as { tree?: unknown[] } | null
    const rawTree = doc?.tree
    if (!Array.isArray(rawTree)) { return [] }

    const groups: NavGroup[] = []
    let looseItems: NavItem[] = []

    function flushLooseItems(): void {
      if (!looseItems.length) { return }
      groups.push({ items: looseItems })
      looseItems = []
    }

    for (const rawNode of rawTree) {
      if (!isRecord(rawNode)) { continue }

      if (rawNode.type === 'section') {
        const section = mapSection(rawNode)
        if (section) {
          flushLooseItems()
          groups.push(section)
        }
        continue
      }

      const item = mapTreeItem(rawNode)
      if (item) {
        looseItems.push(rawNode.type === 'link' ? { ...item, asGroupButton: true } as NavItem : item)
      }
    }

    flushLooseItems()
    return groups
  }
  catch {
    return []
  }
}

export function useNavigation(identity = DEFAULT_NAVIGATION_ID) {
  const domainRef = useSubscribableRefAuto(Endge.domain)
  return computed(() => {
    void domainRef.value
    return resolveNavigationGroups(identity)
  })
}

export function loadNavigationFromDomain(identity = DEFAULT_NAVIGATION_ID): NavGroup[] {
  return resolveNavigationGroups(identity)
}

const DEFAULT_SECTION_TITLE = 'Конфигуратор'

function isRoutePathMatch(currentPath: string, candidatePath: string): boolean {
  return currentPath === candidatePath || currentPath.startsWith(`${candidatePath}/`)
}

function getActivePageTitle(
  currentPath: string,
  russianTitle?: string | null,
): string | null {
  const pages = Endge.domain
    .getPages()
    .filter(page => typeof page.routePath === 'string' && page.routePath.trim().length > 0)
    .sort((a, b) => (b.routePath?.length ?? 0) - (a.routePath?.length ?? 0))

  const activePage = pages.find((page) => {
    const routePath = page.routePath?.trim()
    return routePath ? isRoutePathMatch(currentPath, routePath) : false
  })

  if (!activePage) { return null }

  const identity = activePage.identity?.trim()
  const localizedName = russianTitle?.trim() || activePage.name?.trim()

  if (identity && localizedName && identity !== localizedName) { return `${identity} / ${localizedName}` }
  return localizedName || identity || null
}

/**
 * Заголовок секции меню по текущему маршруту (для кнопки в хедере).
 */
export function useCurrentSectionTitle() {
  const navigation = useNavigation()
  const route = useRoute()
  return computed(() => {
    for (const group of navigation.value) {
      for (const item of group.items) {
        if (isItemGroup(item)) {
          if (isGroupActiveByRoute(item, route)) {
            const activeLink = item.links.find(link => isLinkActive(link, route))
            const activeTitle = activeLink?.title || item.title
            return getActivePageTitle(route.path, activeTitle) || activeTitle
          }
        }
        else {
          if (isLinkActive(item, route)) {
            const activeTitle = item.title || group.title || DEFAULT_SECTION_TITLE
            return getActivePageTitle(route.path, activeTitle) || activeTitle
          }
        }
      }
    }

    const pageTitle = getActivePageTitle(route.path)
    if (pageTitle) { return pageTitle }

    const metaTitle = typeof route.meta?.title === 'string' ? route.meta.title.trim() : ''
    if (metaTitle) { return metaTitle }

    if (typeof route.name === 'string' && route.name.trim().length) { return route.name }

    return DEFAULT_SECTION_TITLE
  })
}

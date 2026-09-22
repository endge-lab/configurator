import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import {
  ArrowLeftRight,
  CircleHelp,
  CircleX,
  FileText,
  Gitlab,
  Info,
  LayoutPanelTop,
  PieChart,
  Table,
  Timer,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { i18n } from '@/i18n'

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
  route: RouteLocationRaw
  links: Omit<NavItemLink, 'icon'>[]
}

export interface NavItemLink {
  type: 'link'
  title: string
  icon?: Component
  hidden?: boolean
  link: string | RouteLocationRaw
  external?: boolean
}

export type NavItem = NavItemGroup | NavItemLink

export function isItemLink(item: NavItem): item is NavItemLink {
  return item.type === 'link'
}

export function isItemGroup(item: NavItem): item is NavItemGroup {
  return item.type === 'group'
}

const { t } = i18n.global

export const navigation = computed<NavGroup[]>(() => ([
  {
    items: [
      {
        type: 'link',
        title: t('nav.main.home'),
        icon: PieChart,
        link: '/',
      },
    ],
  },
  {
    title: t('nav.main.deleteMe.demo.title'),
    items: [
      {
        type: 'group',
        title: t('nav.main.deleteMe.demo.formatters.title'),
        icon: Timer,
        route: { name: 'formatters' },
        links: [
          {
            type: 'link',
            title: t('nav.main.deleteMe.demo.formatters.duration'),
            link: '/deleteme/demo/formatters/duration',
          },
          {
            type: 'link',
            title: t('nav.main.deleteMe.demo.formatters.relativeTime'),
            link: '/deleteme/demo/formatters/relative-time',
          },
        ],
      },
      {
        type: 'link',
        title: t('nav.main.deleteMe.demo.toast'),
        icon: Info,
        link: '/deleteme/demo/toast',
      },
      {
        type: 'link',
        title: t('nav.main.deleteMe.demo.errors'),
        icon: CircleX,
        link: '/deleteme/demo/errors',
      },
      {
        type: 'group',
        title: t('nav.main.deleteMe.demo.layouts.title'),
        icon: LayoutPanelTop,
        route: { name: 'layouts' },
        links: [
          {
            type: 'link',
            title: t('nav.main.deleteMe.demo.layouts.main'),
            link: '/deleteme/demo/layouts/main',
          },
          {
            type: 'link',
            title: t('nav.main.deleteMe.demo.layouts.header'),
            link: '/deleteme/demo/layouts/header',
          },
          {
            type: 'link',
            title: t('nav.main.deleteMe.demo.layouts.grid'),
            link: '/deleteme/demo/layouts/grid',
          },
        ],
      },
      {
        type: 'link',
        title: t('nav.main.deleteMe.demo.questions'),
        icon: CircleHelp,
        link: '/deleteme/demo/questions',
      },
      {
        type: 'link',
        title: t('nav.main.deleteMe.demo.appSwitcher'),
        icon: ArrowLeftRight,
        link: '/deleteme/demo/app-switcher',
      },
      {
        type: 'group',
        title: t('nav.main.deleteMe.demo.dataTable.title'),
        icon: Table,
        route: { name: 'demo' },
        links: [
          {
            type: 'link',
            title: t('nav.main.deleteMe.demo.dataTable.tanstackTable'),
            link: 'https://tanstack.com/table/latest',
            external: true,
          },
        ],
      },
    ],
  },
  {
    items: [
      {
        type: 'link',
        title: t('nav.main.deleteMe.gitlab'),
        icon: Gitlab,
        link: 'https://github.com/endge-lab/configurator',
        external: true,
      },
    ],
  },
  {
    title: t('nav.main.deleteMe.docs.title'),
    items: [
      {
        type: 'link',
        title: t('nav.main.deleteMe.docs.shadcnVue'),
        icon: FileText,
        link: 'https://www.shadcn-vue.com/',
        external: true,
      },
      {
        type: 'link',
        title: t('nav.main.deleteMe.docs.tailwind'),
        icon: FileText,
        link: 'https://tailwindcss.com/',
        external: true,
      },
      {
        type: 'link',
        title: t('nav.main.deleteMe.docs.lucide'),
        icon: FileText,
        link: 'https://lucide.dev/',
        external: true,
      },
    ],
  },
]))

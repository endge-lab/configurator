import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/loader',
    name: 'loader-preview',
    component: () => import('@/features/loader-preview/ui/LoaderPreview_Page.vue'),
    props: { background: 'perspective' },
    meta: { layout: 'empty', standalone: true, title: 'Loader' },
  },
  {
    path: '/loader2',
    name: 'loader-preview-dot-grid',
    component: () => import('@/features/loader-preview/ui/LoaderPreview_Page.vue'),
    props: { background: 'dot-grid' },
    meta: { layout: 'empty', standalone: true, title: 'Loader 2' },
  },
  {
    path: '/debugger',
    name: 'debugger',
    component: () => import('@/features/remote-debugger/ui/Debugger_Page.vue'),
    meta: { layout: 'empty', layoutScope: 'debugger', title: 'Debugger' },
  },
  {
    path: '/auth/oidc/popup-callback',
    name: 'oidc-popup-callback',
    component: () => import('@/features/endge-ide/ui/pages/OidcPopupCallback_Page.vue'),
    meta: { layout: 'empty' },
  },
  {
    path: '/',
    name: 'configurator',
    component: () => import('@/features/endge-ide/ui/EndgeAdminApp.vue'),
    meta: {
      layout: 'grid',
      layoutScope: 'endge-ide',
    },
  },
  {
    path: '/test',
    name: 'test',
    component: () => import('@/features/endge-ide/ui/pages/Test.vue'),
    meta: {
      layout: 'empty',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: {
      path: '/',
    },
  },
]

import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
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
    path: '/preview/:entityType/:identity',
    name: 'endge-preview',
    component: () => import('@/features/endge-preview/ui/EndgePreviewApp.vue'),
    meta: {
      layout: 'grid',
      layoutScope: 'endge-preview',
    },
  },
  {
    path: '/test',
    name: 'test',
    component: () => import('@/pages/Test.vue'),
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

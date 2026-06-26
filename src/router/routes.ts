import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'configurator',
    component: () => import('@/features/endge-admin/ui/EndgeAdminApp.vue'),
    meta: {
      layout: 'grid',
    },
  },
  {
    path: '/admin',
    redirect: to => ({
      path: '/',
      query: to.query,
      hash: to.hash,
    }),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: {
      path: '/',
    },
  },
]

import { createRouter, createWebHistory } from 'vue-router'

import { AppCore } from '@/features/@app/model/app/app-core.ts'
import { routes } from '@/router/routes.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async () => {
  await AppCore.init()

  return true
})

router.onError((error) => {
  console.error('[Router] Navigation error:', error)
})

export default router

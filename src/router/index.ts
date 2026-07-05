import { createRouter, createWebHistory } from 'vue-router'

import { EndgeConfigurator } from '@/features/endge-configurator/model/endge-configurator.ts'
import { routes } from '@/router/routes.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async () => {
  await EndgeConfigurator.init()

  return true
})

router.onError((error) => {
  console.error('[Router] Navigation error:', error)
})

export default router

import { createRouter, createWebHistory } from 'vue-router'

import { Configurator } from '@/app'
import { routes } from '@/router/routes.ts'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Initial navigation является boot-барьером: все маршруты получают уже
// авторизованный Configurator с загруженным и скомпилированным Endge domain.
router.beforeEach(async () => {
  const status = await Configurator.init()
  return status === 'ready'
})

router.onError((error) => {
  console.error('[Router] Navigation error:', error)
})

export default router

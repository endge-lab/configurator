import { defineIntegration } from '@endge/integration-api'

import HelloWorldWidget from './HelloWorldWidget.vue'

export default defineIntegration({
  manifest: {
    identity: 'test-hello-world',
    name: 'Тестовая интеграция Hello World',
    version: '0.1.0-dev',
    apiVersion: '1',
    description: 'Минимальная локальная интеграция для проверки слотов Configurator.',
    permissions: ['configurator:extend'],
  },

  configurator({ configurator }) {
    configurator.widgets.register({
      id: 'hello-world',
      title: 'Тестовый виджет',
      icon: 'MessageCircle',
      placement: 'sidebar',
      visual: HelloWorldWidget,
    })

    configurator.menu.add({
      id: 'hello-world-menu',
      title: 'Тестовая интеграция',
      icon: 'Sparkles',
      order: 100,
      action: () => {
        console.info('[test-hello-world] Hello World, я тестовый пункт меню')
      },
    })
  },
})

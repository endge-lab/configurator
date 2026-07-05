<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { Header } from '@/components/layouts/main'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSidebar } from '@/components/ui/sidebar'
import { useLayout } from '@/lib/layout.ts'

const { t } = useI18n()
const { state } = useSidebar()

useLayout({
  title: computed(() => t('nav.main.deleteMe.demo.header')),
  breadcrumbs: computed(() => [
    { title: t('nav.main.deleteMe.demo.title') },
    { title: t('nav.main.deleteMe.demo.header') },
  ]),
})
</script>

<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <Header>
    <div class="grow" />
    <Button :size="state === 'collapsed' ? 'sm' : 'default'">
      {{ state === 'collapsed' ? 'Small' : 'Default' }}
    </Button>
  </Header>

  <div class="space-y-8">
    <!-- Breadcrumbs Section -->
    <div class="space-y-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Header Demo
        </h2>
        <p class="text-muted-foreground">
          This page demonstrates the page header component, including breadcrumbs and custom header content.
        </p>
      </div>

      <Separator />

      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold mb-2">
            Current Breadcrumbs
          </h3>
          <p class="text-sm text-muted-foreground">
            The breadcrumbs above show: <strong>{{ t('nav.main.deleteMe.demo.title') }}</strong> - <strong>{{ t('nav.main.deleteMe.demo.header') }}</strong>
          </p>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-2">
            How Breadcrumbs Work
          </h3>
          <ul class="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Breadcrumbs are defined in the <code class="bg-muted px-1 py-0.5 rounded">useLayout()</code> composable</li>
            <li>Each breadcrumb can have a <code class="bg-muted px-1 py-0.5 rounded">title</code> and optional <code class="bg-muted px-1 py-0.5 rounded">href</code></li>
            <li>The last breadcrumb is automatically styled as the current page</li>
            <li>Long breadcrumb lists are collapsed with an ellipsis menu</li>
            <li>Breadcrumbs support i18n for multilingual applications</li>
          </ul>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-2">
            Implementation
          </h3>
          <pre class="bg-muted p-4 rounded-lg text-xs overflow-x-auto"><code>useLayout({
  title: computed(() => t('nav.main.deleteMe.demo.header')),
  breadcrumbs: computed(() => [
    { title: t('nav.main.deleteMe.demo.title') },
    { title: t('nav.main.deleteMe.demo.header') },
  ]),
})</code></pre>
        </div>
      </div>
    </div>

    <!-- Sidebar State Section -->
    <div class="space-y-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Sidebar State Demo
        </h2>
        <p class="text-muted-foreground">
          Demonstrating responsive components based on sidebar state.
        </p>
      </div>

      <Separator />

      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-semibold mb-2">
            Current Sidebar State
          </h3>
          <p class="text-sm text-muted-foreground mb-4">
            Sidebar is currently: <strong class="text-foreground">{{ state }}</strong>
          </p>
          <div class="flex items-center gap-2">
            <div
              class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              :class="state === 'expanded' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'"
            >
              Expanded
            </div>
            <div
              class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              :class="state === 'collapsed' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'"
            >
              Collapsed
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-2">
            Responsive Button Example
          </h3>
          <p class="text-sm text-muted-foreground mb-4">
            Look at the button in the page header (top right). It changes size based on the sidebar state. Try toggling the sidebar to see it shrink from default to small size!
          </p>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-2">
            Implementation
          </h3>
          <pre class="bg-muted p-4 rounded-lg text-xs overflow-x-auto"><code>import { Header } from '@/components/layouts/main'
import { useSidebar } from '@/components/ui/sidebar'

const { state } = useSidebar()

&lt;Header&gt;
  &lt;div class="grow" /&gt;
  &lt;Button :size="state === 'collapsed' ? 'sm' : 'default'"&gt;
    {{ state === 'collapsed' ? 'Small' : 'Default' }}
  &lt;/Button&gt;
&lt;/Header&gt;</code></pre>
          <p class="text-sm text-muted-foreground mt-2">
            The Header component uses Teleport to render its contents in the page header area.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

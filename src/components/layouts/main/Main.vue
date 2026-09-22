<script setup lang="ts">
import Logo from '@/components/layouts/main/Logo.vue'
import { useCurrentSectionTitle } from '@/components/layouts/main/navigation'
import Navigation from '@/components/layouts/main/Navigation.vue'
import NavUser from '@/components/layouts/main/NavUser.vue'
import TimeButton from '@/components/layouts/main/TimeButton.vue'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

const sectionTitle = useCurrentSectionTitle()

const data = {
  user: {
    name: 'Презентация',
    username: 'presentation',
    avatar: '/avatars/shadcn.jpg',
  },
}
</script>

<template>
  <SidebarProvider>
    <Navigation />
    <SidebarInset class="h-screen overflow-hidden flex flex-col">
      <div class="shrink-0">
        <slot name="header-banner" />
      </div>

      <header
        class="sticky top-0 z-10 w-full backdrop-blur-xl
         transition-[width,height] ease-linear
         group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-auto"
      >
        <div class="flex flex-col gap-2 px-4 py-2 w-full">
          <div class="flex items-center justify-center gap-2 w-full">
            <Logo />

            <div class="flex items-center gap-1 bg-primary text-white text-sm rounded-xl p-2 px-3 text-nowrap mx-3 leading-tight">
              <SidebarTrigger>
                {{ sectionTitle.toLocaleUpperCase() }}
              </SidebarTrigger>
            </div>

            <div class="flex items-center gap-2">
              <slot name="header-left" />
            </div>

            <div class="flex-1 min-w-0" />

            <div class="contents">
              <slot name="header-right" />
            </div>

            <div class="pr-2">
              <TimeButton />
            </div>

            <div class="w-16">
              <NavUser :user="data.user" />
            </div>
          </div>

          <div class="flex items-center justify-center gap-2 w-full pt-2">
            <div class="flex items-center gap-2 min-h-0">
              <slot name="header-toolbar-left" />
            </div>

            <div class="flex-1 min-w-0" />

            <div class="flex items-center gap-2">
              <slot name="header-toolbar-right" />
            </div>
          </div>
        </div>
      </header>

      <div class="flex-1 min-h-0 min-w-0 overflow-auto">
        <div class="h-full w-full px-4 pt-2">
          <slot name="default" />
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

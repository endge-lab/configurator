<script setup lang="ts">
import { useUI } from '@endge/vue'
import {
  Languages,
  SunMoon,
  UserRound,
} from 'lucide-vue-next'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import Zoom_Button from '@/features/endge-configurator/ui/common/buttons/Zoom_Button.vue'
import { availableLocales } from '@/i18n'
import { useSafeLocalStorage } from '@/lib/use-safe-local-storage'

const props = defineProps<{
  user?: {
    name: string
    username: string
    avatar?: string
  }
}>()

const { isMobile } = useSidebar()
const { t } = useI18n()
const ui = useUI()

const dateFormat = useSafeLocalStorage<'human' | 'robot'>('app:date-format', 'human')
watch(dateFormat, () => {
  toast.info(t('nav.user.dateFormat.changed'))
})
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="default"
            class="
            h-12 w-12
            rounded-full
            bg-sky-100
            flex items-center justify-center
            transition-none
            hover:bg-sky-100
             active:bg-sky-100
             cursor-pointer
            data-[state=open]:bg-sky-100
            focus-visible:ring-0
            focus-visible:ring-offset-0
          "
          >
            <UserRound
              class="h-9 w-9 text-sky-600"
              stroke-width="1.8"
            />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          class="min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="6"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-2 py-2 text-sm">
              <UserRound class="h-8 w-8 text-muted-foreground" />
              <span class="font-medium">
                {{ user?.name ?? 'Конфигуратор' }}
              </span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <Zoom_Button />

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages class="h-4 w-4 mr-2 text-muted-foreground" />
                {{ t('nav.user.locale') }}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuCheckboxItem
                    v-for="locale in availableLocales"
                    :key="locale.value"
                    :model-value="locale.value === $i18n.locale"
                    @click="$i18n.locale = locale.value"
                  >
                    {{ locale.label }}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SunMoon class="h-4 w-4 mr-2 text-muted-foreground" />
                {{ t('nav.user.theme.title') }}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuCheckboxItem
                    :model-value="ui.theme === 'light'"
                    @click="ui.setTheme('light')"
                  >
                    {{ t('nav.user.theme.light') }}
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    :model-value="ui.theme === 'light_calm'"
                    @click="ui.setTheme('light_calm')"
                  >
                    {{ t('nav.user.theme.lightCalm') }}
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuCheckboxItem
                    :model-value="ui.theme === 'dark'"
                    @click="ui.setTheme('dark')"
                  >
                    {{ t('nav.user.theme.dark') }}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>

        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

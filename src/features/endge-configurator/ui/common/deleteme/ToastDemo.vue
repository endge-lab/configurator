<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLayout } from '@/lib/layout.ts'

const { t } = useI18n()

useLayout({
  title: computed(() => t('nav.main.deleteMe.demo.toast')),
  breadcrumbs: computed(() => [
    { title: t('nav.main.deleteMe.demo.title') },
    { title: t('nav.main.deleteMe.demo.toast') },
  ]),
})

// Custom toast options
const customMessage = ref('This is a custom toast message')
const customDescription = ref('You can customize the message and description')
const toastDuration = ref('4000')
const toastPosition = ref<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>('bottom-right')

// Promise example
function promiseToast() {
  const promise = () => new Promise((resolve, reject) => {
    setTimeout(() => {
      Math.random() > 0.5 ? resolve({ name: 'Sonner' }) : reject(new Error('Failed to load'))
    }, 2000)
  })

  toast.promise(promise(), {
    loading: 'Loading...',
    success: (data: any) => `${data.name} has been loaded`,
    error: 'Error loading data',
  })
}

// Action toast
function actionToast() {
  toast('Event has been created', {
    action: {
      label: 'Undo',
      onClick: () => toast.info('Undo clicked'),
    },
  })
}

// Custom JSX toast
function customJsxToast() {
  toast('Custom styled toast', {
    description: 'This toast has custom styling',
    duration: 5000,
    cancel: {
      label: 'Cancel',
      onClick: () => toast.info('Cancelled'),
    },
    action: {
      label: 'Confirm',
      onClick: () => toast.success('Confirmed!'),
    },
  })
}

// Show custom toast
function showCustomToast() {
  toast(customMessage.value, {
    description: customDescription.value,
    duration: Number.parseInt(toastDuration.value),
    position: toastPosition.value,
  })
}

// Loading toast with dismiss option
function loadingToastWithDismiss() {
  const toastId = toast.loading('Loading data...', {
    duration: Number.POSITIVE_INFINITY, // Don't auto-dismiss
    cancel: {
      label: 'Dismiss',
      onClick: () => toast.dismiss(toastId),
    },
  })
}
</script>

<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold mb-2">
        Toast Demo
      </h1>
      <p class="text-muted-foreground">
        Demonstrates the Sonner toast notifications from shadcn-ui
      </p>
    </div>

    <!-- Basic Toasts -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Basic Toast Types
      </h2>
      <p class="text-sm text-muted-foreground">
        Different types of toast notifications for various use cases
      </p>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <!-- Default -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Default
            </h3>
            <p class="text-sm text-muted-foreground">
              Basic notification message
            </p>
          </div>
          <Button
            class="w-full"
            @click="toast('Event has been created')"
          >
            Show Default
          </Button>
        </div>

        <!-- Success -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Success
            </h3>
            <p class="text-sm text-muted-foreground">
              Positive action confirmation
            </p>
          </div>
          <Button
            class="w-full"
            variant="default"
            @click="toast.success('Operation completed successfully')"
          >
            Show Success
          </Button>
        </div>

        <!-- Error -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Error
            </h3>
            <p class="text-sm text-muted-foreground">
              Error or failure notification
            </p>
          </div>
          <Button
            class="w-full"
            variant="destructive"
            @click="toast.error('Something went wrong')"
          >
            Show Error
          </Button>
        </div>

        <!-- Warning -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Warning
            </h3>
            <p class="text-sm text-muted-foreground">
              Warning or caution message
            </p>
          </div>
          <Button
            class="w-full"
            variant="outline"
            @click="toast.warning('Please review your changes')"
          >
            Show Warning
          </Button>
        </div>

        <!-- Info -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Info
            </h3>
            <p class="text-sm text-muted-foreground">
              Informational message
            </p>
          </div>
          <Button
            class="w-full"
            variant="outline"
            @click="toast.info('New update available')"
          >
            Show Info
          </Button>
        </div>

        <!-- Loading -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Loading
            </h3>
            <p class="text-sm text-muted-foreground">
              Loading state with dismiss button
            </p>
          </div>
          <Button
            class="w-full"
            variant="outline"
            @click="loadingToastWithDismiss"
          >
            Show Loading
          </Button>
        </div>
      </div>
    </section>

    <!-- Advanced Features -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Advanced Features
      </h2>
      <p class="text-sm text-muted-foreground">
        More complex toast notifications with actions and promises
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- With Description -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              With Description
            </h3>
            <p class="text-sm text-muted-foreground">
              Toast with additional description text
            </p>
          </div>
          <Button
            class="w-full"
            @click="toast('Event has been created', { description: 'Monday, January 3rd at 6:00pm' })"
          >
            Show Toast
          </Button>
        </div>

        <!-- With Action -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              With Action
            </h3>
            <p class="text-sm text-muted-foreground">
              Toast with an action button
            </p>
          </div>
          <Button
            class="w-full"
            @click="actionToast"
          >
            Show Toast
          </Button>
        </div>

        <!-- Promise -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Promise
            </h3>
            <p class="text-sm text-muted-foreground">
              Toast that updates based on promise state
            </p>
          </div>
          <Button
            class="w-full"
            @click="promiseToast"
          >
            Show Promise Toast
          </Button>
        </div>

        <!-- Custom with Actions -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Custom Actions
            </h3>
            <p class="text-sm text-muted-foreground">
              Toast with cancel and confirm actions
            </p>
          </div>
          <Button
            class="w-full"
            @click="customJsxToast"
          >
            Show Toast
          </Button>
        </div>
      </div>
    </section>

    <!-- Custom Toast Builder -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Custom Toast Builder
      </h2>
      <p class="text-sm text-muted-foreground">
        Build your own custom toast with different options
      </p>

      <div class="rounded-lg border p-6 space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="message">Message</Label>
            <Input
              id="message"
              v-model="customMessage"
              placeholder="Enter toast message"
            />
          </div>

          <div class="space-y-2">
            <Label for="description">Description</Label>
            <Input
              id="description"
              v-model="customDescription"
              placeholder="Enter description (optional)"
            />
          </div>

          <div class="space-y-2">
            <Label for="duration">Duration (ms)</Label>
            <Select v-model="toastDuration">
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2000">
                  2 seconds
                </SelectItem>
                <SelectItem value="4000">
                  4 seconds
                </SelectItem>
                <SelectItem value="6000">
                  6 seconds
                </SelectItem>
                <SelectItem value="10000">
                  10 seconds
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="position">Position</Label>
            <Select v-model="toastPosition">
              <SelectTrigger id="position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">
                  Top Left
                </SelectItem>
                <SelectItem value="top-center">
                  Top Center
                </SelectItem>
                <SelectItem value="top-right">
                  Top Right
                </SelectItem>
                <SelectItem value="bottom-left">
                  Bottom Left
                </SelectItem>
                <SelectItem value="bottom-center">
                  Bottom Center
                </SelectItem>
                <SelectItem value="bottom-right">
                  Bottom Right
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button class="w-full" @click="showCustomToast">
          Show Custom Toast
        </Button>
      </div>
    </section>

    <!-- Code Examples -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Usage Examples
      </h2>
      <div class="space-y-3">
        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Basic Usage
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { toast } from 'vue-sonner'

// Basic toast
toast('Event has been created')

// With description
toast('Event has been created', {
  description: 'Monday, January 3rd at 6:00pm'
})

// Different types
toast.success('Success message')
toast.error('Error message')
toast.warning('Warning message')
toast.info('Info message')
toast.loading('Loading...')</code></pre>
        </div>

        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            With Actions
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>toast('Event has been created', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo')
  }
})

// With cancel and confirm
toast('Are you sure?', {
  cancel: {
    label: 'Cancel',
    onClick: () => console.log('Cancelled')
  },
  action: {
    label: 'Confirm',
    onClick: () => console.log('Confirmed')
  }
})</code></pre>
        </div>

        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Promise Toast
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>const promise = () => fetch('/api/data')

toast.promise(promise(), {
  loading: 'Loading...',
  success: (data) => 'Data loaded successfully',
  error: 'Error loading data'
})</code></pre>
        </div>
      </div>
    </section>
  </div>
</template>

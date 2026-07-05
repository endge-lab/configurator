<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import { useLayout } from '@/lib/layout.ts'

const { t } = useI18n()
const router = useRouter()

useLayout({
  title: computed(() => t('nav.main.deleteMe.demo.errors')),
  breadcrumbs: computed(() => [
    { title: t('nav.main.deleteMe.demo.title') },
    { title: t('nav.main.deleteMe.demo.errors') },
  ]),
})

const counter = ref(0)

function navigate404() {
  router.push('/this-page-does-not-exist-404')
}

function throwTypeError() {
  const obj: any = null
  obj.property.nested.value = 'test'
}

function throwReferenceError() {
  // @ts-expect-error - intentional error for demo
  undefinedFunction()
}

function throwRangeError() {
  const arr: number[] = []
  arr.length = -1
}

function throwCustomError() {
  throw new Error('This is a custom error thrown for demonstration purposes')
}

function throwAsyncError() {
  setTimeout(() => {
    throw new Error('Async error after 100ms')
  }, 100)
}

function throwInPromise() {
  Promise.reject(new Error('Promise rejection error'))
}

function causeInfiniteLoop() {
  // This will cause a stack overflow
  function recursive(): any {
    return recursive()
  }
  recursive()
}

function throwDuringRender() {
  counter.value++
  if (counter.value > 0) {
    throw new Error('Error thrown during component render')
  }
}
</script>

<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold mb-2">
        Errors Demo
      </h1>
      <p class="text-muted-foreground">
        Test error handling by triggering various types of errors
      </p>
    </div>

    <!-- Error Types -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Error Types
      </h2>
      <p class="text-sm text-muted-foreground">
        Click any button to trigger an error. The error boundary should catch it and display the error page.
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- 404 Error -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              404 Not Found
            </h3>
            <p class="text-sm text-muted-foreground">
              Navigate to a non-existent page
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="navigate404"
          >
            Go to 404 Page
          </Button>
        </div>

        <!-- TypeError -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              TypeError
            </h3>
            <p class="text-sm text-muted-foreground">
              Attempting to access properties on null/undefined
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="throwTypeError"
          >
            Throw TypeError
          </Button>
        </div>

        <!-- ReferenceError -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              ReferenceError
            </h3>
            <p class="text-sm text-muted-foreground">
              Calling an undefined function
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="throwReferenceError"
          >
            Throw ReferenceError
          </Button>
        </div>

        <!-- RangeError -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              RangeError
            </h3>
            <p class="text-sm text-muted-foreground">
              Setting array length to negative value
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="throwRangeError"
          >
            Throw RangeError
          </Button>
        </div>

        <!-- Custom Error -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Custom Error
            </h3>
            <p class="text-sm text-muted-foreground">
              Throwing a custom error message
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="throwCustomError"
          >
            Throw Custom Error
          </Button>
        </div>

        <!-- Async Error -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Async Error (setTimeout)
            </h3>
            <p class="text-sm text-muted-foreground">
              Error thrown after 100ms timeout
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="throwAsyncError"
          >
            Throw Async Error
          </Button>
        </div>

        <!-- Promise Rejection -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Promise Rejection
            </h3>
            <p class="text-sm text-muted-foreground">
              Unhandled promise rejection
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="throwInPromise"
          >
            Throw Promise Error
          </Button>
        </div>

        <!-- Stack Overflow -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Stack Overflow
            </h3>
            <p class="text-sm text-muted-foreground">
              Infinite recursion causing stack overflow
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="causeInfiniteLoop"
          >
            Cause Stack Overflow
          </Button>
        </div>

        <!-- Render Error -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Render Error
            </h3>
            <p class="text-sm text-muted-foreground">
              Error thrown during component render
            </p>
          </div>
          <Button
            variant="destructive"
            class="w-full"
            @click="throwDuringRender"
          >
            Throw Render Error
          </Button>
        </div>
      </div>
    </section>

    <!-- Instructions -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        How to Test
      </h2>
      <div class="rounded-lg border p-6 space-y-3">
        <ol class="list-decimal list-inside space-y-2 text-sm">
          <li>Click any button above to trigger an error</li>
          <li>The error boundary should catch the error and display the error page</li>
          <li>Navigate to another page to clear the error</li>
          <li>Return to this page to test another error type</li>
        </ol>
        <div class="mt-4 p-3 bg-muted rounded text-sm">
          <strong>Note:</strong> Some errors (like async errors and promise rejections) may not be caught by the Vue error boundary
          and will appear in the browser console instead.
        </div>
      </div>
    </section>

    <!-- Code Example -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Error Boundary Implementation
      </h2>
      <div class="rounded-lg border p-4">
        <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>// In App.vue
const error = ref&lt;Error | null&gt;(null)

// Clear error on route change
watch(() => route.fullPath, () => {
  error.value = null
})

// Capture errors from child components
onErrorCaptured((err, instance, info) => {
  console.error('Error captured:', err)
  error.value = err
  return false // Prevent error propagation
})

// In template
&lt;ErrorView v-if="error" /&gt;
&lt;RouterView v-else /&gt;</code></pre>
      </div>
    </section>
  </div>
</template>

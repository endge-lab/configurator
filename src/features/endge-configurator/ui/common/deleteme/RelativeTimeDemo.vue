<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLayout } from '@/lib/layout.ts'
import { getRelativeTime, RelativeTime, useRelativeTime } from '@/lib/relative-time.ts'

const { t } = useI18n()

useLayout({
  title: computed(() => t('nav.main.deleteMe.demo.formatters.relativeTime')),
  breadcrumbs: computed(() => [
    { title: t('nav.main.deleteMe.demo.title') },
    { title: t('nav.main.deleteMe.demo.formatters.title') },
    { title: t('nav.main.deleteMe.demo.formatters.relativeTime') },
  ]),
})

// Example 1: Static dates
const now = new Date()
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
const lastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

const inFiveMinutes = new Date(now.getTime() + 5 * 60 * 1000)
const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

// Example 2: Live updating time
const dynamicDate = ref(new Date(now.getTime() - 30 * 1000)) // 30 seconds ago
const liveRelativeTime = useRelativeTime(dynamicDate)

// Example 3: Custom date input
const customDateInput = ref(fiveMinutesAgo.toISOString())
const customRelativeTime = useRelativeTime(customDateInput)

// Example 4: Switch to absolute threshold
const thresholdDate = ref(lastMonth)
const selectedThreshold = ref<string>('week')
const thresholdRelativeTime = useRelativeTime(thresholdDate, {
  switchToAbsolute: selectedThreshold.value as any,
})

const thresholdOptions = [
  { value: 'day', label: '1 day' },
  { value: 'three-days', label: '3 days' },
  { value: 'week', label: '1 week' },
  { value: 'two-weeks', label: '2 weeks' },
  { value: 'month', label: '1 month' },
  { value: 'three-months', label: '3 months' },
  { value: 'half-year', label: '6 months' },
  { value: 'year', label: '1 year' },
]

function updateThreshold(value: string | number | boolean | bigint | Record<string, any> | null) {
  if (!value || typeof value !== 'string')
    return
  selectedThreshold.value = value
  thresholdRelativeTime.value = getRelativeTime(thresholdDate.value, {
    switchToAbsolute: value as any,
  })
}

function setCustomDate() {
  try {
    const date = new Date(customDateInput.value)
    if (!Number.isNaN(date.getTime())) {
      customDateInput.value = date.toISOString()
    }
  }
  catch (e) {
    console.error('Invalid date', e)
  }
}
</script>

<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold mb-2">
        Relative Time Demo
      </h1>
      <p class="text-muted-foreground">
        Demonstrates the relativeTime utility, useRelativeTime composable, and RelativeTime component
      </p>
    </div>

    <!-- Example 1: Static dates -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        1. Static Dates
      </h2>
      <p class="text-sm text-muted-foreground">
        Using the <code class="bg-muted px-1 py-0.5 rounded">getRelativeTime()</code> function with various dates
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border p-4">
          <div class="font-medium mb-2">
            Past Dates
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">5 minutes ago:</span>
              <span class="font-mono">{{ getRelativeTime(fiveMinutesAgo) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">1 hour ago:</span>
              <span class="font-mono">{{ getRelativeTime(oneHourAgo) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Yesterday:</span>
              <span class="font-mono">{{ getRelativeTime(yesterday) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last week:</span>
              <span class="font-mono">{{ getRelativeTime(lastWeek) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last month:</span>
              <span class="font-mono">{{ getRelativeTime(lastMonth) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last year:</span>
              <span class="font-mono">{{ getRelativeTime(lastYear) }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-lg border p-4">
          <div class="font-medium mb-2">
            Future Dates
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">In 5 minutes:</span>
              <span class="font-mono">{{ getRelativeTime(inFiveMinutes) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">In 1 hour:</span>
              <span class="font-mono">{{ getRelativeTime(inOneHour) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Tomorrow:</span>
              <span class="font-mono">{{ getRelativeTime(tomorrow) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Next week:</span>
              <span class="font-mono">{{ getRelativeTime(nextWeek) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Example 2: Live updating -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        2. Live Updating Time
      </h2>
      <p class="text-sm text-muted-foreground">
        Using <code class="bg-muted px-1 py-0.5 rounded">useRelativeTime()</code> composable - updates automatically
      </p>
      <div class="rounded-lg border p-6">
        <div class="text-center space-y-4">
          <div class="text-4xl font-mono">
            {{ liveRelativeTime }}
          </div>
          <div class="text-sm text-muted-foreground">
            Started at: {{ dynamicDate.toLocaleTimeString() }}
          </div>
          <Button @click="dynamicDate = new Date()">
            Reset to Now
          </Button>
        </div>
      </div>
    </section>

    <!-- Example 3: Custom date input -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        3. Custom Date Input
      </h2>
      <p class="text-sm text-muted-foreground">
        Enter any date/time to see its relative representation
      </p>
      <div class="rounded-lg border p-6 space-y-4">
        <div class="flex gap-2">
          <Input
            v-model="customDateInput"
            type="datetime-local"
            class="flex-1"
            @change="setCustomDate"
          />
          <Button @click="customDateInput = new Date().toISOString()">
            Now
          </Button>
        </div>
        <div class="text-center">
          <div class="text-2xl font-mono">
            {{ customRelativeTime }}
          </div>
        </div>
      </div>
    </section>

    <!-- Example 4: Switch to absolute -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        4. Switch to Absolute Time
      </h2>
      <p class="text-sm text-muted-foreground">
        After a threshold, display absolute time instead of relative
      </p>
      <div class="rounded-lg border p-6 space-y-4">
        <div class="flex gap-4 items-center">
          <span class="text-sm font-medium">Threshold:</span>
          <Select :model-value="selectedThreshold" @update:model-value="updateThreshold">
            <SelectTrigger class="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in thresholdOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg bg-muted p-4">
            <div class="text-sm text-muted-foreground mb-2">
              Without threshold
            </div>
            <div class="text-xl font-mono">
              {{ getRelativeTime(thresholdDate) }}
            </div>
          </div>
          <div class="rounded-lg bg-muted p-4">
            <div class="text-sm text-muted-foreground mb-2">
              With threshold ({{ selectedThreshold }})
            </div>
            <div class="text-xl font-mono">
              {{ thresholdRelativeTime }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Example 5: Component usage -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        5. RelativeTime Component
      </h2>
      <p class="text-sm text-muted-foreground">
        Using the <code class="bg-muted px-1 py-0.5 rounded">&lt;RelativeTime&gt;</code> component
      </p>
      <div class="rounded-lg border p-6">
        <div class="space-y-3 text-sm">
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">5 minutes ago:</span>
            <span class="font-mono"><RelativeTime :date="fiveMinutesAgo" /></span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">Yesterday:</span>
            <span class="font-mono"><RelativeTime :date="yesterday" /></span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">Last month (with threshold):</span>
            <span class="font-mono"><RelativeTime :date="lastMonth" switch-to-absolute="week" /></span>
          </div>
        </div>
      </div>
    </section>

    <!-- Code examples -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Usage Examples
      </h2>
      <div class="space-y-3">
        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Function
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { getRelativeTime } from '@/lib/relative-time'

const time = getRelativeTime(new Date('2024-01-01'))
// Output: "10 months ago"</code></pre>
        </div>

        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Composable
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { useRelativeTime } from '@/lib/relative-time'

const date = ref(new Date())
const time = useRelativeTime(date)
// Auto-updates as time passes</code></pre>
        </div>

        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Component
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>&lt;RelativeTime :date="new Date()" /&gt;
&lt;RelativeTime :date="someDate" switch-to-absolute="week" /&gt;</code></pre>
        </div>
      </div>
    </section>
  </div>
</template>

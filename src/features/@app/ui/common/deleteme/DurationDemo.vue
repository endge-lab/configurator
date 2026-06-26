<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Duration, getDuration, useDuration } from '@/lib/duration.ts'
import { useLayout } from '@/lib/layout.ts'

const { t } = useI18n()

useLayout({
  title: computed(() => t('nav.main.deleteMe.demo.formatters.duration')),
  breadcrumbs: computed(() => [
    { title: t('nav.main.deleteMe.demo.title') },
    { title: t('nav.main.deleteMe.demo.formatters.title') },
    { title: t('nav.main.deleteMe.demo.formatters.duration') },
  ]),
})

// Example 1: ISO8601 duration strings
const iso8601Examples = [
  { input: 'PT1H30M', description: '1 hour 30 minutes' },
  { input: 'P1DT2H30M15S', description: '1 day, 2 hours, 30 minutes, 15 seconds' },
  { input: 'PT45S', description: '45 seconds' },
  { input: 'PT2H', description: '2 hours' },
  { input: 'P7D', description: '7 days' },
  { input: 'P1M', description: '1 month (30 days)' },
  { input: 'P1Y2M3DT4H5M6S', description: '1 year, 2 months, 3 days, 4 hours, 5 minutes, 6 seconds' },
]

// Example 2: Date range durations
const now = new Date()
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
const lastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

// Example 3: Live duration (stopwatch)
const stopwatchStart = ref(new Date())
const liveDuration = useDuration(stopwatchStart)

function resetStopwatch() {
  stopwatchStart.value = new Date()
}

// Example 4: Custom date range
const customStartDate = ref(oneHourAgo.toISOString().slice(0, 16))
const customEndDate = ref(now.toISOString().slice(0, 16))
const customStartComputed = computed(() => new Date(customStartDate.value))
const customEndComputed = computed(() => new Date(customEndDate.value))
const customDuration = useDuration(customStartComputed, customEndComputed)

// Example 5: Custom ISO8601 input
const customISO8601 = ref('PT1H30M')
const customISO8601Result = ref(getDuration(customISO8601.value))

function updateCustomISO8601() {
  try {
    customISO8601Result.value = getDuration(customISO8601.value)
  }
  catch {
    customISO8601Result.value = 'Invalid ISO8601 duration'
  }
}

// Example 6: Negative durations
const futureDate = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours in future
</script>

<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold mb-2">
        Duration Demo
      </h1>
      <p class="text-muted-foreground">
        Demonstrates the getDuration utility, useDuration composable, and Duration component
      </p>
    </div>

    <!-- Example 1: ISO8601 durations -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        1. ISO8601 Duration Strings
      </h2>
      <p class="text-sm text-muted-foreground">
        Using <code class="bg-muted px-1 py-0.5 rounded">getDuration()</code> with ISO8601 duration format
      </p>
      <div class="rounded-lg border p-4">
        <div class="space-y-3 text-sm">
          <div
            v-for="example in iso8601Examples"
            :key="example.input"
            class="flex justify-between items-center py-2 border-b last:border-b-0"
          >
            <div class="flex-1">
              <code class="bg-muted px-2 py-1 rounded text-xs">{{ example.input }}</code>
              <span class="text-muted-foreground ml-2 text-xs">{{ example.description }}</span>
            </div>
            <span class="font-mono font-medium">{{ getDuration(example.input) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Example 2: Date range durations -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        2. Date Range Durations
      </h2>
      <p class="text-sm text-muted-foreground">
        Calculate duration between two dates
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border p-4">
          <div class="font-medium mb-3">
            From Past to Now
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">1 hour ago:</span>
              <span class="font-mono">{{ getDuration(oneHourAgo) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Yesterday:</span>
              <span class="font-mono">{{ getDuration(yesterday) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last week:</span>
              <span class="font-mono">{{ getDuration(lastWeek) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last month:</span>
              <span class="font-mono">{{ getDuration(lastMonth) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last year:</span>
              <span class="font-mono">{{ getDuration(lastYear) }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-lg border p-4">
          <div class="font-medium mb-3">
            Custom Date Ranges
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Yesterday to now:</span>
              <span class="font-mono">{{ getDuration(yesterday, now) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last week to yesterday:</span>
              <span class="font-mono">{{ getDuration(lastWeek, yesterday) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Last month to last week:</span>
              <span class="font-mono">{{ getDuration(lastMonth, lastWeek) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Example 3: Live duration (stopwatch) -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        3. Live Duration (Stopwatch)
      </h2>
      <p class="text-sm text-muted-foreground">
        Using <code class="bg-muted px-1 py-0.5 rounded">useDuration()</code> composable - updates in real-time
      </p>
      <div class="rounded-lg border p-6">
        <div class="text-center space-y-4">
          <div class="text-5xl font-mono font-bold">
            {{ liveDuration }}
          </div>
          <div class="text-sm text-muted-foreground">
            Started at: {{ stopwatchStart.toLocaleTimeString() }}
          </div>
          <div class="flex gap-2 justify-center">
            <Button @click="resetStopwatch">
              Reset
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- Example 4: Custom date range input -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        4. Custom Date Range
      </h2>
      <p class="text-sm text-muted-foreground">
        Calculate duration between any two dates
      </p>
      <div class="rounded-lg border p-6 space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">Start Date</label>
            <Input
              v-model="customStartDate"
              type="datetime-local"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">End Date</label>
            <Input
              v-model="customEndDate"
              type="datetime-local"
            />
          </div>
        </div>
        <div class="text-center pt-4">
          <div class="text-sm text-muted-foreground mb-2">
            Duration
          </div>
          <div class="text-3xl font-mono font-bold">
            {{ customDuration }}
          </div>
        </div>
      </div>
    </section>

    <!-- Example 5: Custom ISO8601 input -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        5. Custom ISO8601 Duration
      </h2>
      <p class="text-sm text-muted-foreground">
        Enter an ISO8601 duration string to see its formatted output
      </p>
      <div class="rounded-lg border p-6 space-y-4">
        <div class="flex gap-2">
          <Input
            v-model="customISO8601"
            placeholder="e.g., PT1H30M or P1DT2H30M15S"
            class="flex-1"
            @input="updateCustomISO8601"
          />
        </div>
        <div class="text-center">
          <div class="text-2xl font-mono">
            {{ customISO8601Result }}
          </div>
        </div>
        <div class="text-xs text-muted-foreground space-y-1">
          <div><strong>Format:</strong> P[n]Y[n]M[n]DT[n]H[n]M[n]S</div>
          <div><strong>Examples:</strong></div>
          <ul class="list-disc list-inside ml-2">
            <li>PT1H30M = 1 hour 30 minutes</li>
            <li>P1DT2H = 1 day 2 hours</li>
            <li>P1Y2M3D = 1 year 2 months 3 days</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Example 6: Negative durations -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        6. Negative Durations
      </h2>
      <p class="text-sm text-muted-foreground">
        When end date is before start date, duration is negative
      </p>
      <div class="rounded-lg border p-4">
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Now to 2 hours ago:</span>
            <span class="font-mono">{{ getDuration(now, oneHourAgo) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Now to 2 hours in future:</span>
            <span class="font-mono">{{ getDuration(now, futureDate) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Future to now (negative):</span>
            <span class="font-mono">{{ getDuration(futureDate, now) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Example 7: Component usage -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        7. Duration Component
      </h2>
      <p class="text-sm text-muted-foreground">
        Using the <code class="bg-muted px-1 py-0.5 rounded">&lt;Duration&gt;</code> component
      </p>
      <div class="rounded-lg border p-6">
        <div class="space-y-3 text-sm">
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">ISO8601 (PT2H30M):</span>
            <span class="font-mono"><Duration duration="PT2H30M" /></span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">From yesterday to now:</span>
            <span class="font-mono"><Duration :start="yesterday" /></span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground">Last week to yesterday:</span>
            <span class="font-mono"><Duration :start="lastWeek" :end="yesterday" /></span>
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
            Function - ISO8601
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { getDuration } from '@/lib/duration'

const duration = getDuration('PT1H30M')
// Output: "1 hour 30 minutes"</code></pre>
        </div>

        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Function - Date Range
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { getDuration } from '@/lib/duration'

const start = new Date('2024-01-01')
const end = new Date('2024-01-02')
const duration = getDuration(start, end)
// Output: "1 day"

// Or from start to now (omit end)
const durationFromStart = getDuration(start)
// Output: duration from start to current time</code></pre>
        </div>

        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Composable
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { useDuration } from '@/lib/duration'

// Live duration from start to now
const start = ref(new Date())
const duration = useDuration(start)
// Auto-updates every second

// Fixed duration between two dates
const duration2 = useDuration(startDate, endDate)</code></pre>
        </div>

        <div class="rounded-lg border p-4">
          <div class="text-sm font-medium mb-2">
            Component
          </div>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>&lt;Duration duration="PT1H30M" /&gt;
&lt;Duration :start="startDate" /&gt;
&lt;Duration :start="startDate" :end="endDate" /&gt;</code></pre>
        </div>
      </div>
    </section>
  </div>
</template>

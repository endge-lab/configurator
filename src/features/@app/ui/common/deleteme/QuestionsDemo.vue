<script setup lang="ts">
import { AlertCircle, CheckCircle, HelpCircle, Info, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useLayout } from '@/lib/layout.ts'
import { useQuestions } from '@/lib/questions.ts'

const { t } = useI18n()
const { ask } = useQuestions()

useLayout({
  title: computed(() => t('nav.main.deleteMe.demo.questions')),
  breadcrumbs: computed(() => [
    { title: t('nav.main.deleteMe.demo.title') },
    { title: t('nav.main.deleteMe.demo.questions') },
  ]),
})

async function showSimpleQuestion() {
  const result = await ask({
    title: 'Confirm Action',
    text: 'Are you sure you want to proceed?',
    answers: [
      { text: 'Yes', variant: 'default', value: true },
      { text: 'No', variant: 'secondary', value: false },
    ],
  })
  toast.success(`You selected: ${result ? 'Yes' : 'No'}`)
}

async function showQuestionWithIcon() {
  const result = await ask({
    title: 'Delete Item',
    text: 'This action cannot be undone. Are you sure?',
    icon: Trash2,
    answers: [
      { text: 'Delete', variant: 'destructive', value: 'delete' },
      { text: 'Cancel', variant: 'outline', value: 'cancel' },
    ],
  })
  toast.info(`You selected: ${result}`)
}

async function showMultipleChoice() {
  const result = await ask({
    title: 'How are you feeling today?',
    text: 'Select one option that best describes your mood',
    icon: HelpCircle,
    answers: [
      { text: 'Great! 😊', variant: 'default', value: 'great' },
      { text: 'Good 🙂', variant: 'secondary', value: 'good' },
      { text: 'Okay 😐', variant: 'outline', value: 'okay' },
      { text: 'Not great 😔', variant: 'ghost', value: 'bad' },
    ],
  })
  toast.success(`You're feeling: ${result}`)
}

async function showClosableQuestion() {
  const result = await ask({
    title: 'Optional Question',
    text: 'You can close this dialog without answering',
    icon: Info,
    closable: true,
    answers: [
      { text: 'Answer A', variant: 'default', value: 'a' },
      { text: 'Answer B', variant: 'secondary', value: 'b' },
    ],
  })
  if (result) {
    toast.success(`You selected: ${result}`)
  }
  else {
    toast.info('You did not answer')
  }
}

async function showSuccessQuestion() {
  await ask({
    title: 'Operation Successful',
    text: 'Your changes have been saved successfully!',
    icon: CheckCircle,
    answers: [
      { text: 'Great!', variant: 'default', value: 'ok' },
    ],
  })
  toast.success('Dialog closed')
}

async function showWarningQuestion() {
  const result = await ask({
    title: 'Warning',
    text: 'This action may have unintended consequences. Do you want to continue?',
    icon: AlertCircle,
    answers: [
      { text: 'Continue', variant: 'destructive', value: true },
      { text: 'Go Back', variant: 'outline', value: false },
    ],
  })
  toast.info(`You chose to ${result ? 'continue' : 'go back'}`)
}

async function showChainedQuestions() {
  const first = await ask({
    title: 'Step 1 of 2',
    text: 'Do you want to continue to the next step?',
    answers: [
      { text: 'Yes, continue', variant: 'default', value: true },
      { text: 'No, cancel', variant: 'secondary', value: false },
    ],
  })

  if (first) {
    const second = await ask({
      title: 'Step 2 of 2',
      text: 'Please confirm your final choice',
      icon: CheckCircle,
      answers: [
        { text: 'Confirm', variant: 'default', value: 'confirmed' },
        { text: 'Cancel', variant: 'outline', value: 'cancelled' },
      ],
    })
    toast.success(`Process ${second}`)
  }
  else {
    toast.info('Process cancelled at step 1')
  }
}
</script>

<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold mb-2">
        Questions Demo
      </h1>
      <p class="text-muted-foreground">
        Interactive dialog system for asking questions and getting user responses
      </p>
    </div>

    <!-- Basic Examples -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Basic Examples
      </h2>
      <p class="text-sm text-muted-foreground">
        Click any button to show a question dialog
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- Simple Question -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Simple Question
            </h3>
            <p class="text-sm text-muted-foreground">
              Basic yes/no question without icon
            </p>
          </div>
          <Button class="w-full" @click="showSimpleQuestion">
            Show Simple Question
          </Button>
        </div>

        <!-- Question with Icon -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Question with Icon
            </h3>
            <p class="text-sm text-muted-foreground">
              Destructive action with warning icon
            </p>
          </div>
          <Button class="w-full" @click="showQuestionWithIcon">
            Show Delete Confirmation
          </Button>
        </div>

        <!-- Multiple Choice -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Multiple Choice
            </h3>
            <p class="text-sm text-muted-foreground">
              Question with more than two options
            </p>
          </div>
          <Button class="w-full" @click="showMultipleChoice">
            Show Multiple Choice
          </Button>
        </div>

        <!-- Closable Question -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Closable Dialog
            </h3>
            <p class="text-sm text-muted-foreground">
              Dialog with close button (optional answer)
            </p>
          </div>
          <Button class="w-full" @click="showClosableQuestion">
            Show Closable Question
          </Button>
        </div>
      </div>
    </section>

    <Separator />

    <!-- Advanced Examples -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Advanced Examples
      </h2>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- Success Message -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Success Message
            </h3>
            <p class="text-sm text-muted-foreground">
              Single button confirmation dialog
            </p>
          </div>
          <Button class="w-full" @click="showSuccessQuestion">
            Show Success Message
          </Button>
        </div>

        <!-- Warning -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Warning Dialog
            </h3>
            <p class="text-sm text-muted-foreground">
              Alert with warning icon
            </p>
          </div>
          <Button class="w-full" @click="showWarningQuestion">
            Show Warning
          </Button>
        </div>

        <!-- Chained Questions -->
        <div class="rounded-lg border p-4 space-y-3">
          <div>
            <h3 class="font-semibold mb-1">
              Chained Questions
            </h3>
            <p class="text-sm text-muted-foreground">
              Multiple questions in sequence
            </p>
          </div>
          <Button class="w-full" @click="showChainedQuestions">
            Show Chained Questions
          </Button>
        </div>
      </div>
    </section>

    <Separator />

    <!-- Implementation -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">
        Implementation
      </h2>
      <div class="rounded-lg border p-4 space-y-4">
        <div>
          <h3 class="font-semibold mb-2">
            Basic Usage
          </h3>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { useQuestions } from '@/lib/questions'

const { ask } = useQuestions()

const result = await ask({
  title: 'Confirm Action',
  text: 'Are you sure you want to proceed?',
  answers: [
    { text: 'Yes', variant: 'default', value: true },
    { text: 'No', variant: 'secondary', value: false },
  ],
})
// result: boolean</code></pre>
        </div>

        <div>
          <h3 class="font-semibold mb-2">
            With Icon
          </h3>
          <pre class="text-xs bg-muted p-3 rounded overflow-x-auto"><code>import { Trash2 } from 'lucide-vue-next'

const result = await ask({
  title: 'Delete Item',
  text: 'This action cannot be undone.',
  icon: Trash2,
  answers: [
    { text: 'Delete', variant: 'destructive', value: 'delete' },
    { text: 'Cancel', variant: 'outline', value: 'cancel' },
  ],
})</code></pre>
        </div>

        <div>
          <h3 class="font-semibold mb-2">
            Features
          </h3>
          <ul class="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Promise-based API for easy async/await usage</li>
            <li>Type-safe return values based on answer types</li>
            <li>Optional icons from lucide-vue-next</li>
            <li>Customizable button variants (default, destructive, outline, etc.)</li>
            <li>Optional close button with <code class="bg-muted px-1 py-0.5 rounded">closable: true</code></li>
            <li>Prevents accidental closing (ESC key and outside clicks disabled by default)</li>
            <li>Support for chained questions</li>
            <li>Multiple questions can be queued</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

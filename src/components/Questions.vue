<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { EmptyMedia } from '@/components/ui/empty'
import { useQuestions } from '@/lib/questions.ts'

const { questions } = useQuestions()
</script>

<template>
  <template v-for="question in questions" :key="question.id">
    <AlertDialog :open="true">
      <AlertDialogContent
        @interact-outside="question.closable ? question.resolve(false) : undefined"
        @escape-key-down="question.closable ? question.resolve(false) : $event.preventDefault()"
      >
        <AlertDialogHeader>
          <div class="flex flex-col items-center sm:flex-row sm:items-start sm:gap-4">
            <EmptyMedia v-if="question.icon" variant="icon" class="flex justify-center mb-4">
              <component :is="question.icon" />
            </EmptyMedia>
            <div>
              <AlertDialogTitle v-if="question.title">
                {{ question.title }}
              </AlertDialogTitle>
              <AlertDialogDescription v-if="question.text || question.description">
                {{ question.text || question.description }}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter class="gap-2">
          <Button
            v-for="(answer, index) in question.answers"
            :key="index"
            :variant="answer.variant || 'default'"
            @click="question.resolve(answer.value)"
          >
            {{ answer.text }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </template>
</template>

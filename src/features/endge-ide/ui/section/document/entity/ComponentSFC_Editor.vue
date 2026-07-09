<script setup lang="ts">
import { computed, ref } from "vue";
import { Loader2, Play } from "lucide-vue-next";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showWidget } from "@/components/layouts/grid";
import { EndgeIDE } from "@/features/endge-ide/model/core/endge-ide.ts";
import { launchSFCPreview, sfcPreviewError } from "@/features/endge-ide/model/sfc-preview/sfc-preview-state";
import SaveDocumentButton from "@/features/endge-ide/ui/components/SaveDocumentButton.vue";
import ScriptEditor from "@/features/endge-ide/ui/components/ScriptEditor.vue";

const tabs = EndgeIDE.tabs;
const editor = computed<any>(() => tabs.documentEditorModel.value ?? null);
const launchLoading = ref(false);

async function save(): Promise<void> {
  await EndgeIDE.tabs.save();
}

async function launchPreview(): Promise<void> {
  const current = editor.value;
  if (!current)
    return;

  launchLoading.value = true;
  try {
    current.parseSource?.();
    await launchSFCPreview({
      id: current.id,
      identity: current.identity,
      name: current.name,
      displayName: current.displayName,
      source: current.source,
    });
    sfcPreviewError.value = null;
    showWidget("sfc-preview");
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sfcPreviewError.value = message;
    if (message === "Сначала определите превью props")
      toast.warning("Сначала определите превью props");
    else
      toast.error("Не удалось запустить демонстрацию", { description: message });
  }
  finally {
    launchLoading.value = false;
  }
}
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <div v-else class="w-full h-full">
    <div class="p-5 flex flex-col gap-5 h-full min-h-0">
      <div class="flex items-center gap-3 min-w-0 shrink-0">
        <div
          class="size-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0"
        >
          <i class="ti ti-file-type-tsx text-cyan-500 text-2xl" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-semibold truncate">
            {{ editor.displayName || editor.name || editor.identity }}
          </div>
          <div class="text-xs text-muted-foreground truncate">
            {{ editor.identity }}
          </div>
        </div>
        <SaveDocumentButton :loading="EndgeIDE.busy.value" @click="save" />
        <Button
          size="icon"
          variant="outline"
          aria-label="Запуск"
          :disabled="launchLoading"
          @click="launchPreview"
        >
          <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
          <Play v-else class="size-4" />
        </Button>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 shrink-0">
        <div class="grid gap-1.5">
          <Label>Identity</Label>
          <Input v-model="editor.identity" />
        </div>
        <div class="grid gap-1.5">
          <Label>Название</Label>
          <Input v-model="editor.displayName" />
        </div>
      </div>

      <div class="min-h-0 flex-1 flex flex-col">
        <Label class="font-semibold mb-2">Source</Label>
        <ScriptEditor
          v-model="editor.source"
          language="html"
          class="min-h-0 flex-1"
          min-height="420px"
          show-toolbar
          @blur="editor.parseSource()"
        />
      </div>
    </div>
  </div>
</template>

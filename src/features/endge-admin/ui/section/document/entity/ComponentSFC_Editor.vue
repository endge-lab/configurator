<script setup lang="ts">
import { computed, ref } from "vue";
import { Save } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EndgeAdmin } from "@/features/endge-admin/model/core/endge-admin.ts";
import ScriptEditor from "@/features/endge-admin/ui/components/ScriptEditor.vue";

const tabs = EndgeAdmin.tabs;
const editor = computed<any>(() => tabs.documentEditorModel.value ?? null);
const tab = ref("template");

async function save(): Promise<void> {
  editor.value?.syncSourceFromParts?.();
  await EndgeAdmin.tabs.save();
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
        <Button size="sm" class="gap-2" @click="save">
          <Save class="size-4" />
          Сохранить
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

      <Tabs v-model="tab" class="min-h-0 flex-1 flex flex-col">
        <TabsList class="w-fit shrink-0">
          <TabsTrigger value="template"> Template </TabsTrigger>
          <TabsTrigger value="script"> Script </TabsTrigger>
          <TabsTrigger value="style"> Style </TabsTrigger>
          <TabsTrigger value="preview"> Preview </TabsTrigger>
        </TabsList>

        <TabsContent value="template" class="min-h-0 flex-1">
          <ScriptEditor
            v-model="editor.sourceParts.template.content"
            language="html"
            min-height="420px"
            show-toolbar
          />
        </TabsContent>
        <TabsContent value="script" class="min-h-0 flex-1">
          <ScriptEditor
            v-model="editor.sourceParts.script.content"
            language="typescript"
            min-height="420px"
            show-toolbar
          />
        </TabsContent>
        <TabsContent value="style" class="min-h-0 flex-1">
          <ScriptEditor
            v-model="editor.sourceParts.style.content"
            language="css"
            min-height="420px"
            show-toolbar
          />
        </TabsContent>
        <TabsContent value="preview" class="min-h-0 flex-1">
          <ScriptEditor
            v-model="editor.source"
            language="html"
            min-height="420px"
            show-toolbar
            @blur="editor.parseSource()"
          />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>

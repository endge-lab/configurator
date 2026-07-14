<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
defineProps<{
  documentId?: string | number | null
  identity?: string | null
}>()
</script>

<template>
  <div class="source-document-editor-shell">
    <header class="source-document-editor-shell__header">
      <div class="source-document-editor-shell__left">
        <slot name="left">
          <div class="source-document-editor-shell__metadata">
            <div class="source-document-editor-shell__metadata-row">
              <span class="source-document-editor-shell__metadata-label">id:</span>
              <span class="source-document-editor-shell__metadata-value">{{
                documentId ?? "-"
              }}</span>
            </div>
            <div class="source-document-editor-shell__metadata-row">
              <span class="source-document-editor-shell__metadata-label">identity:</span>
              <span class="source-document-editor-shell__metadata-value">{{
                identity || "-"
              }}</span>
            </div>
            <slot name="metadata-after" />
          </div>
        </slot>
      </div>

      <div class="source-document-editor-shell__center">
        <slot name="center" />
      </div>

      <div class="source-document-editor-shell__right">
        <slot name="right" />
      </div>
    </header>

    <main class="source-document-editor-shell__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.source-document-editor-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.source-document-editor-shell__header {
  display: grid;
  min-width: 0;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.25rem 0.375rem;
}

.source-document-editor-shell__metadata {
  min-width: 0;
  padding-inline: 0.25rem;
  font-size: 0.75rem;
  line-height: 1rem;
}

.source-document-editor-shell__metadata-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.375rem;
}

.source-document-editor-shell__metadata-label {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
}

.source-document-editor-shell__metadata-value {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground) / 0.82);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-document-editor-shell__left,
.source-document-editor-shell__center,
.source-document-editor-shell__right {
  display: flex;
  min-width: 0;
  align-items: center;
}

.source-document-editor-shell__left {
  justify-content: flex-start;
}

.source-document-editor-shell__center {
  justify-content: center;
}

.source-document-editor-shell__right {
  justify-content: flex-end;
}

.source-document-editor-shell__content {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}
</style>

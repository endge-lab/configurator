<script setup lang="ts">
const widgetTitle = 'Hello World, я тестовый виджет'
</script>

<template>
  <div class="hello-world-widget">
    <span class="hello-world-widget__dot" aria-hidden="true" />
    <p>{{ widgetTitle }}</p>
  </div>
</template>

<style scoped>
.hello-world-widget {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  color: var(--foreground);
  background: var(--background);
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: center;
}

.hello-world-widget__dot {
  width: 0.6rem;
  height: 0.6rem;
  flex: none;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 0.3rem rgb(34 197 94 / 14%);
}

.hello-world-widget p {
  margin: 0;
}
</style>

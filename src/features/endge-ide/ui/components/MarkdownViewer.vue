<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

hljs.registerAliases(['endgecss'], { languageName: 'css' })

const props = defineProps<{ src: string }>()
const htmlContent = ref<string>('')

const markdownFiles = import.meta.glob(
  [
    '/src/features/endge-ide/docs/**/*.md',
  ],
  {
    query: '?raw',
    import: 'default',
  },
)

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang }).value
        return `<pre class="hljs"><button class="copy-btn">Copy</button><code>${highlighted}</code></pre>`
      } catch (_) {}
    }
    return `<pre class="hljs"><button class="copy-btn">Copy</button><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

async function loadMarkdown(): void {
  const fileKey = `/src/features/endge-ide/docs/${props.src}.md`

  const loader = markdownFiles[fileKey]
  if (loader) {
    const raw = await loader()
    htmlContent.value = md.render(raw)
  } else {
    htmlContent.value = `<p class="text-danger">Файл "${props.src}" не найден.</p>`
    console.error(
      `[MarkdownViewer]: Файл "${props.src}" не найден в import.meta.glob. Пробовали: ${fileKey}`,
    )
  }
}

// Добавляем обработчики для кнопок после каждого обновления
function addCopyButtons(): void {
  const blocks = document.querySelectorAll('.MarkdownWrapper pre.hljs')
  blocks.forEach((block) => {
    const btn = block.querySelector('.copy-btn') as HTMLButtonElement
    const codeEl = block.querySelector('code')
    if (btn && codeEl) {
      btn.onclick = async () => {
        await navigator.clipboard.writeText(codeEl.textContent || '')
        btn.textContent = 'Copied!'
        setTimeout(() => (btn.textContent = 'Copy'), 1500)
      }
    }
  })
}

onMounted(async () => {
  await loadMarkdown()
  nextTick(addCopyButtons)
})

watch(htmlContent, () => {
  nextTick(addCopyButtons)
})

watch(() => props.src, () => {
  loadMarkdown().then(() => {
    nextTick(addCopyButtons)
  })
})
</script>

<template>
  <div class="MarkdownWrapper" v-html="htmlContent"></div>
</template>

<style lang="scss">
.MarkdownWrapper {
  color: var(--color-text);
  line-height: 1.6;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: bold;
    margin: 0.5em 0;
  }
  h1 {
    font-size: 1.5rem;
    color: var(--color-primary);
  }
  h2 {
    font-size: 1.3rem;
    color: var(--color-primary);
  }
  h3 {
    font-size: 1.1rem;
    color: var(--color-tonal);
  }

  p {
    margin: 0.3em 0;
  }
  ul,
  ol {
    margin: 0.5em 0 0.5em 1.2em;
    list-style: disc;
  }

  a {
    color: var(--color-primary);
    text-decoration: underline;
    &:hover {
      text-decoration: none;
    }
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5rem 0;
    th,
    td {
      border: 1px solid var(--color-border);
      padding: 0.3rem 0.5rem;
      text-align: left;
    }
    th {
      background: var(--color-layer);
      font-weight: 600;
    }
  }

  // Стили для code-блоков (Highlight.js)
  pre.hljs {
    background: var(--color-layer);
    color: var(--color-text);
    padding: 0.75rem;
    border-radius: 0.3rem;
    overflow-x: auto;
    font-family: 'Fira Code', monospace;
  }

  code {
    color: var(--color-primary);
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-family: 'Fira Code', monospace;
  }

  // Ключевые слова, строки, числа и другие элементы (схема подсветки)
  .hljs-keyword,
  .hljs-selector-tag,
  .hljs-literal {
    color: var(--color-primary);
    font-weight: bold;
  }

  .hljs-string,
  .hljs-attr {
    color: var(--color-success);
  }

  .hljs-title,
  .hljs-section {
    color: var(--color-info);
  }

  .hljs-comment {
    color: var(--color-muted);
    font-style: italic;
  }

  .hljs-number {
    color: var(--color-warning);
  }

  .hljs-built_in,
  .hljs-builtin-name {
    color: var(--color-tonal);
  }

  pre.hljs {
    position: relative;
  }

  .copy-btn {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background: var(--color-layer);
    color: var(--color-text);
    border: none;
    border-radius: 0.2rem;
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.2s ease;
    opacity: 0.7;

    &:hover {
      opacity: 1;
      background: var(--color-hover);
    }
  }
}
</style>

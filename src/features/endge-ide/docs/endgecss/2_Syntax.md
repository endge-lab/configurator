# Syntax, nesting and values

Синтаксис близок к CSS/SCSS: обычные rules, вложенность, `&`, `/* */` и `//` comments, custom properties и `var()`.

```endgecss
.flight-card {
  --accent: #2563eb;
  color: var(--accent);

  &:state(delayed) > Text {
    font-weight: 600;
  }
}
```

Supported values are tokenized into neutral words, strings, dividers and functions. SCSS `$variables`, mixins, imports, functions and property nesting are intentionally absent.

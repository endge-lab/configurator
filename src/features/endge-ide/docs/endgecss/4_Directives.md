# Themes and directives

```endgecss
@theme dark {
  --surface: #111827;
  --text: #f9fafb;
  .panel { background: var(--surface); color: var(--text); }
}

@scope (:component(FlightBoard)) to (.nested-board) {
  Text { letter-spacing: .01em; }
}

@supports renderer(dom) and not capability(print) {
  ::part(status) { text-decoration: underline; }
}
```

`@theme` contributes switchable tokens/rules. `@scope` limits matching in the abstract tree. `@supports` is for renderer or adapter-specific optional styling; an unknown capability excludes the rule and reports a warning.

`@layer` is forbidden. It must not be confused with future Specific Override source bindings.

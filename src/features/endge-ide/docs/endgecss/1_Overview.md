# EndgeCSS: overview

EndgeCSS is the single renderer-neutral style language for global `RStyle` documents and Endge SFC style blocks.

```text
RStyle.source / SFC <style>
→ parser + diagnostics
→ EndgeStyleSheetArtifact in Endge.program
→ abstract selector matcher
→ DOM or future Canvas materializer
```

The source is the only authored truth. Generated DOM CSS is a preview/output, not editable state.

```endgecss
Text.notice { color: var(--accent); }
```

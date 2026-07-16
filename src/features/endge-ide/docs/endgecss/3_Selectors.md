# Selectors and cascade

EndgeCSS поддерживает tags, `.class`, local `#id`, attributes, descendant/child/sibling combinators, `:first-child`, `:last-child`, `:nth-child()`, `:not()`, `:is()` и `:where()`.

```endgecss
Text { color: gray; }
#status[data-tone="danger"] { color: red; }
:component(FlightBoard) > Flex:nth-child(odd) { background: #f8fafc; }
:identity(flight-board) ::part(status) { font-weight: 700; }
```

`Text` means an abstract Endge tag, not HTML `span`. A local `#id` is lowered to `data-endge-id`, so repeated component instances do not create duplicate HTML ids.

Cascade order: `!important`, selector specificity, deterministic effective source order. Inline normal declarations beat normal rules; EndgeCSS important may beat inline normal declarations.

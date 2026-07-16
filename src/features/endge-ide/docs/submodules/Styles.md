# Endge.styles

`Endge.styles` exposes valid renderer-neutral artifacts from `Endge.program`:

- `getActiveArtifacts()` returns global styles in effective source order;
- `createResolver(targetProfile)` resolves declarations against an abstract Endge node;
- theme ids are registered in `Endge.ui` with owner-based cleanup.

DOM compilation belongs to `@endge/vue`. Core does not know about HTML elements, `CSSStyleSheet`, Vue wrappers, or Shadcn. Canvas can consume the same artifact and matcher without parsing CSS.

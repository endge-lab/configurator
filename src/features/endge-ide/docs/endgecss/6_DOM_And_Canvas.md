# DOM compilation and Canvas boundary

The DOM backend lives in `@endge/vue`; Native DOM and Shadcn share it. It materializes declarations into stable generated classes and one managed stylesheet. Vue traversal supplies logical parent, sibling index, component boundary, evaluated props, state and part markers.

Generated selectors use `:where(.generated-class)`. Rules are emitted in neutral cascade order, so browser-specific selector behavior cannot change Endge semantics. Theme selectors activate precompiled rules through `data-endge-theme`; switching a theme does not recompile or rerender the SFC.

Canvas does not consume generated CSS. A future Canvas backend will use the same `EndgeStyleSheetArtifact`, support conditions and abstract matcher, then map resolved declarations to paint/layout commands.

# Endge.styles

`RStyle` is a source-first document. Payload stores only its canonical `source`, `sourceVersion`, metadata, and document relations.

На текущем этапе `Endge.styles` является lifecycle boundary для будущего EndgeCSS compiler/runtime. Модуль ещё не парсит source, не создаёт derived artifacts и не применяет CSS в DOM.

Renderer-specific output for DOM, Canvas, or other targets must be produced later from one compiled EndgeCSS artifact. It must not become part of the persisted style document.

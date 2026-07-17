# Style (RStyle)

`RStyle` — глобальный source-first документ EndgeCSS. Payload хранит только авторский `source`, `sourceVersion`, identity, metadata и relations. AST, diagnostics, indexes и CSS никогда не являются второй persisted моделью.

During `Endge.compiler.build`, every active style becomes a typed `style` artifact in `Endge.program`. Invalid drafts may be saved, but their artifacts are not applied.

Порядок глобальных документов определяется эффективным контекстом подключения. Внутри одного source layer системные документы идут первыми, затем авторские; `identity` используется как стабильный tie-breaker.

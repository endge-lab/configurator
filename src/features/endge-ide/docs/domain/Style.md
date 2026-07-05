# Style (Стиль)

Сущность домена, описывающая набор стилей (JSON). Коллекция Payload: `styles`.

**Поля:** `identity`, `displayName`, `folder`, `project`, `styles` (обязательный JSON, по умолчанию `{}`), `meta`, `inherited`, `isSystem`.

Системные стили (`isSystem: true`) нельзя редактировать и удалять в редакторе. В виджете домена отображаются в секции «Стили» (root-styles). При seed создаётся системный стиль с `identity=default` и именем «Общие».

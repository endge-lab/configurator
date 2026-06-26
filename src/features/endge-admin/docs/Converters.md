# Конвертеры

**Конвертеры** в Endge - это сущности домена, которые преобразуют значение поля (например, из формы или API) в нужный тип или формат перед использованием в отчётах, фильтрах и сценариях.

Чтобы конвертер работал в рантайме, нужно выполнить **два шага**:

1. **Создать конвертер в домене** (завести запись с уникальным `identity`).
2. **Привязать обработчик** через `Endge.bind.converter(identity, handler)`.

Без первого шага `Endge.bind.converter` не найдёт конвертер в домене и вернёт `false`. Без второго шага вызов конвертера по этому `identity` вернёт `null`.

**Применение к массивам.** Если конвертер ориентирован на одно значение, а в цепочку передаётся массив, он применяется к каждому элементу автоматически; результат - массив преобразованных значений. Это позволяет использовать одни и те же конвертеры и для одиночных значений, и для списков (например, в полях фильтра с множественным выбором).

---

## 1. Создание конвертера в домене

Запись о конвертере должна существовать в домене (схема, Payload, загрузка при инициализации). Это можно сделать одним из способов.

### Через админку (рекомендуется)

1. Откройте раздел **Домен** - **Конвертеры**.
2. Создайте новый конвертер или выберите существующий.
3. Укажите **идентификатор** (например, `my-custom-converter`) - он понадобится для `Endge.bind.converter`.
4. Заполните название и описание при необходимости.
5. Сохраните. После сохранения схемы конвертер будет загружаться в домен при старте приложения.

### Программно (при инициализации)

Если конвертер не хранится в Payload, его можно добавить в домен вручную при инициализации Endge:

```ts
import { Endge, RConverter } from '@endge/core'

// После загрузки домена (например, в onModuleInstall или после schema.load())
const converter = new RConverter()
converter.id = 'my-custom-converter'
converter.name = 'Мой конвертер'
converter.description = 'Описание для подсказок'

Endge.domain.addConverter(converter)
```

Идентификатор `my-custom-converter` затем используется в `Endge.bind.converter`.

---

## 2. Привязка обработчика: Endge.bind.converter

После того как конвертер есть в домене, к нему нужно привязать **функцию-обработчик**. Это делается через `Endge.bind.converter(identity, handler)`.

- **identity** - строка, совпадающая с `id` конвертера в домене.
- **handler** - функция `(value: any) => any`. Получает исходное значение, возвращает преобразованное (или `null` при ошибке).

Метод возвращает `true`, если конвертер найден и обработчик установлен, и `false`, если конвертер с таким `identity` в домене отсутствует.

### Пример: конвертер из кода (добавлен в домен вручную)

```ts
import { Endge, RConverter } from '@endge/core'

function MyConverter(value: string | null): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

// 1. Добавляем конвертер в домен
const rConverter = new RConverter()
rConverter.id = 'string-to-number'
rConverter.name = 'Строка в число'
Endge.domain.addConverter(rConverter)

// 2. Привязываем обработчик
Endge.bind.converter('string-to-number', MyConverter)
```

### Пример: конвертер из Payload (создан в админке)

Конвертер `weekdays-range` уже есть в схеме (создан в админке или через seed). Обработчик привязываем при старте приложения:

```ts
import { Endge } from '@endge/core'

function WeekDays_converter(str: unknown): boolean[] {
  const result = Array(7).fill(false)
  const s = str != null ? String(str).trim() : ''
  if (!s) return result

  const parts = s.split(',').map((p: string) => p.trim())
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= 7) result[i - 1] = true
      }
    } else {
      const day = Number(part)
      if (day >= 1 && day <= 7) result[day - 1] = true
    }
  }
  return result
}

// Конвертер уже в домене (загружен из Payload) - только привязываем handler
Endge.bind.converter('weekdays-range', WeekDays_converter)
```

### Пример: стандартный конвертер с обработчиком в одном месте

В одном модуле можно и добавить конвертер в домен, и сразу привязать обработчик:

```ts
import { Endge, RConverter } from '@endge/core'

function StringToDate_converter(input: string | Date | null | undefined): Date | null {
  if (!input) return null
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  const parsed = new Date(String(input).trim())
  return isNaN(parsed.getTime()) ? null : parsed
}

const rConverter = new RConverter()
rConverter.id = 'string-to-date'
rConverter.name = 'Строка в Date'
rConverter.setCustom(StringToDate_converter)

Endge.domain.addConverter(rConverter)
// Обработчик уже установлен через setCustom; при желании можно и bind:
// Endge.bind.converter('string-to-date', StringToDate_converter)
```

---

## Где используются конвертеры

- **Фильтры** - у поля фильтра задаётся цепочка конвертеров (`converterIdentities`). Значение ячейки/параметра последовательно прогоняется через эти конвертеры перед сравнением.
- **Отчёты и сценарии** - там, где по конфигурации указан `identity` конвертера, вызывается соответствующий обработчик из домена.

Системные конвертеры (с флагом **Системный** в админке) нельзя редактировать и пересохранять; их обработчики по-прежнему привязываются через `Endge.bind.converter` после загрузки домена.

---

## Краткий чеклист

| Шаг | Действие |
|-----|----------|
| 1 | Создать конвертер в домене: админка **Домен - Конвертеры** или `Endge.domain.addConverter(rConverter)` |
| 2 | Привязать обработчик: `Endge.bind.converter('identity', (v) => ...)` после загрузки домена |
| 3 | Использовать `identity` в настройках полей фильтров (`converterIdentities`) или в отчётах |

Без шага 1 вызов `Endge.bind.converter` вернёт `false`. Без шага 2 вызов конвертера по этому `identity` вернёт `null`.

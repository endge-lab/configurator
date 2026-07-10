import { PayloadHttpClient } from '@endge/utils'
import { Endge } from '@endge/core'

const PAYLOAD_BASE_URL = import.meta.env.VITE_PAYLOAD_BASE_URL as string | undefined
const domain = Endge.domain

const payloadClient = PAYLOAD_BASE_URL
  ? new PayloadHttpClient({ baseUrl: PAYLOAD_BASE_URL })
  : null

if (!payloadClient) {
  console.warn(
    'VITE_PAYLOAD_BASE_URL не задан - синхронизация с Payload недоступна'
  )
}

/** Ищем папку по identity, возвращаем id документа (для поля folder). Папки не создаём. */
async function getFolderIdByIdentity(identity: string): Promise<string | null> {
  if (!payloadClient) return null
  try {
    const res = await payloadClient.get<{ docs: { id: string }[] }>(
      '/folders',
      { 'where[identity][equals]': identity, limit: 1 }
    )
    const doc = res?.docs?.[0]
    return doc ? String(doc.id) : null
  } catch {
    return null
  }
}

/**
 * Синхронизация одной сущности в Payload: создаём или обновляем по identityKey.
 * Все данные из домена передаются в schema; folder - только корневая папка (id).
 */
async function syncEntity<T>(opts: {
  collection: string
  identityKey: string
  identityValue: string
  rootFolderId: string | null
  payloadDoc: Record<string, unknown>
}): Promise<void> {
  const { collection, identityKey, identityValue, rootFolderId, payloadDoc } = opts
  if (!payloadClient) throw new Error('Payload client не инициализирован')

  const data: Record<string, unknown> = { ...payloadDoc }
  if (rootFolderId != null && String(rootFolderId).trim() !== '') {
    const folderId = Number(rootFolderId)
    if (!Number.isNaN(folderId)) data.folder = folderId
  }

  try {
    const existing = await payloadClient.get<{ docs: { id: string }[] }>(
      `/${opts.collection}`,
      { [`where[${identityKey}][equals]`]: identityValue, limit: 1 }
    )

    if (!existing?.docs?.length) {
      await payloadClient.post(`/${opts.collection}`, data)
      console.log(`➕ Создан ${opts.collection.slice(0, -1)}: ${identityValue}`)
    } else {
      const docId = existing.docs[0]?.id
      if (!docId) return
      await payloadClient.patch(`/${opts.collection}/${docId}`, data)
      console.log(`♻️ Обновлён ${opts.collection.slice(0, -1)}: ${identityValue}`)
    }
  } catch (e) {
    console.error(
      `❌ Синхронизация ${opts.collection.slice(0, -1)} "${identityValue}"`,
      e
    )
    // throw e
  }
}

/** Корневые папки по типам сущностей (identity в Payload). Папки не создаём - только подставляем id. */
const ROOT_FOLDER_IDENTITIES = {
  queries: 'root-queries',
  // components: 'root-components',
  // types: 'root-types',
  // actions: 'root-actions',
  parameters: 'root-parameters',
} as const

/**
 * Синхронизация домена с Payload.
 * Сейчас активна только синхронизация запросов (queries), в т.ч. с параметрами (params в полях).
 */
export async function syncDomainToPayload(): Promise<void> {
  if (!payloadClient) throw new Error('Payload client не инициализирован')

  const plain = domain.toPlain()

  const rootFolderIds = {
    queries: await getFolderIdByIdentity(ROOT_FOLDER_IDENTITIES.queries),
    // components: await getFolderIdByIdentity(ROOT_FOLDER_IDENTITIES.components),
    // types: await getFolderIdByIdentity(ROOT_FOLDER_IDENTITIES.types),
    // actions: await getFolderIdByIdentity(ROOT_FOLDER_IDENTITIES.actions),
    parameters: await getFolderIdByIdentity(ROOT_FOLDER_IDENTITIES.parameters),
  }

  // Запросы: данные в полях коллекции (type, endpoint, params, filters, ...)
  // for (const query of plain.queries ?? []) {
  //   const id = query.id ?? query.identity
  //   const name = query.name ?? id
  //   if (!id) continue
  //   await syncEntity({
  //     collection: 'queries',
  //     identityKey: 'identity',
  //     identityValue: id,
  //     rootFolderId: rootFolderIds.queries,
  //     payloadDoc: {
  //       identity: id,
  //       displayName: name,
  //       type: query.type,
  //       endpoint: query.endpoint,
  //       query: query.query,
  //       params: query.params,
  //       ...query,
  //       active: true,
  //       author: 'system',
  //     },
  //   })
  // }

  // // Компоненты: identity, displayName, schema (как в домене), folder = корневая папка
  // for (const comp of plain.components ?? []) {
  //   const id = comp.id ?? comp.identity
  //   const name = comp.name ?? id
  //   if (!id) continue
  //   await syncEntity({
  //     collection: 'components',
  //     identityKey: 'identity',
  //     identityValue: id,
  //     rootFolderId: rootFolderIds.components,
  //     payloadDoc: {
  //       identity: id,
  //       displayName: name,
  //       schema: comp,
  //       active: true,
  //       author: 'system',
  //     },
  //   })
  // }

  // // Типы (без примитивов): identity = name, schema = данные типа
  // for (const type of plain.types ?? []) {
  //   if (type.isPrimitive) continue
  //   const name = type.name
  //   if (!name) continue
  //   await syncEntity({
  //     collection: 'types',
  //     identityKey: 'identity',
  //     identityValue: name,
  //     rootFolderId: rootFolderIds.types,
  //     payloadDoc: {
  //       identity: name,
  //       displayName: name,
  //       schema: type,
  //       active: true,
  //       author: 'system',
  //     },
  //   })
  // }

  // // Действия
  // for (const action of plain.actions ?? []) {
  //   const id = action.identity ?? action.id
  //   const name = action.name ?? id
  //   if (!id) continue
  //   await syncEntity({
  //     collection: 'actions',
  //     identityKey: 'identity',
  //     identityValue: id,
  //     rootFolderId: rootFolderIds.actions,
  //     payloadDoc: {
  //       identity: id,
  //       displayName: name,
  //       schema: action,
  //       active: true,
  //       author: 'system',
  //     },
  //   })
  // }

  // // Фильтры: identity, displayName, description, schema (fields, runtimeFilters и т.д.)
  // Payload требует в поле fields (Параметры) минимум 1 строку - подставляем заглушку при пустом массиве
  const FILTER_FIELDS_PLACEHOLDER = [
    { key: '_', label: '-', type: 'String' as const, required: false },
  ]
  for (const filter of plain.parameters ?? []) {
    const id = filter.identity ?? filter.id
    const displayName = filter.displayName ?? filter.name ?? id
    if (!id) continue
    const fields =
      Array.isArray(filter.fields) && filter.fields.length > 0
        ? filter.fields
        : FILTER_FIELDS_PLACEHOLDER
    await syncEntity({
      collection: 'parameters',
      identityKey: 'identity',
      identityValue: id,
      rootFolderId: rootFolderIds.parameters,
      payloadDoc: {
        identity: id,
        displayName,
        description: filter.description ?? undefined,
        fields,
        schema: filter,
        active: filter.active ?? true,
        author: 'egorkozelskij',
      },
    })
  }

  console.log('✅ Синхронизация запросов с Payload завершена')
}

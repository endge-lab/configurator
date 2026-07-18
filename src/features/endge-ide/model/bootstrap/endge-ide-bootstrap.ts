/* eslint-disable perfectionist/sort-imports -- Endge plugins must be registered before context runtime is evaluated */
import './endge-runtime-plugins'
import './endge-renderer-plugins'

import { EndgeIDEContext } from '@/features/endge-ide/model/context/endge-ide-context'
/* eslint-enable perfectionist/sort-imports */

/** Boots the Endge engine and establishes the initial IDE execution context. */
export async function bootstrapEndgeIDE(): Promise<void> {
  await EndgeIDEContext.init()
}

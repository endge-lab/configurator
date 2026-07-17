import type { EndgePreviewTarget } from '@/features/endge-preview/domain/types/preview.types'
import type { EndgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-session'

import { EndgeModuleController } from '@endge/core'

import { endgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-state'
import { EndgePreviewWidgets } from '@/features/endge-preview/model/core/endge-preview-widgets'

/** Standalone federation for the debug preview route. It does not depend on EndgeIDE. */
export class EndgePreview extends EndgeModuleController {
  private static readonly _host = new EndgePreview()
  private static readonly _session = endgePreviewSession
  private static readonly _widgets = new EndgePreviewWidgets()
  private static _modulesRegistered = false

  public static async init(target: EndgePreviewTarget): Promise<void> {
    if (!this._modulesRegistered) {
      this._host.registerModule('session', this._session)
      this._host.registerModule('widgets', this._widgets)
      this._modulesRegistered = true
    }
    this._host.init()
    await this._session.open(target)
  }

  public static open(target: EndgePreviewTarget): Promise<void> {
    return this._session.open(target)
  }

  public static async reset(): Promise<void> {
    await this._session.dispose()
    this._host.reset()
  }

  public static get session(): EndgePreviewSession {
    return this._session
  }

  public static get widgets(): EndgePreviewWidgets {
    return this._widgets
  }
}

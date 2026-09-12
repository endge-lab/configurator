import type { EndgeWorkspaceDocumentStructure } from '@endge/core'

import { Endge } from '@endge/core'
import { computed, ref } from 'vue'

interface DocumentStructureOverrideState {
  version: 1
  value: EndgeWorkspaceDocumentStructure
}

const DOCUMENT_STRUCTURE_OVERRIDE_KEY = 'configurator.domain.document-structure-override'

/** Централизованно управляет persistent UI state текущего IDE runtime. */
export class EndgeIDEUIState_Module {
  private readonly _debuggerState = new Map<string, unknown>()
  private readonly _workspaceDocumentStructure = ref<EndgeWorkspaceDocumentStructure>('frontend')
  private readonly _documentStructureOverride = ref<EndgeWorkspaceDocumentStructure | null>(null)
  private _offWorkspace: (() => void) | null = null
  private _offDocumentStructureState: (() => void) | null = null

  public readonly documentStructure = computed<EndgeWorkspaceDocumentStructure>(() => (
    this._documentStructureOverride.value ?? this._workspaceDocumentStructure.value
  ))

  /** Запускает реактивную проекцию персонального UI state для текущего Workspace. */
  public init(): void {
    if (this._offWorkspace || this._offDocumentStructureState) {
      return
    }
    this._offWorkspace = Endge.workspace.subscribe(() => this._restoreDocumentStructure())
    this._offDocumentStructureState = Endge.context.subscribeState(
      DOCUMENT_STRUCTURE_OVERRIDE_KEY,
      () => this._restoreDocumentStructure(),
    )
    this._restoreDocumentStructure()
  }

  /** Освобождает подписки UI state при деактивации IDE. */
  public reset(): void {
    this._offDocumentStructureState?.()
    this._offWorkspace?.()
    this._offDocumentStructureState = null
    this._offWorkspace = null
    this._documentStructureOverride.value = null
    this._workspaceDocumentStructure.value = 'frontend'
  }

  public clearDebuggerState(): void {
    this._debuggerState.clear()
    this._restoreDocumentStructure()
  }

  /** Возвращает сохранённое значение или переданное fallback-значение. */
  public read<T>(key: string, fallback: T): T {
    if (Endge.mode === 'debugger') {
      return (this._debuggerState.get(key) as T | undefined) ?? fallback
    }
    return Endge.context.getState<T>(key) ?? fallback
  }

  /** Сохраняет сериализуемое UI-состояние. */
  public write(key: string, value: unknown): void {
    if (Endge.mode === 'debugger') {
      this._debuggerState.set(key, value)
      return
    }
    Endge.context.setState(key, value)
  }

  /** Удаляет сохранённое UI-состояние. */
  public remove(key: string): void {
    if (Endge.mode === 'debugger') {
      this._debuggerState.delete(key)
      return
    }
    Endge.context.removeState(key)
  }

  /** Однократно переносит первый найденный legacy localStorage key в context state. */
  public migrateLegacy(key: string, legacyKeys: readonly string[]): void {
    if (Endge.mode === 'debugger') {
      return
    }
    if (Endge.context.getState(key) !== undefined || typeof window === 'undefined') {
      return
    }
    for (const legacyKey of legacyKeys) {
      try {
        const raw = window.localStorage.getItem(legacyKey)
        if (raw == null) {
          continue
        }
        Endge.context.setState(key, JSON.parse(raw))
        if (Endge.context.getState(key) !== undefined) {
          window.localStorage.removeItem(legacyKey)
        }
        return
      }
      catch {
        // Повреждённое legacy-состояние не должно блокировать IDE.
      }
    }
  }

  /** Переключает только проекцию дерева Configurator, не изменяя документ Workspace. */
  public toggleDocumentStructure(): void {
    Endge.assertWritable()
    const next = this.documentStructure.value === 'custom' ? 'frontend' : 'custom'
    const override = next === this._workspaceDocumentStructure.value ? null : next
    this._documentStructureOverride.value = override
    if (override) {
      this.write(DOCUMENT_STRUCTURE_OVERRIDE_KEY, { version: 1, value: override } satisfies DocumentStructureOverrideState)
    }
    else {
      this.remove(DOCUMENT_STRUCTURE_OVERRIDE_KEY)
    }
  }

  /** Синхронизирует сохранённый override и текущий Workspace с реактивной UI-проекцией. */
  private _restoreDocumentStructure(): void {
    this._workspaceDocumentStructure.value = Endge.workspace.isLoaded
      ? Endge.workspace.current.documentStructure ?? 'frontend'
      : 'frontend'
    const state = this.read<unknown>(DOCUMENT_STRUCTURE_OVERRIDE_KEY, null)
    this._documentStructureOverride.value = isDocumentStructureOverrideState(state) ? state.value : null
  }
}

function isDocumentStructureOverrideState(value: unknown): value is DocumentStructureOverrideState {
  if (!value || typeof value !== 'object') {
    return false
  }
  const state = value as Partial<DocumentStructureOverrideState>
  return state.version === 1 && (state.value === 'frontend' || state.value === 'custom')
}

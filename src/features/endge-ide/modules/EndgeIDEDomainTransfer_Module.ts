import type {
  ServiceBackendDomainImportPlan,
  ServiceBackendDomainImportPlanRequest,
  ServiceBackendDomainImportRequest,
  ServiceBackendDomainImportResult,
  ServiceBackendDomainTransferAdapter,
} from '@/features/endge-ide/domain/types/domain-transfer.type'

/** Координирует export/import домена через внешний backend adapter. */
export class EndgeIDEDomainTransfer_Module {
  /** Backend transport для domain transfer workflow. */
  private readonly _adapter: ServiceBackendDomainTransferAdapter

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  /** Создаёт module с явным backend adapter. */
  public constructor(adapter: ServiceBackendDomainTransferAdapter) {
    this._adapter = adapter
  }

  /** Скачивает portable export текущего workspace. */
  public downloadExport(workspaceIdentity: string): Promise<void> {
    return this._adapter.downloadExport(workspaceIdentity)
  }

  /** Создаёт server-side plan для выбранного snapshot. */
  public planImport(request: ServiceBackendDomainImportPlanRequest): Promise<ServiceBackendDomainImportPlan> {
    return this._adapter.planImport(request)
  }

  /** Применяет подтверждённый import plan. */
  public import(request: ServiceBackendDomainImportRequest): Promise<ServiceBackendDomainImportResult> {
    return this._adapter.import(request)
  }
}

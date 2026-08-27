import type { OidcDiscoveryAdapter } from '@/app/domain/types/oidc-discovery.type'
import { Endge, EndgeModule } from '@endge/core'

/** Проверяет OIDC discovery через внешний transport adapter. */
export class OidcDiscovery_Module extends EndgeModule {
  private readonly _adapter: OidcDiscoveryAdapter

  /**
   * ----------------------------------------
   * PUBLIC
   * ----------------------------------------
   */

  /** Создаёт модуль с явным transport adapter. */
  public constructor(adapter: OidcDiscoveryAdapter) {
    super()
    this._adapter = adapter
  }

  /** Разрешает issuer и проверяет обязательные endpoints discovery document. */
  public async check(rawIssuer: string): Promise<void> {
    const raw = rawIssuer.trim()
    const resolved = String(Endge.workspace.variables.resolve(raw, { fallback: raw, onInvalid: 'as-is' }) ?? raw).trim()
    if (!resolved) {
      throw new Error('Укажите issuer')
    }
    if (/^\{[A-Z_][\w.-]*\}$/i.test(raw) && resolved === raw) {
      throw new Error(`Workspace variable не задана: ${raw}`)
    }

    const metadata = await this._adapter.load(resolved)
    if (!String(metadata.authorization_endpoint ?? '').trim() || !String(metadata.token_endpoint ?? '').trim()) {
      throw new Error('В metadata отсутствуют authorization_endpoint или token_endpoint')
    }
  }
}

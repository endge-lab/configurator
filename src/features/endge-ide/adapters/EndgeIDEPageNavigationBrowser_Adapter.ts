import type { EndgeIDEPageNavigationAdapter } from '@/features/endge-ide/domain/types/legacy-workspace-folders.type'

/** Browser implementation перезагрузки Configurator после Legacy-миграции. */
export class EndgeIDEPageNavigationBrowser_Adapter implements EndgeIDEPageNavigationAdapter {
  public reload(): void {
    window.location.reload()
  }
}

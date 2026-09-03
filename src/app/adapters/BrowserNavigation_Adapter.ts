/** Изолирует browser navigation от application modules. */
export class BrowserNavigation_Adapter {
  /** Перезагружает текущую страницу. */
  public reload(): void {
    window.location.reload()
  }
}

export function disableConsole(): void {
  for (const key in window.console) {
    if (typeof window.console[key as keyof typeof window.console] === 'function') {
      try {
        // @ts-expect-error console methods can be readonly in the DOM typings.
        window.console[key as keyof typeof window.console] = (): void => {}
      }
      catch {
        // В некоторых окружениях console может быть только для чтения - игнорируем
      }
    }
  }
}

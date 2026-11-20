import type { ComponentSFCInteractionTriggerModifiers } from '@endge/core'

import { getKeyboardStateSnapshot } from '@endge/utils'

export function captureInteractionModifiers(
  event: KeyboardEvent | MouseEvent,
  portable: boolean,
): ComponentSFCInteractionTriggerModifiers {
  const { ctrlKey, metaKey, shiftKey, altKey } = event
  const platform = portable && ctrlKey !== metaKey
    ? getKeyboardStateSnapshot(document).platform
    : 'unknown'
  const useMod = platform === 'macos'
    ? metaKey
    : (platform === 'windows' || platform === 'linux') && ctrlKey

  const modifiers: ComponentSFCInteractionTriggerModifiers = { exact: true }
  if (shiftKey) {
    modifiers.shift = true
  }
  if (altKey) {
    modifiers.alt = true
  }
  if (useMod) {
    modifiers.mod = true
  }
  else {
    if (ctrlKey) {
      modifiers.ctrl = true
    }
    if (metaKey) {
      modifiers.meta = true
    }
  }
  if (event.getModifierState?.('AltGraph')) {
    modifiers.altGraph = true
  }
  return modifiers
}

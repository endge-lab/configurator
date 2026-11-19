import type { DomainDocumentType } from '@endge/core'
import type { Ref } from 'vue'

import { watch } from 'vue'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

export function useDiagnosticSourceLocation(
  matchesType: (type: DomainDocumentType) => boolean,
  document: Ref<{ id?: string | number, identity?: string } | null>,
  openAt: (offset: number) => Promise<void>,
): void {
  watch([EndgeIDE.tabs.sourceNavigationRequest, document], ([request, current]) => {
    if (request && current && matchesType(request.documentType)
      && [current.id, current.identity].some(value => String(value ?? '') === request.documentId)) {
      void openAt(request.offset)
    }
  }, { immediate: true, flush: 'post' })
}

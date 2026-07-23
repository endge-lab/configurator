import type { SourceDocumentReference } from '@endge/core'

import { Endge, isComponentSFCBuiltInTag, parseComponentSFC } from '@endge/core'

/** Resolves a persisted ComponentSFC tag under the cursor to its authoring document. */
export function resolveComponentSFCTagReference(
  source: string,
  offset: number,
): SourceDocumentReference | null {
  const token = findComponentSFCTagAtOffset(source, offset)
  if (!token || isComponentSFCBuiltInTag(token.tag)) {
    return null
  }

  const registeredIdentity = Endge.program.resolveComponentTag(token.tag)
  const registeredComponent = registeredIdentity
    ? Endge.domain.getComponentSFC(registeredIdentity)
    : null
  if (registeredComponent?.tag?.trim() === token.tag) {
    return {
      target: 'component',
      identity: registeredComponent.identity,
      range: token.range,
    }
  }

  // The editor can be opened before the next compiler build. Reproduce the
  // registry's unambiguous-tag rule from the current persisted domain.
  const owners = Endge.domain.getComponentSFCs()
    .filter(component => component.tag?.trim() === token.tag)
  if (owners.length !== 1) {
    return null
  }

  return {
    target: 'component',
    identity: owners[0]!.identity,
    range: token.range,
  }
}

interface ComponentSFCTagToken {
  tag: string
  range: SourceDocumentReference['range']
}

/** Finds only an opening/closing tag name inside the SFC template block. */
function findComponentSFCTagAtOffset(
  source: string,
  offset: number,
): ComponentSFCTagToken | null {
  const parsedTemplateRange = parseComponentSFC(source).ast?.template?.range
  const fallbackTemplateOpen = parsedTemplateRange
    ? null
    : /<template(?:\s[^>]*)?>/i.exec(source)
  if (!parsedTemplateRange && !fallbackTemplateOpen) {
    return null
  }

  const templateStart = parsedTemplateRange?.start
    ?? fallbackTemplateOpen!.index + fallbackTemplateOpen![0].length
  const templateEnd = parsedTemplateRange?.end
    ?? source.toLowerCase().lastIndexOf('</template')
  const cursor = Math.max(0, Math.min(offset, source.length))
  if (templateEnd < 0 || cursor < templateStart || cursor > templateEnd) {
    return null
  }

  const tagPattern = /<\/?\s*([a-z][\w.:-]*)/gi
  tagPattern.lastIndex = templateStart
  for (let match = tagPattern.exec(source); match && match.index < templateEnd; match = tagPattern.exec(source)) {
    const tag = match[1]!
    const start = match.index + match[0].lastIndexOf(tag)
    const end = start + tag.length
    if (cursor >= start && cursor <= end) {
      return { tag, range: { start, end } }
    }
  }

  return null
}

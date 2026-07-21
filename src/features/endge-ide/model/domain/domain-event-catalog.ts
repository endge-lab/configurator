import type { ComponentSFCPortManifest, DomainDocumentType } from '@endge/core'
import { DomainSectionType } from '@endge/core'

import type { FsFileNode, FsFolderNode } from './domain-tree'

export interface LocalEventCatalogSource {
  identity: string
  displayName: string
  manifest: ComponentSFCPortManifest
}

export function buildEventCatalogRoot(
  builtIns: Array<{ tag: string, manifest: ComponentSFCPortManifest }>,
  locals: LocalEventCatalogSource[],
): FsFolderNode {
  return {
    id: 'root-events',
    identity: 'root-events',
    name: 'События',
    type: 'folder',
    sectionType: DomainSectionType.Event,
    isRoot: true,
    virtual: true,
    children: [
      catalogGroup('events-built-in', 'Built-in', 'builtin', builtIns
        .filter(item => item.manifest.emits.events.length > 0)
        .map(item => ({
          id: `events-built-in:${item.tag}`,
          identity: item.tag,
          name: item.tag,
          type: 'folder' as const,
          sectionType: DomainSectionType.Event,
          virtual: true,
          children: item.manifest.emits.events.map(event => eventNode(`${item.tag}.${event.name}`, event, 'builtin')),
        }))),
      catalogGroup('events-local', 'Local', 'local', locals.map(component => ({
        id: `events-local:${component.identity}`,
        identity: component.identity,
        name: component.displayName || component.identity,
        type: 'folder' as const,
        sectionType: DomainSectionType.Event,
        virtual: true,
        children: [
          localOriginGroup(component, 'own'),
          localOriginGroup(component, 'forwarded'),
        ].filter(group => group.children?.length),
      })).filter(component => component.children.length > 0)),
    ],
  }
}

function catalogGroup(
  id: string,
  name: string,
  origin: 'builtin' | 'local',
  children: FsFolderNode[],
): FsFolderNode {
  return {
    id,
    name,
    type: 'folder',
    sectionType: DomainSectionType.Event,
    virtual: true,
    virtualOrigin: origin,
    children,
  }
}

function localOriginGroup(component: LocalEventCatalogSource, origin: 'own' | 'forwarded'): FsFolderNode {
  const forwarded = origin === 'forwarded'
  return {
    id: `events-local:${component.identity}:${origin}`,
    name: forwarded ? 'Проброшенные' : 'Собственные',
    type: 'folder',
    sectionType: DomainSectionType.Event,
    virtual: true,
    children: component.manifest.emits.events
      .filter(event => Boolean(event.forwardedFrom || event.from) === forwarded)
      .map(event => eventNode(`${component.identity}.${event.name}`, event, origin, component.identity)),
  }
}

function eventNode(
  identity: string,
  event: ComponentSFCPortManifest['emits']['events'][number],
  origin: 'builtin' | 'own' | 'forwarded',
  ownerIdentity?: string,
): FsFileNode {
  return {
    id: `event:${identity}`,
    identity,
    name: event.name,
    type: 'file',
    docType: 'component-sfc' as DomainDocumentType,
    sectionType: DomainSectionType.Event,
    virtual: true,
    badges: [event.payloadType, ...(event.action ? ['Action'] : [])],
    sourceDocument: ownerIdentity ? { identity: ownerIdentity, docType: 'component-sfc' as DomainDocumentType } : undefined,
    eventPort: {
      payloadType: event.payloadType,
      origin,
      hasAction: Boolean(event.action),
      sourceRange: event.sourceRange,
    },
  }
}

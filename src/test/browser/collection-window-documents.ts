import type { EndgeDomainBundle, PageCacheOptions } from '@endge/core'
import { createDefaultEndgeConfiguration } from '@endge/core'

// Shared by the browser fixture and documentation exercises: real Source documents.
export function collectionWindowBundle(endpoint: string, options: { cache?: PageCacheOptions, retention?: { beforeRows: number, afterRows: number }, prefetchRows?: number } = {}): EndgeDomainBundle {
  const keys = [
    'facets',
    'facet-documents',
    'folders',
    'types',
    'queries',
    'data-views',
    'compositions',
    'stores',
    'streams',
    'simulations',
    'updates',
    'mocks',
    'components',
    'actions',
    'filters',
    'converters',
    'computations',
    'vocabs',
    'i18n-bundles',
    'auth-profiles',
    'navigations',
    'styles',
    'configurations',
  ]
  const documents = Object.fromEntries(
    keys.map(key => [key, []]),
  ) as unknown as EndgeDomainBundle['documents']
  documents.stores = [
    {
      identity: 'window-state',
      sourceVersion: 1,
      source: `defineStore({data:{window:value({revision:0,rowsRevision:0,blocks:[]})}})`,
    },
  ]
  documents.updates = [
    {
      identity: 'window-commit',
      storeIdentity: 'window-state',
      sourceVersion: 1,
      source: `defineUpdate({mutations:[{strategy:'set',target:'window',value:input('next'),when:eq(data('window.revision'),input('expectedRevision'))}]})`,
    },
  ]
  documents.queries = [
    {
      identity: 'window-page',
      type: 'query-rest',
      sourceVersion: 2,
      source: `defineQuery({kind:'rest',props:defineProps({direction:field('String'),limit:field('Number'),cursor:field('String').optional(),offset:field('Number').optional(),filter:field('String').optional(),delay:field('Number').optional(),fail:field('Boolean').optional()}),request:{endpoint:${JSON.stringify(endpoint)},path:'/__collection-window/page',method:'POST',headers:{'Content-Type':'application/json'},body:body(({prop})=>({direction:prop('direction'),limit:prop('limit'),cursor:prop('cursor'),offset:prop('offset'),filter:prop('filter'),delay:prop('delay'),fail:prop('fail')}))},outputs:{page:output().from(response())}})`,
    },
  ]
  documents.components = [
    {
      identity: 'window-table',
      type: 'component-sfc',
      kind: 'component-sfc',
      sourceVersion: 1,
      source: `<script setup lang="ts">
  defineProps<{rows:Array<{id:string,label:string}>,rowsRevision:number}>()
  const ports = definePorts({emits:{viewportChanged:event<TableViewportChangedEvent>({from:{ref:'table',event:'viewportChanged'}})}})
  </script><template><Table ref="table" id="window-table" :rows="rows" :rows-revision="rowsRevision" :preserve-scroll-anchor="true" paging="virtual" :row-size="32" height="320" row-key="id" @rowActivated="action({identity:'table.scrollToRow',input:{rowId:event('rowId'),align:'start'}})"><Column key="id" title="Key"/><Column key="label" title="Record" :width="280"/></Table></template>`,
    },
  ]
  const cacheSource = options.cache ? `,cache:${JSON.stringify(options.cache)}` : ''
  const retentionSource = options.retention ? `,retention:${JSON.stringify(options.retention)}` : ''
  documents.compositions = ['cursor', 'offset'].map(paging => ({
    identity: `window-${paging}`,
    sourceVersion: 1,
    source: `defineComposition({data:{state:store('window-state')},runtimes:{window:controller('endge.collection-window').withProps({paging:'${paging}',batchSize:40,prefetchRows:${options.prefetchRows ?? 2},maxLoadedRows:80,initialOffset:100,request:{filter:'all'}${retentionSource}}).withDependencies({state:{store:data('state'),path:'window',update:'window-commit'},load:{query:'window-page',output:'page'${cacheSource}}}),screen:component('window-table').withProps({rows:fromOutput('window','rows'),rowsRevision:fromOutput('window','rowsRevision')})},hooks:[onEvent('screen','viewportChanged').command('window','setViewport',event())],outputs:{rows:output().fromRuntime('window').select('rows'),rowsRevision:output().fromRuntime('window').select('rowsRevision')}})`,
  }))
  return {
    kind: 'workspace-snapshot',
    schemaVersion: 5,
    workspace: {
      identity: 'collection-window-fixture',
      displayName: 'Collection window fixture',
      startupCompositionIdentity: null,
      dataMode: 'production',
      managedBy: 'user',
      managedById: null,
      meta: {},
      configuration: createDefaultEndgeConfiguration(),
    },
    installedIntegrations: [],
    documents,
  }
}

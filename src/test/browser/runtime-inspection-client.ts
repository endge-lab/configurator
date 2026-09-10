import type { EndgeDomainBundle, StoreRuntimeHost } from '@endge/core'
import { createDefaultEndgeConfiguration, Endge } from '@endge/core'

/** Ручной browser integration fixture: реальные Core/Bridge и локальный backend, только данные в памяти. */
export async function startRuntimeInspectionClient(workspaceIdentity: string, serverUrl: string): Promise<void> {
  Endge.context.configurePersistence({ context: 'disabled' })
  const keys = ['projects', 'tenants', 'environments', 'folders', 'types', 'queries', 'data-views', 'compositions', 'stores', 'streams', 'simulations', 'updates', 'mocks', 'components', 'actions', 'filters', 'converters', 'computations', 'vocabs', 'i18n-bundles', 'auth-profiles', 'navigations', 'styles', 'configurations']
  const documents = Object.fromEntries(keys.map(key => [key, []])) as unknown as EndgeDomainBundle['documents']
  documents.projects = [{ identity: 'inspection-project', displayName: 'Inspection Project', active: true }]
  documents.tenants = [{ identity: 'inspection-tenant', displayName: 'Inspection Tenant', active: true }]
  documents.environments = [{ identity: 'inspection-dev', displayName: 'Inspection Dev', active: true }]
  documents.stores = [{ identity: 'inspection-store', displayName: 'Inspection Store', source: 'defineStore({ data: { count: value(0), rows: value([{ id: 1, label: "Sample" }]) } })', sourceVersion: 1 }]
  documents.filters = [{ identity: 'inspection-filter', displayName: 'Inspection Filter', source: 'defineFilter({ fields: { search: field("String").default("Client filter") }, outputs: {} })', sourceVersion: 1, active: true }]
  documents.components = [{ identity: 'inspection-table', displayName: 'Inspection Table', kind: 'component-sfc', type: 'component-sfc', source: `<script setup lang="ts">
defineProps<{ rows: Array<{ id: number, label: string }>, count: number }>()
</script>
<template>
  <Flex direction="column" gap="3">
    <Text>Client counter: {{ count }}</Text>
    <Table :rows="rows" row-key="id"><Column key="id" title="ID"><Cell><Text>{{ row.id }}</Text></Cell></Column><Column key="label" title="Label"><Cell><Text>{{ row.label }}</Text></Cell></Column></Table>
  </Flex>
</template>`, sourceVersion: 1, active: true }]
  documents.compositions = [{ identity: 'inspection-graph', displayName: 'Inspection Graph', source: `defineComposition({
    data: { state: store("inspection-store") },
    runtimes: {
      filter: filter("inspection-filter"),
      filters: filterView("filter").withProps({ labels: { search: "Search" } }),
      table: component("inspection-table").withProps({ rows: fromData("state.rows"), count: fromData("state.count") }),
    },
  })`, sourceVersion: 1, active: true }]
  const bundle: EndgeDomainBundle = {
    kind: 'workspace-snapshot',
    schemaVersion: 5,
    workspace: { identity: workspaceIdentity, displayName: 'Runtime inspection fixture', dataMode: 'development', managedBy: 'user', managedById: null, meta: {}, configuration: createDefaultEndgeConfiguration() },
    installedIntegrations: [],
    documents,
  }
  await Endge.boot({ dataProvider: 'bundle', bundleSource: bundle, scope: { workspaceIdentity }, vars: {}, bridge: { role: 'client', allowedServers: [serverUrl], debug: true, label: 'Runtime inspection fixture' } })
  const graph = Endge.program.getArtifact('composition', 'inspection-graph')
  if (graph?.status === 'error') {
    throw new Error(JSON.stringify(graph.diagnostics))
  }
  await Endge.runtime.composition.mount('inspection-graph', { id: 'inspection-first' })
  await Endge.runtime.composition.mount('inspection-graph', { id: 'inspection-second' })
  Endge.runtime.getRuntimeHostsByEntity('store', 'inspection-store').forEach((host, index) => {
    const store = host as StoreRuntimeHost
    store.set('count', index * 10)
    store.set('rows', [{ id: index + 1, label: `Client instance ${index + 1}` }])
  })
  const output = document.querySelector('pre')!
  const render = () => {
    output.textContent = JSON.stringify({ connections: Endge.bridge.connections.map(item => ({ status: item.status, error: item.error })), consent: Boolean(Endge.bridge.debug.pendingConsent), hosts: Endge.runtime.snapshot().hosts.map(host => ({ id: host.id, status: host.status })), data: Endge.runtime.getRuntimeHostsByEntity('store', 'inspection-store').map(host => (host as StoreRuntimeHost).getDataSnapshot()) }, null, 2)
  }
  Endge.bridge.subscribe(render)
  Endge.bridge.debug.subscribe(render)
  Endge.runtime.subscribe(render)
  Endge.events.onEvent('runtime:host-status-changed', render)
  document.querySelector('[data-consent]')!.addEventListener('click', () => {
    const consent = Endge.bridge.debug.pendingConsent
    if (consent) {
      Endge.bridge.debug.respondToConsent(consent, true)
    }
  })
  document.querySelector('[data-change]')!.addEventListener('click', () => {
    for (const host of Endge.runtime.getRuntimeHostsByEntity('store', 'inspection-store') as StoreRuntimeHost[]) {
      const data = host.getDataSnapshot()
      host.set('count', Number(data.count ?? 0) + 1)
    }
    render()
  })
  document.querySelector('[data-disconnect]')!.addEventListener('click', () => Endge.bridge.disconnect(serverUrl))
  render()
}

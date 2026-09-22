import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RemoteDebugger_Module } from '@/features/remote-debugger/RemoteDebugger_Module'

const state = vi.hoisted(() => ({
  listeners: [] as Array<() => void>,
  clients: [{ serverUrl: 'http://localhost', instanceId: 'aodb', label: 'AODB' }],
  request: vi.fn(),
  start: vi.fn(),
  end: vi.fn(async () => {}),
  install: vi.fn(),
}))
vi.mock('@endge/core', () => ({
  readEndgeBundle: (value: unknown) => value,
  Endge: {
    bridge: {
      connections: [{ status: 'connected' }],
      subscribe: (fn: () => void) => {
        state.listeners.push(fn)
        return () => {}
      },
      debug: {
        clients: state.clients,
        sessions: [],
        subscribe: (fn: () => void) => {
          state.listeners.push(fn)
          return () => {}
        },
        requestSession: state.request,
        startContextSync: state.start,
        endSession: state.end,
      },
    },
    inspection: { subscribe: () => () => {} },
    installDebuggerBundle: state.install,
  },
}))
vi.mock('@/app/services/BundleFiles_Service', () => ({ BundleFiles_Service: class {} }))
vi.mock('@/features/endge-ide/EndgeIDE', () => ({ EndgeIDE: {} }))

beforeEach(() => {
  state.listeners.length = 0
  vi.clearAllMocks()
})

describe('ошибки и ожидание подключения инспектора', () => {
  it('сохраняет точную ошибку экспорта после обновления roster и позволяет повторить подключение', async () => {
    const session = { sessionId: 'session', serverUrl: 'http://localhost' }
    state.request.mockResolvedValue(session)
    state.start.mockRejectedValue(new Error('[Bundle] Missing artifact dependency: action:missing'))
    const module = new RemoteDebugger_Module()
    module.init()
    await module.select(state.clients[0]!)
    state.listeners.forEach(fn => fn())
    expect(module.status.value).toBe('[Bundle] Missing artifact dependency: action:missing')
    expect(module.inspectionBusy.value).toBe(false)
    expect(module.connected.value).toBe(false)
    expect(state.end).toHaveBeenCalledWith('session')
    expect(state.install).not.toHaveBeenCalled()
    await module.select(state.clients[0]!)
    expect(state.request).toHaveBeenCalledTimes(2)
    module.dispose()
  })

  it('не заменяет ожидание согласия предложением снова выбрать приложение', async () => {
    let reject!: (error: Error) => void
    state.request.mockImplementation(() => new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise
    }))
    const module = new RemoteDebugger_Module()
    module.init()
    const pending = module.select(state.clients[0]!)
    state.listeners.forEach(fn => fn())
    expect(module.status.value).toBe('Ожидание подтверждения в приложении…')
    reject(new Error('Client declined the connection'))
    await pending
    expect(module.status.value).toBe('Client declined the connection')
    module.dispose()
  })

  it('ошибка нового подключения сохраняет открытую файловую инспекцию', async () => {
    state.request.mockRejectedValue(new Error('Connection failed'))
    const module = new RemoteDebugger_Module()
    module.init()
    module.source.value = 'file'
    module.fileName.value = 'saved.endge-bundle.gz'
    await module.select(state.clients[0]!)
    state.listeners.forEach(fn => fn())
    expect(module.source.value).toBe('file')
    expect(module.fileName.value).toBe('saved.endge-bundle.gz')
    expect(module.status.value).toBe('Connection failed')
    expect(state.install).not.toHaveBeenCalled()
    module.dispose()
  })
})

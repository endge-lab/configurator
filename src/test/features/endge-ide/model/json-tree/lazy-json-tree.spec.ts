/* eslint-disable style/max-statements-per-line */
import type { LazyJsonValueNode } from '@/features/endge-ide/model/json-tree/lazy-json-tree'

import { describe, expect, it } from 'vitest'

import {
  createLazyJsonChildren,
  DEFAULT_JSON_TREE_EAGER_LIMIT,
  DEFAULT_JSON_TREE_PAGE_SIZE,
  lazyJsonNodeSummary,
  shouldAutoExpandLazyJsonNode,
} from '@/features/endge-ide/model/json-tree/lazy-json-tree'

const options = {
  eagerLimit: DEFAULT_JSON_TREE_EAGER_LIMIT,
  pageSize: DEFAULT_JSON_TREE_PAGE_SIZE,
}

function root(value: unknown): LazyJsonValueNode {
  return {
    kind: 'value',
    key: 'root',
    path: 'root',
    value,
    ancestors: [],
  }
}

describe('lazy JSON tree planning', () => {
  it('does not read 10k array items before a range is expanded', () => {
    let itemReads = 0
    const rows = new Proxy(
      Array.from({ length: 10_000 }, (_, index) => ({ id: index, flight: `GH${index}` })),
      {
        get(target, property, receiver) {
          if (typeof property === 'string' && /^\d+$/.test(property)) { itemReads += 1 }
          return Reflect.get(target, property, receiver)
        },
      },
    )

    const ranges = createLazyJsonChildren(root(rows), options)
    expect(ranges).toHaveLength(100)
    expect(ranges[0]).toMatchObject({ kind: 'range', key: '[0…99]', start: 0, end: 100 })
    expect(ranges[99]).toMatchObject({ kind: 'range', key: '[9900…9999]', start: 9_900, end: 10_000 })
    expect(itemReads).toBe(0)

    const firstPage = createLazyJsonChildren(ranges[0], options)
    expect(firstPage).toHaveLength(100)
    expect(firstPage[0]).toMatchObject({ kind: 'value', key: '0', value: { id: 0, flight: 'GH0' } })
    expect(itemReads).toBe(100)
    expect(shouldAutoExpandLazyJsonNode(ranges[0], 1, 2)).toBe(false)
  })

  it('materializes collections of up to 100 items directly', () => {
    const values = Array.from({ length: 100 }, (_, index) => index)
    const children = createLazyJsonChildren(root(values), options)

    expect(children).toHaveLength(100)
    expect(children.every(node => node.kind === 'value')).toBe(true)
    expect(shouldAutoExpandLazyJsonNode(root(values), 0, 2)).toBe(true)
  })

  it('keeps fan-out bounded for collections much larger than one page', () => {
    const millionRows = Array.from({ length: 1_000_000 })
    const levelOne = createLazyJsonChildren(root(millionRows), options)
    expect(levelOne).toHaveLength(100)
    expect(levelOne[0]).toMatchObject({ kind: 'range', start: 0, end: 10_000 })

    const levelTwo = createLazyJsonChildren(levelOne[0], options)
    expect(levelTwo).toHaveLength(100)
    expect(levelTwo[0]).toMatchObject({ kind: 'range', start: 0, end: 100 })
  })

  it('stops circular branches without traversing them', () => {
    const value: Record<string, unknown> = {}
    value.self = value
    const self = createLazyJsonChildren(root(value), options)[0] as LazyJsonValueNode

    expect(lazyJsonNodeSummary(self)).toBe('Object(1)')
    expect(createLazyJsonChildren(self, options)).toEqual([])
  })
})

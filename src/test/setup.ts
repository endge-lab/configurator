import { Raph } from '@raphy-js/raph'
import { beforeEach } from 'vitest'

if (!Raph.configured) {
  Raph.configure({ mode: 'runtime' })
}

beforeEach(() => {
  if (!Raph.configured) {
    Raph.configure({ mode: 'runtime' })
  }
})

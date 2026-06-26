export type FrequencyDay = 1 | 2 | 3 | 4 | 5 | 6 | 7

export function parseDaysOfWeek(input?: unknown): Set<FrequencyDay> {
  const out = new Set<FrequencyDay>()
  const s = String(input ?? '').trim()
  if (!s)
    return out

  const tokens = s.split(',').map(t => t.trim()).filter(Boolean)

  for (const token of tokens) {
    const m = token.match(/^(\d)\s*-\s*(\d)$/)
    if (m) {
      const a = Math.min(Number(m[1]), Number(m[2]))
      const b = Math.max(Number(m[1]), Number(m[2]))
      for (let i = a; i <= b; i++) {
        if (i >= 1 && i <= 7)
          out.add(i as FrequencyDay)
      }
      continue
    }

    const n = Number(token)
    if (Number.isFinite(n) && n >= 1 && n <= 7)
      out.add(n as FrequencyDay)
  }

  return out
}

export function buildDaysOfWeekString(set: Set<FrequencyDay>): string {
  return Array.from(set).sort((a, b) => a - b).join(',')
}

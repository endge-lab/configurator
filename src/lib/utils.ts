import type { ClassValue } from 'clsx'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base }
  for (const key of Object.keys(override || {})) {
    const b = (base as any)[key]
    const o = (override as any)[key]
    if (o && typeof o === 'object' && !Array.isArray(o) && b && typeof b === 'object' && !Array.isArray(b))
      out[key] = deepMerge(b, o)
    else
      out[key] = o
  }
  return out as T
}

export function remToPx(value: number) {
  const fontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return value * fontSize
}

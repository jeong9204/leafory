import { internalPath, navigationSession } from './navigation'

export type DetailTab = 'timeline' | 'photos'
export interface DetailPosition {
  href: string
  y: number
  tab: DetailTab
  nativeMode: 'auto' | 'manual'
}
const memory = new Map<string, DetailPosition>()
const storageKey = () =>
  `leafory.plant-detail.positions.v1:${navigationSession()}`
function valid(value: unknown): value is DetailPosition {
  if (!value || typeof value !== 'object') return false
  const p = value as DetailPosition
  return (
    Boolean(internalPath(p.href)) &&
    Number.isFinite(p.y) &&
    p.y >= 0 &&
    p.y <= 10000000 &&
    (p.tab === 'timeline' || p.tab === 'photos') &&
    (p.nativeMode === 'auto' || p.nativeMode === 'manual')
  )
}
function readEntries(): [string, DetailPosition][] {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(storageKey()) ?? '[]',
    )
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (entry): entry is [string, DetailPosition] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          entry[0].length < 128 &&
          valid(entry[1]),
      )
      .slice(-40)
  } catch {
    return []
  }
}
/** Same-tab UI coordinates only; never stores plants, records or photo Blobs. */
export function readDetailPosition(key: string, href: string) {
  const position = memory.get(key) ?? new Map(readEntries()).get(key)
  return position?.href === href ? position : undefined
}
export function saveDetailPosition(key: string, position: DetailPosition) {
  if (!valid(position)) return
  memory.delete(key)
  memory.set(key, position)
  if (memory.size > 40) memory.delete(memory.keys().next().value!)
  try {
    const entries = new Map(readEntries())
    entries.delete(key)
    entries.set(key, position)
    sessionStorage.setItem(
      storageKey(),
      JSON.stringify([...entries].slice(-40)),
    )
  } catch {
    /* In-memory restoration still works if storage is restricted. */
  }
}
export function validScrollY(
  requested: number,
  height: number,
  viewport: number,
) {
  return Math.min(Math.max(0, requested), Math.max(0, height - viewport))
}

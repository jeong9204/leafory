import { navigationSession } from './navigation'

export interface RecordPosition {
  filter: string
  count: number
  y: number
}
const storageKey = () => `leafory.records.positions.v1:${navigationSession()}`
function read(): [string, RecordPosition][] {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(storageKey()) ?? '[]',
    )
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (entry): entry is [string, RecordPosition] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          entry[0].length < 128 &&
          entry[1] &&
          typeof entry[1].filter === 'string' &&
          entry[1].filter.length < 128 &&
          Number.isSafeInteger(entry[1].count) &&
          entry[1].count >= 30 &&
          entry[1].count <= 1000000 &&
          Number.isFinite(entry[1].y) &&
          entry[1].y >= 0,
      )
      .slice(-40)
  } catch {
    return []
  }
}
/** Optional same-tab UI restoration only. No record contents or photo data. */
export function readRecordPosition(key: string) {
  return new Map(read()).get(key)
}
export function saveRecordPosition(key: string, position: RecordPosition) {
  try {
    const entries = new Map(read())
    entries.delete(key)
    entries.set(key, position)
    sessionStorage.setItem(
      storageKey(),
      JSON.stringify([...entries].slice(-40)),
    )
  } catch {
    /* The in-memory store remains available if browser storage is blocked. */
  }
}

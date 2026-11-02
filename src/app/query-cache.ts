/** Short-lived, provider-scoped read-only view snapshots. Never persisted. */
export class QueryCache {
  private entries = new Map<
    string,
    { data: unknown; expires: number; bytes: number }
  >()
  generation = 0
  private now: () => number
  constructor(now: () => number = Date.now) {
    this.now = now
  }
  clear() {
    this.generation++
    this.entries.clear()
  }
  remove(key: string) {
    this.entries.delete(key)
  }
  get<T>(key: string): { data: T } | undefined {
    const entry = this.entries.get(key)
    if (!entry) return
    if (entry.expires <= this.now()) {
      this.entries.delete(key)
      return
    }
    return { data: entry.data as T }
  }
  put(key: string, data: unknown, generation: number) {
    if (generation !== this.generation) return
    const seen = new Set<object>()
    const size = (value: unknown): number => {
      if (!value || typeof value !== 'object' || seen.has(value)) return 0
      seen.add(value)
      if (value instanceof Blob) return value.size
      return Object.values(value).reduce<number>(
        (sum, child) => sum + size(child),
        0,
      )
    }
    const bytes = size(data)
    this.entries.delete(key)
    if (bytes > 16 * 1024 * 1024) return
    for (const [oldKey, entry] of this.entries) {
      if (entry.expires <= this.now()) this.entries.delete(oldKey)
    }
    this.entries.set(key, { data, bytes, expires: this.now() + 60_000 })
    while (
      this.entries.size > 8 ||
      [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0) >
        16 * 1024 * 1024
    ) {
      this.entries.delete(this.entries.keys().next().value!)
    }
  }
}

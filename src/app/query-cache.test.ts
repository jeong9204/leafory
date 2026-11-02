import { describe, expect, it } from 'vitest'
import { QueryCache } from './query-cache'
describe('bounded view snapshots', () => {
  it('expires after 60 seconds and isolates providers', () => {
    let now = 0
    const cache = new QueryCache(() => now)
    cache.put('plant:a', { name: 'A' }, 0)
    expect(cache.get('plant:a')).toEqual({ data: { name: 'A' } })
    expect(new QueryCache().get('plant:a')).toBeUndefined()
    now = 60_000
    expect(cache.get('plant:a')).toBeUndefined()
  })
  it('bounds entries and Blob retention without altering Blobs', () => {
    const cache = new QueryCache()
    for (let i = 0; i < 9; i++) cache.put(String(i), i, 0)
    expect(cache.get('0')).toBeUndefined()
    const photo = new Blob([new Uint8Array(9 * 1024 * 1024)])
    cache.put('a', { photo, same: photo }, 0)
    expect(cache.get('a')).toBeDefined()
    cache.put('b', new Blob([new Uint8Array(9 * 1024 * 1024)]), 0)
    expect(cache.get('a')).toBeUndefined()
    expect(photo.size).toBe(9 * 1024 * 1024)
    cache.put('huge', new Blob([new Uint8Array(17 * 1024 * 1024)]), 0)
    expect(cache.get('huge')).toBeUndefined()
  })
  it('rejects late results after mutation or restore invalidation', () => {
    const cache = new QueryCache()
    const generation = cache.generation
    cache.put('old', 'old', generation)
    cache.clear()
    cache.put('late', 'stale', generation)
    expect(cache.get('old')).toBeUndefined()
    expect(cache.get('late')).toBeUndefined()
    cache.put('new', 'fresh', cache.generation)
    expect(cache.get('new')).toEqual({ data: 'fresh' })
    cache.remove('new')
    expect(cache.get('new')).toBeUndefined()
  })
})

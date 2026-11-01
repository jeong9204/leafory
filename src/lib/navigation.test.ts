import { describe, expect, it } from 'vitest'
import { internalPath, returnOrigin } from './navigation'
import { readRecordPosition, saveRecordPosition } from './record-position'
const session = 'test-session'
const source = {
  version: 1,
  session,
  href: '/records?type=diary&plant=abc',
  key: 'records',
  index: 2,
}
const current = { href: '/plants/new', key: 'detail', index: 3 }
describe('safe internal back provenance', () => {
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/records/../calendar',
    '/unknown',
    '/records\n',
    '/%2f%2fevil.example',
  ])('rejects unsafe or unknown path %s', (path) => {
    expect(internalPath(path)).toBeUndefined()
  })
  it('retains internal query and anchor without rewriting them', () => {
    expect(internalPath('/records?type=diary&plant=abc')).toBe(source.href)
    expect(
      internalPath(
        '/plants/c13d892e-140d-491a-8087-a8bcd80bab01#care-event-abc',
      ),
    ).toBeTruthy()
  })
  it('accepts a same-session adjacent internal predecessor', () => {
    expect(
      returnOrigin({ leaforyNavigation: source }, session, current),
    ).toEqual(source)
  })
  it.each([
    { index: 0 },
    { index: 2 },
    { index: 4 },
    { key: 'records' },
    { href: source.href },
  ])('rejects direct/new-tab, nonadjacent or self history %j', (override) => {
    expect(
      returnOrigin({ leaforyNavigation: source }, session, {
        ...current,
        ...override,
      }),
    ).toBeUndefined()
  })
  it.each([
    null,
    {},
    { leaforyNavigation: null },
    { leaforyNavigation: { ...source, session: 'other' } },
    { leaforyNavigation: { ...source, href: 'https://evil.example' } },
    { leaforyNavigation: { ...source, index: -1 } },
  ])('rejects absent or invalid provenance %j', (state) => {
    expect(returnOrigin(state, session, current)).toBeUndefined()
  })
  it('persists only bounded UI position metadata across module consumers', () => {
    saveRecordPosition('records-test', { filter: 'diary:', count: 60, y: 730 })
    expect(readRecordPosition('records-test')).toEqual({
      filter: 'diary:',
      count: 60,
      y: 730,
    })
    for (let i = 0; i < 41; i++)
      saveRecordPosition(`bounded-${i}`, { filter: 'all:', count: 30, y: i })
    expect(readRecordPosition('bounded-0')).toBeUndefined()
    expect(readRecordPosition('bounded-40')?.y).toBe(40)
  })
})

import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isArchivedPixelArt } from './pwa-plugin'

describe('보존용 painted 에셋만 precache 제외', () => {
  it('기존 원본 20종은 모두 보존용으로 구분한다', () => {
    const files = readdirSync('public/pixel/painted').filter((name) =>
      name.endsWith('.webp'),
    )
    expect(files).toHaveLength(20)
    for (const name of files)
      expect(isArchivedPixelArt(`pixel/painted/${name}`)).toBe(true)
  })
  it.each([
    'pixel/refined/adenium.webp',
    'pixel/refined/euphorbia-bupleurifolia.webp',
    'pixel/painted/README.md',
    'pixel/wood.svg',
    'pixel/painted-elsewhere/adenium.webp',
    'images/painted/adenium.webp',
    'pixel/painted/nested/adenium.webp',
    'pixel/painted/adenium.webp.json',
    'icons/icon-192.png',
    'manifest.webmanifest',
    'assets/entry.js',
  ])('다른 리소스 %s는 제외하지 않는다', (path) => {
    expect(isArchivedPixelArt(path)).toBe(false)
  })
})

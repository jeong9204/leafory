import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import approvedHashes from '../../test/fixtures/refined-assets.sha256.json'
import { pixelAsset, pixelDimensions, refinedAssets } from './pixel-assets'

describe('승인 에셋 연결', () => {
  it.each(Object.keys(refinedAssets))(
    '%s는 승인 원본 SHA-256과 일치한다',
    (art) => {
      expect(pixelAsset(art)).toBe(`/pixel/refined/${art}.webp`)
      expect(
        createHash('sha256')
          .update(readFileSync(`public${pixelAsset(art)}`))
          .digest('hex'),
      ).toBe(approvedHashes[`${art}.webp` as keyof typeof approvedHashes])
    },
  )
  it('장식의 실제 종횡비를 명시하고 기존 SVG 경로도 유지한다', () => {
    expect(pixelDimensions('cat')).toEqual([192, 120])
    expect(pixelDimensions('ivy')).toEqual([120, 339])
    expect(pixelAsset('wood')).toBe('/pixel/wood.svg')
    expect(pixelDimensions('wood')).toEqual([80, 96])
  })
})

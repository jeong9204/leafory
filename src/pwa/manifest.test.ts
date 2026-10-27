import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
describe('Leafory 설치 메타데이터', () => {
  const manifest = JSON.parse(
    readFileSync('public/manifest.webmanifest', 'utf8'),
  )
  it('이름·고정 ID·시작 URL·범위·standalone을 정의한다', () => {
    expect(manifest).toMatchObject({
      id: '/',
      short_name: 'Leafory',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#F7F4EB',
    })
  })
  it('192/512 일반 및 maskable PNG와 iOS 아이콘의 실제 크기가 맞는다', () => {
    for (const [file, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const) {
      const png = readFileSync(`public/icons/${file}`)
      expect(png.subarray(1, 4).toString()).toBe('PNG')
      expect(png.readUInt32BE(16)).toBe(size)
      expect(png.readUInt32BE(20)).toBe(size)
    }
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]),
    )
  })
  it('같은 출처 Manifest를 인증 세션과 함께 요청하고 Apple touch icon을 연결한다', () => {
    const html = readFileSync('index.html', 'utf8')
    const link = html.match(/<link\s[^>]*rel="manifest"[^>]*>/)?.[0]
    expect(link).toContain('href="/manifest.webmanifest"')
    expect(link).toContain('crossorigin="use-credentials"')
    expect(html).toContain('rel="apple-touch-icon"')
  })
})

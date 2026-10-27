import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  framework: string
  buildCommand: string
  installCommand: string
  outputDirectory: string
  headers: { source: string; headers: { key: string; value: string }[] }[]
  rewrites: { source: string; destination: string }[]
}
// Only the literal and /:path* patterns used in this config; this is not a Vercel emulator.
function destination(url: string) {
  const path = new URL(url, 'https://preview.example.test').pathname
  return config.rewrites.find((rule) => {
    if (!rule.source.endsWith('/:path*')) return rule.source === path
    const base = rule.source.split('/:path*')[0]
    return path === base || path.startsWith(`${base}/`)
  })?.destination
}
const headers = (source: string) =>
  Object.fromEntries(
    config.headers
      .find((rule) => rule.source === source)!
      .headers.map((header) => [header.key.toLowerCase(), header.value]),
  )

describe('Vercel Preview 설정 계약', () => {
  it('기존 Vite 빌드를 사용하고 dist만 배포 대상으로 지정한다', () => {
    expect(config).toMatchObject({
      framework: 'vite',
      installCommand: 'npm ci',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
    })
  })
  it('현재 앱의 중첩 경로와 query가 있는 캘린더를 index.html로 연결한다', () => {
    for (const path of [
      '/plants/new',
      '/plants/example',
      '/plants/example/edit',
      '/plants/example/diary/new',
      '/plants/example/diary/entry',
      '/plants/example/diary/entry/edit',
      '/plants/example/care/new',
      '/plants/example/care/event/edit',
      '/calendar?date=2026-10-27&plant=example',
      '/records',
      '/backup',
      '/install',
    ])
      expect(destination(path)).toBe('/index.html')
  })
  it('없는 정적 파일·서비스 워커·Manifest·API 요청을 SPA HTML로 바꾸지 않는다', () => {
    for (const path of [
      '/sw.js',
      '/manifest.webmanifest',
      '/assets/missing.js',
      '/icons/missing.png',
      '/images/missing.jpg',
      '/licenses/missing.txt',
      '/api/records',
      '/missing.js',
    ])
      expect(destination(path)).toBeUndefined()
  })
  it('SW와 Manifest는 재검증하고 올바른 MIME으로 제공하도록 지정한다', () => {
    expect(headers('/sw.js')).toMatchObject({
      'cache-control': 'no-cache',
      'content-type': 'application/javascript; charset=utf-8',
    })
    expect(headers('/manifest.webmanifest')).toMatchObject({
      'cache-control': 'no-cache',
      'content-type': 'application/manifest+json; charset=utf-8',
    })
    expect(headers('/')).toMatchObject({ 'cache-control': 'no-cache' })
    expect(headers('/index.html')).toMatchObject({
      'cache-control': 'no-cache',
    })
  })
  it('해시 에셋만 immutable로 지정하고 비해시 아이콘은 재검증한다', () => {
    expect(headers('/assets/:path*')['cache-control']).toContain('immutable')
    expect(headers('/icons/:path*')['cache-control']).toBe('no-cache')
  })
})

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import console from 'node:console'

const root = resolve('dist')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const sw = readFileSync(resolve(root, 'sw.js'), 'utf8')
const urls = JSON.parse(sw.match(/const ASSETS = (\[.*\]);/)[1])
assert.equal(urls.length, new Set(urls).size, '중복 precache URL')
for (const name of readdirSync(resolve(root, 'pixel/painted'))) {
  if (!name.endsWith('.webp')) continue
  readFileSync(resolve(root, 'pixel/painted', name))
  assert(
    !urls.includes(`/pixel/painted/${name}`),
    `보관용 원본이 precache에 포함됨: ${name}`,
  )
}
const refined = readdirSync(resolve(root, 'pixel/refined')).filter((name) =>
  name.endsWith('.webp'),
)
assert.equal(refined.length, 21, '승인된 신규 에셋 21종 필요')
for (const name of refined)
  assert(
    urls.includes(`/pixel/refined/${name}`),
    `신규 에셋 오프라인 캐시 누락: ${name}`,
  )
for (const name of readdirSync(resolve(root, 'assets'))) {
  if (!/\.(js|css)$/.test(name)) continue
  const source = readFileSync(resolve(root, 'assets', name), 'utf8')
  assert(
    !source.includes('/pixel/painted/'),
    `배포 앱에서 보관용 경로 사용: ${name}`,
  )
}
assert(urls.includes('/index.html'))
const manifest = JSON.parse(
  readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'),
)
assert.equal(manifest.display, 'standalone')
for (const path of urls) {
  assert(path.startsWith('/') && !path.includes('..'))
  assert(!path.endsWith('.map'))
  readFileSync(resolve(root, `.${path}`))
}
for (const name of readdirSync(resolve(root, 'assets'))) {
  if (/\.(js|css|woff2)$/.test(name))
    assert(urls.includes(`/assets/${name}`), `오프라인 캐시 누락: ${name}`)
}
for (const icon of manifest.icons) {
  const png = readFileSync(resolve(root, `.${icon.src}`))
  const [width, height] = icon.sizes.split('x').map(Number)
  assert.equal(png.readUInt32BE(16), width)
  assert.equal(png.readUInt32BE(20), height)
}
const entry = html.match(/<script[^>]+src="([^"]+\.js)"/)[1]
const visited = new Set()
function initialGraph(url) {
  if (visited.has(url)) return
  visited.add(url)
  const code = readFileSync(resolve(root, `.${url}`), 'utf8')
  for (const match of code.matchAll(
    /(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g,
  ))
    initialGraph(`/assets/${match[1].slice(2)}`)
}
initialGraph(entry)
const initial = [...visited].map((path) => {
  const code = readFileSync(resolve(root, `.${path}`))
  return {
    path,
    kB: (code.length / 1000).toFixed(2),
    gzipKB: (gzipSync(code).length / 1000).toFixed(2),
  }
})
console.log(
  `PWA 검증 통과: 셸·지연 청크·폰트·아이콘 ${urls.length}개 precache 포함`,
)
console.log('초기 정적 JS 그래프:', initial)
console.log(
  '초기 JS 합계(kB):',
  initial.reduce((sum, x) => sum + Number(x.kB), 0).toFixed(2),
)

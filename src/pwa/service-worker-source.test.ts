import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { serviceWorkerSource } from './service-worker-source'

function worker() {
  const stores = new Map<string, Map<string, Response>>()
  const listeners: Record<string, (event: unknown) => void> = {}
  const addAll = vi.fn(async (requests: Request[]) => {
    const store = stores.get('leafory-shell-v2')!
    for (const request of requests)
      store.set(
        new URL(request.url).pathname,
        new Response(request.url.endsWith('index.html') ? 'shell' : 'asset'),
      )
  })
  const caches = {
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name: string) => stores.delete(name)),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      return {
        addAll,
        match: async (path: string) => stores.get(name)?.get(path)?.clone(),
      }
    },
  }
  const windows: object[] = [{}]
  const skipWaiting = vi.fn(async () => {})
  const claim = vi.fn(async () => {})
  const network = vi.fn(async () => new Response('network'))
  runInNewContext(
    serviceWorkerSource('v2', [
      '/index.html',
      '/a.js',
      '/lazy.js',
      '/font.woff2',
    ]),
    {
      self: {
        location: { origin: 'https://leafory.test' },
        addEventListener: (name: string, fn: (event: unknown) => void) => {
          listeners[name] = fn
        },
        clients: { claim, matchAll: async () => windows },
        skipWaiting,
      },
      caches,
      fetch: network,
      URL,
      Request: class extends Request {
        constructor(path: string, options: RequestInit) {
          super(new URL(path, 'https://leafory.test'), options)
        }
      },
    },
  )
  function dispatch(type: string, fields: Record<string, unknown> = {}) {
    let task: Promise<unknown> | undefined
    listeners[type]({
      ...fields,
      waitUntil: (value: Promise<unknown>) => {
        task = value
      },
      respondWith: (value: Promise<unknown>) => {
        task = value
      },
    })
    return task
  }
  return {
    stores,
    caches,
    windows,
    skipWaiting,
    claim,
    network,
    addAll,
    dispatch,
  }
}

describe('앱 셸 서비스 워커', () => {
  it('모든 셸·지연 청크·폰트를 설치하고 자동 업데이트하지 않는다', async () => {
    const w = worker()
    await w.dispatch('install')
    expect(w.stores.get('leafory-shell-v2')?.size).toBe(4)
    expect(w.skipWaiting).not.toHaveBeenCalled()
  })
  it('설치 실패 시 새 캐시만 제거해 기존 버전을 보존한다', async () => {
    const w = worker()
    w.stores.set('leafory-shell-old', new Map())
    w.addAll.mockRejectedValueOnce(new Error('quota'))
    await expect(w.dispatch('install')).rejects.toThrow('quota')
    expect(w.stores.has('leafory-shell-v2')).toBe(false)
    expect(w.stores.has('leafory-shell-old')).toBe(true)
  })
  it('활성화할 때 이전 Leafory 셸만 삭제하고 다른 캐시는 보존한다', async () => {
    const w = worker()
    await w.dispatch('install')
    w.stores.set('leafory-shell-old', new Map())
    w.stores.set('other-app', new Map())
    await w.dispatch('activate')
    expect([...w.stores.keys()]).toEqual(['leafory-shell-v2', 'other-app'])
    expect(w.claim).toHaveBeenCalledOnce()
  })
  it('네트워크 없이 중첩 경로 앱 셸과 아직 방문하지 않은 지연 청크를 반환한다', async () => {
    const w = worker()
    await w.dispatch('install')
    w.network.mockRejectedValue(new Error('offline'))
    const navigation = (await w.dispatch('fetch', {
      request: {
        url: 'https://leafory.test/plants/id/diary/new',
        method: 'GET',
        mode: 'navigate',
      },
    })) as Response
    expect(await navigation.text()).toBe('shell')
    const lazy = (await w.dispatch('fetch', {
      request: {
        url: 'https://leafory.test/lazy.js',
        method: 'GET',
        mode: 'cors',
      },
    })) as Response
    expect(await lazy.text()).toBe('asset')
    const directAsset = (await w.dispatch('fetch', {
      request: {
        url: 'https://leafory.test/lazy.js',
        method: 'GET',
        mode: 'navigate',
      },
    })) as Response
    expect(await directAsset.text()).toBe('asset')
    expect(w.network).not.toHaveBeenCalled()
  })
  it.each([
    'https://outside.test/a.js',
    'https://leafory.test/api/records',
    'https://leafory.test/backup.zip',
    'blob:https://leafory.test/photo',
    'https://leafory.test/a.js?private=1',
  ])('%s은 서비스 워커 캐시에 저장하지 않는다', async (url) => {
    const w = worker()
    await w.dispatch('install')
    expect(
      w.dispatch('fetch', { request: { url, method: 'GET', mode: 'cors' } }),
    ).toBeUndefined()
    expect(w.stores.get('leafory-shell-v2')?.size).toBe(4)
  })
  it('POST 요청은 가로채지 않는다', () => {
    const w = worker()
    expect(
      w.dispatch('fetch', {
        request: { url: 'https://leafory.test/a.js', method: 'POST' },
      }),
    ).toBeUndefined()
  })
  it('여러 창이 열려 있으면 업데이트를 거절하고 창 하나에서 명시 요청하면 활성화한다', async () => {
    const w = worker()
    const postMessage = vi.fn()
    w.windows.push({})
    await w.dispatch('message', {
      data: { type: 'ACTIVATE_UPDATE' },
      source: { postMessage },
    })
    expect(postMessage).toHaveBeenCalledWith({ type: 'UPDATE_BLOCKED' })
    expect(w.skipWaiting).not.toHaveBeenCalled()
    w.windows.pop()
    await w.dispatch('message', {
      data: { type: 'ACTIVATE_UPDATE' },
      source: { postMessage },
    })
    expect(w.skipWaiting).toHaveBeenCalledOnce()
  })
  it('빌드 버전에 따라 캐시 이름을 구분한다', () => {
    expect(serviceWorkerSource('one', [])).not.toBe(
      serviceWorkerSource('two', []),
    )
  })
})

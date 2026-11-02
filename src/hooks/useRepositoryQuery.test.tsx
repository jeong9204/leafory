import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RepositoryProvider } from '../app/RepositoryProvider'
import { useRepositories } from '../app/repository-context'
import { testDatabase } from '../test/render-app'
import { useRepositoryQuery } from './useRepositoryQuery'
function View({
  query,
  cacheKey,
}: {
  query: () => Promise<string>
  cacheKey?: string
}) {
  const { result } = useRepositoryQuery(query, true, cacheKey)
  return <p>{result.status === 'success' ? result.data : result.status}</p>
}
function deferred() {
  let resolve!: (value: string) => void
  let reject!: (error: Error) => void
  const promise = new Promise<string>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function open(query: () => Promise<string>, cacheKey?: string) {
  const { db, repos } = testDatabase()
  let show!: (value: boolean) => void
  let invalidate!: () => void
  function Host() {
    const [visible, setVisible] = useState(true)
    const context = useRepositories()
    useEffect(() => {
      show = setVisible
      invalidate = context.invalidate
    }, [context.invalidate])
    return visible ? (
      <View query={query} cacheKey={cacheKey} />
    ) : (
      <p>other route</p>
    )
  }
  const view = render(
    <RepositoryProvider repositories={repos}>
      <Host />
    </RepositoryProvider>,
  )
  return {
    db,
    view,
    leave: () => act(() => show(false)),
    back: () => act(() => show(true)),
    invalidate: () => act(() => invalidate()),
  }
}
describe('read-only query back-navigation snapshots', () => {
  it('renders the previous view immediately, then refreshes without a loading replacement', async () => {
    const next = deferred()
    const query = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('previous')
      .mockReturnValueOnce(next.promise)
    const host = open(query, 'plant:a')
    await screen.findByText('previous')
    host.leave()
    host.back()
    expect(screen.getByText('previous')).toBeInTheDocument()
    expect(screen.queryByText('loading')).not.toBeInTheDocument()
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    await act(() => next.resolve('updated'))
    expect(screen.getByText('updated')).toBeInTheDocument()
    host.view.unmount()
    host.db.close()
  })
  it.each(['edit', 'delete', 'restore'])(
    '%s invalidation prevents stale data on remount',
    async () => {
      const next = deferred()
      const query = vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce('previous')
        .mockReturnValue(next.promise)
      const host = open(query, 'diary:a')
      await screen.findByText('previous')
      host.leave()
      host.invalidate()
      host.back()
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(screen.queryByText('previous')).not.toBeInTheDocument()
      await act(() => next.resolve('fresh'))
      expect(screen.getByText('fresh')).toBeInTheDocument()
      host.view.unmount()
      host.db.close()
    },
  )
  it('evicts a failed refresh and displays the error instead of a deleted view', async () => {
    const next = deferred()
    const query = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('previous')
      .mockReturnValue(next.promise)
    const host = open(query, 'diary:a')
    await screen.findByText('previous')
    host.leave()
    host.back()
    await act(() => next.reject(new Error('deleted')))
    expect(screen.getByText('error')).toBeInTheDocument()
    host.leave()
    host.back()
    expect(screen.getByText('loading')).toBeInTheDocument()
    host.view.unmount()
    host.db.close()
  })
  it('does not cache editors and other queries without an explicit key', async () => {
    const next = deferred()
    const query = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('previous')
      .mockReturnValue(next.promise)
    const host = open(query)
    await screen.findByText('previous')
    host.leave()
    host.back()
    expect(screen.getByText('loading')).toBeInTheDocument()
    host.view.unmount()
    host.db.close()
  })
})

describe('query freshness races', () => {
  it('ignores a late pre-invalidation request and caches only the refreshed result', async () => {
    const old = deferred()
    const fresh = deferred()
    const query = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValue(fresh.promise)
    const host = open(query, 'plant:a')
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    host.invalidate()
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    await act(() => fresh.resolve('fresh'))
    await act(() => old.resolve('stale'))
    expect(screen.getByText('fresh')).toBeInTheDocument()
    host.leave()
    host.back()
    expect(screen.getByText('fresh')).toBeInTheDocument()
    host.view.unmount()
    host.db.close()
  })
  it('does not display another plant snapshot when the query and route ID change', async () => {
    const { db, repos } = testDatabase()
    const first = () => Promise.resolve('plant A')
    const second = deferred()
    const other = () => second.promise
    const content = (query: () => Promise<string>, cacheKey: string) => (
      <RepositoryProvider repositories={repos}>
        <View query={query} cacheKey={cacheKey} />
      </RepositoryProvider>
    )
    const view = render(content(first, 'plant:a'))
    await screen.findByText('plant A')
    view.rerender(content(other, 'plant:b'))
    expect(screen.queryByText('plant A')).not.toBeInTheDocument()
    expect(screen.getByText('loading')).toBeInTheDocument()
    await act(() => second.resolve('plant B'))
    expect(screen.getByText('plant B')).toBeInTheDocument()
    view.unmount()
    db.close()
  })
})

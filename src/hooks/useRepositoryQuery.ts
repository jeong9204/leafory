import { useCallback, useEffect, useState } from 'react'
import { useRepositories } from '../app/repository-context'
export type QueryResult<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: T }
export function useRepositoryQuery<T>(
  query: () => Promise<T>,
  refreshOnFocus = true,
  cacheKey?: string,
) {
  const { revision, queryCache } = useRepositories()
  const [attempt, setAttempt] = useState(0)
  const [initial] = useState(() => ({
    query,
    snapshot: cacheKey ? queryCache.get<T>(cacheKey) : undefined,
  }))
  const [state, setState] = useState<{
    query: () => Promise<T>
    result: QueryResult<T>
  }>({
    query,
    result: initial.snapshot
      ? { status: 'success', data: initial.snapshot.data }
      : { status: 'loading' },
  })
  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  useEffect(() => {
    let current = true
    const generation = queryCache.generation
    Promise.resolve()
      .then(() => {
        if (current)
          setState((previous) => ({
            query,
            result:
              previous.query === query && previous.result.status === 'success'
                ? previous.result
                : { status: 'loading' },
          }))
        return query()
      })
      .then(
        (data) => {
          if (current && generation === queryCache.generation) {
            if (cacheKey) queryCache.put(cacheKey, data, generation)
            setState({ query, result: { status: 'success', data } })
          }
        },
        (error) => {
          if (current && generation === queryCache.generation) {
            if (cacheKey) queryCache.remove(cacheKey)
            setState({ query, result: { status: 'error', error } })
          }
        },
      )
    return () => {
      current = false
    }
  }, [query, revision, attempt, cacheKey, queryCache])
  useEffect(() => {
    if (!refreshOnFocus) return
    const visible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refreshOnFocus, reload])
  return {
    result:
      state.query === query
        ? state.result
        : ({ status: 'loading' } as QueryResult<T>),
    reload,
    warm: initial.query === query && Boolean(initial.snapshot),
  }
}

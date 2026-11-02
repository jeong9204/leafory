import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Repositories } from '../domain/repositories'
import { QueryCache } from './query-cache'
import { RepositoryContext } from './repository-context'
export function RepositoryProvider({
  repositories,
  children,
}: {
  repositories: Repositories
  children: ReactNode
}) {
  const [revision, setRevision] = useState(0)
  const { cache: queryCache } = useMemo(
    () => ({ repositories, cache: new QueryCache() }),
    [repositories],
  )
  const invalidate = useCallback(() => {
    queryCache.clear()
    setRevision((value) => value + 1)
  }, [queryCache])
  const value = useMemo(
    () => ({ repositories, revision, invalidate, queryCache }),
    [repositories, revision, invalidate, queryCache],
  )
  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  )
}

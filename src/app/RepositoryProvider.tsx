import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Repositories } from '../domain/repositories'
import { RepositoryContext } from './repository-context'
export function RepositoryProvider({
  repositories,
  children,
}: {
  repositories: Repositories
  children: ReactNode
}) {
  const [revision, setRevision] = useState(0)
  const invalidate = useCallback(() => setRevision((value) => value + 1), [])
  const value = useMemo(
    () => ({ repositories, revision, invalidate }),
    [repositories, revision, invalidate],
  )
  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  )
}

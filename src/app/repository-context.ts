import { createContext, useContext } from 'react'
import type { Repositories } from '../domain/repositories'
export interface RepositoryContextValue {
  repositories: Repositories
  revision: number
  invalidate: () => void
}
export const RepositoryContext = createContext<RepositoryContextValue | null>(
  null,
)
export function useRepositories() {
  const value = useContext(RepositoryContext)
  if (!value) throw new Error('RepositoryProvider가 필요합니다.')
  return value
}

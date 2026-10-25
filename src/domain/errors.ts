export type RepositoryErrorCode =
  'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'STORAGE'

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(
    code: RepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'RepositoryError'
    this.code = code
  }
}

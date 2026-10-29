/** UUID strings are checked at the repository boundary. */
export type UUID = string
export type LocalDate = string // YYYY-MM-DD, calendar date without timezone
export type IsoDateTime = string // ISO datetime with timezone; persisted as UTC

export interface Plant {
  id: UUID
  name: string
  species?: string
  acquiredAt?: LocalDate
  status: 'healthy' | 'observing' | 'concern'
  memo?: string
  coverPhotoId?: UUID
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
export interface DiaryEntry {
  id: UUID
  plantId: UUID
  entryDate: LocalDate
  condition: 'good' | 'normal' | 'concern'
  title?: string
  content?: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
export interface DiaryPhoto {
  id: UUID
  plantId: UUID
  entryId?: UUID
  blob: Blob
  mimeType: string
  capturedAt: IsoDateTime
  createdAt: IsoDateTime
  sortOrder: number
}
export interface CareEvent {
  id: UUID
  plantId: UUID
  eventType: 'watering' | 'grow_light' | 'repotting' | 'fertilizing'
  occurredAt: IsoDateTime
  durationMinutes?: number
  memo?: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** Transient local session; completed care records keep their existing shape. */
export interface GrowLightTimer {
  id: 'grow-light'
  sessionId: UUID
  plantId: UUID
  startedAt: IsoDateTime
  status: 'running' | 'paused'
  runningSince?: IsoDateTime
  accumulatedMs: number
  revision: number
  updatedAt: IsoDateTime
}

export type CreateInput<T extends { id: UUID; createdAt: string }> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
> & { id?: UUID }
export type UpdateInput<T> = Partial<
  Omit<T, 'id' | 'plantId' | 'createdAt' | 'updatedAt'>
>

export type TimelineRecord =
  | { id: UUID; recordType: 'diary'; date: LocalDate; record: DiaryEntry }
  | { id: UUID; recordType: 'care_event'; date: LocalDate; record: CareEvent }

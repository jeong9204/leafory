import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  CareEvent,
  DiaryEntry,
  DiaryPhoto,
  Plant,
  GrowLightTimer,
} from '../../domain/models'

/** Additive migrations only; never reset existing user tables. */
export class LeaforyDatabase extends Dexie {
  plants!: Table<Plant, string>
  diaries!: Table<DiaryEntry, string>
  photos!: Table<DiaryPhoto, string>
  careEvents!: Table<CareEvent, string>
  timerState!: Table<GrowLightTimer, string>

  constructor(name = 'leafory') {
    super(name)
    this.version(1).stores({
      plants: 'id, createdAt',
      diaries: 'id, plantId, [plantId+entryDate]',
      photos: 'id, plantId, entryId, [plantId+sortOrder]',
      careEvents: 'id, plantId, [plantId+occurredAt], [plantId+eventType]',
    })
    this.version(2).stores({ timerState: 'id, plantId' })
  }
}

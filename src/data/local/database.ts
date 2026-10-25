import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  CareEvent,
  DiaryEntry,
  DiaryPhoto,
  Plant,
} from '../../domain/models'

/** Constructor defines schema only; app code does not instantiate/open this database yet. */
export class LeaforyDatabase extends Dexie {
  plants!: Table<Plant, string>
  diaries!: Table<DiaryEntry, string>
  photos!: Table<DiaryPhoto, string>
  careEvents!: Table<CareEvent, string>

  constructor(name = 'leafory') {
    super(name)
    this.version(1).stores({
      plants: 'id, createdAt',
      diaries: 'id, plantId, [plantId+entryDate]',
      photos: 'id, plantId, entryId, [plantId+sortOrder]',
      careEvents: 'id, plantId, [plantId+occurredAt], [plantId+eventType]',
    })
  }
}

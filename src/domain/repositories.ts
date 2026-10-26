import type { LocalDataSnapshot, DataCounts } from './backup'
import type {
  CareEvent,
  CreateInput,
  DiaryEntry,
  DiaryPhoto,
  Plant,
  TimelineRecord,
  UpdateInput,
  UUID,
  LocalDate,
  IsoDateTime,
} from './models'

export interface EntityRepository<T extends { id: UUID; createdAt: string }> {
  create(input: CreateInput<T>): Promise<T>
  getById(id: UUID): Promise<T | undefined>
  update(id: UUID, patch: UpdateInput<T>): Promise<T>
  delete(id: UUID): Promise<void>
}
export interface PlantRepository extends EntityRepository<Plant> {
  list(): Promise<Plant[]>
}
export interface PlantChildRepository<
  T extends { id: UUID; plantId: UUID; createdAt: string },
> extends EntityRepository<T> {
  listByPlant(plantId: UUID): Promise<T[]>
}
export interface PlantQueries {
  recentTimeline(plantId: UUID, limit?: number): Promise<TimelineRecord[]>
  lastWateringAt(plantId: UUID): Promise<IsoDateTime | undefined>
  daysSinceLastWatering(
    plantId: UUID,
    today?: LocalDate,
  ): Promise<number | undefined>
  growLightMinutes(plantId: UUID, date: LocalDate): Promise<number>
  totalRecordCount(plantId: UUID): Promise<number>
}
export interface Repositories {
  backup: {
    snapshot(): Promise<LocalDataSnapshot>
    counts(): Promise<DataCounts>
    replace(data: LocalDataSnapshot): Promise<void>
  }
  runInTransaction<T>(
    work: (repositories: Repositories) => Promise<T>,
  ): Promise<T>
  plants: PlantRepository
  diaries: PlantChildRepository<DiaryEntry>
  photos: PlantChildRepository<DiaryPhoto>
  careEvents: PlantChildRepository<CareEvent>
  queries: PlantQueries
}

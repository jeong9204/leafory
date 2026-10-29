// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { LeaforyDatabase } from '../data/local/database'
import { createLocalRepositories } from '../data/local/repositories'
import { loadBookshelf } from './bookshelf-service'
let db: LeaforyDatabase
let repos: ReturnType<typeof createLocalRepositories>
beforeEach(() => {
  db = new LeaforyDatabase(`shelf-${crypto.randomUUID()}`)
  repos = createLocalRepositories(db)
})
afterEach(async () => {
  await db.delete()
  vi.restoreAllMocks()
})
describe('책장 홈 조회', () => {
  it('빈 DB를 변경하거나 샘플을 추가하지 않는다', async () => {
    expect(await loadBookshelf(repos, '2026-10-29')).toEqual({
      views: [],
      records: [],
      weekCount: 0,
    })
    expect(await repos.plants.list()).toEqual([])
  })
  it('기록으로만 상태를 계산하고 사진 Blob은 조회하지 않는다', async () => {
    const plant = await repos.plants.create({
      name: '초록이',
      status: 'healthy',
    })
    await repos.careEvents.create({
      plantId: plant.id,
      eventType: 'watering',
      occurredAt: '2026-01-01T01:00:00Z',
    })
    await repos.careEvents.create({
      plantId: plant.id,
      eventType: 'grow_light',
      occurredAt: '2026-10-28T00:00:00Z',
      durationMinutes: 100,
    })
    await repos.careEvents.create({
      plantId: plant.id,
      eventType: 'grow_light',
      occurredAt: '2026-10-29T00:00:00Z',
      durationMinutes: 45,
    })
    const photo = vi.spyOn(repos.photos, 'listByPlant')
    const getPhoto = vi.spyOn(repos.photos, 'getById')
    const result = await loadBookshelf(repos, '2026-10-29')
    expect(result.views[0]).toMatchObject({
      plant: { status: 'healthy' },
      lastWatered: '2026-01-01T01:00:00.000Z',
      lightMinutes: 45,
    })
    expect(result.weekCount).toBe(2)
    expect(photo).not.toHaveBeenCalled()
    expect(getPhoto).not.toHaveBeenCalled()
    expect((await repos.plants.getById(plant.id))?.status).toBe('healthy')
  })
  it('일기·관리 기록 변경과 삭제를 다시 조회하면 즉시 반영한다', async () => {
    const plant = await repos.plants.create({
      name: '초록이',
      status: 'healthy',
    })
    const diary = await repos.diaries.create({
      plantId: plant.id,
      entryDate: '2026-10-29',
      condition: 'good',
      title: '새잎',
    })
    const light = await repos.careEvents.create({
      plantId: plant.id,
      eventType: 'grow_light',
      occurredAt: '2026-10-29T00:00:00Z',
      durationMinutes: 30,
    })
    expect((await loadBookshelf(repos, '2026-10-29')).weekCount).toBe(2)
    await repos.careEvents.update(light.id, { durationMinutes: 60 })
    expect(
      (await loadBookshelf(repos, '2026-10-29')).views[0].lightMinutes,
    ).toBe(60)
    await repos.careEvents.delete(light.id)
    await repos.diaries.delete(diary.id)
    const result = await loadBookshelf(repos, '2026-10-29')
    expect(result.weekCount).toBe(0)
    expect(result.views[0].lightMinutes).toBeUndefined()
    expect(result.records).toEqual([])
  })
})

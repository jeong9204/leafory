// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDatabase } from '../test/render-app'
import { loadGrowthPhotos } from './growth-service'
import { deleteDiary } from './diary-service'

let context: ReturnType<typeof testDatabase>
let plantId: string
beforeEach(async () => {
  context = testDatabase()
  plantId = (
    await context.repos.plants.create({ name: '성장 식물', status: 'healthy' })
  ).id
})
afterEach(async () => {
  vi.restoreAllMocks()
  await context.db.delete()
})
async function diary(date: string) {
  return context.repos.diaries.create({
    plantId,
    entryDate: date,
    condition: 'good',
    title: `${date} 관찰`,
  })
}
async function photo(entryId?: string, sortOrder = 0, text = 'image') {
  return context.repos.photos.create({
    plantId,
    entryId,
    sortOrder,
    blob: new Blob([text], { type: 'image/png' }),
    mimeType: 'image/png',
    capturedAt: '2026-10-27T10:00:00Z',
  })
}

describe('성장 비교 읽기 모델', () => {
  it('사진 없는 식물은 빈 배열을 반환한다', async () => {
    expect((await loadGrowthPhotos(context.repos, plantId)).photos).toEqual([])
  })
  it('단독 대표 사진은 제외하고 일기에 연결된 사진 한 장은 포함한다', async () => {
    const cover = await photo()
    await context.repos.plants.update(plantId, { coverPhotoId: cover.id })
    const entry = await diary('2026-01-02')
    const attached = await photo(entry.id)
    const result = await loadGrowthPhotos(context.repos, plantId)
    expect(result.photos.map((p) => p.id)).toEqual([attached.id])
    expect(result.photos[0].date).toBe('2026-01-02')
  })
  it('촬영 시각 대신 일기 날짜 오름차순, 같은 일기의 사진은 sortOrder로 정렬한다', async () => {
    const recent = await diary('2026-10-25')
    const old = await diary('2025-01-01')
    const last = await photo(recent.id)
    const second = await photo(old.id, 1)
    const first = await photo(old.id, 0)
    expect(
      (await loadGrowthPhotos(context.repos, plantId)).photos.map((p) => p.id),
    ).toEqual([first.id, second.id, last.id])
  })
  it('일기 날짜 수정과 사진·일기 삭제를 다음 조회에 반영한다', async () => {
    const a = await diary('2026-01-01')
    const b = await diary('2026-02-01')
    const one = await photo(a.id)
    const two = await photo(b.id)
    await context.repos.diaries.update(a.id, { entryDate: '2026-03-01' })
    expect(
      (await loadGrowthPhotos(context.repos, plantId)).photos.map((p) => p.id),
    ).toEqual([two.id, one.id])
    await context.repos.photos.delete(two.id)
    expect(
      (await loadGrowthPhotos(context.repos, plantId)).photos.map((p) => p.id),
    ).toEqual([one.id])
    await deleteDiary(context.repos, plantId, a.id)
    expect(
      (await loadGrowthPhotos(context.repos, plantId)).photos,
    ).toHaveLength(0)
  })
  it('다른 식물 사진을 섞지 않고 조회가 원본·Blob·시각을 변경하지 않는다', async () => {
    const entry = await diary('2026-01-02')
    await photo(entry.id, 0, 'original blob')
    const other = await context.repos.plants.create({
      name: '다른 식물',
      status: 'healthy',
    })
    await context.repos.photos.create({
      plantId: other.id,
      blob: new Blob(['other'], { type: 'image/png' }),
      mimeType: 'image/png',
      sortOrder: 0,
      capturedAt: '2026-01-01T00:00:00Z',
    })
    const before = await context.repos.backup.snapshot()
    const result = await loadGrowthPhotos(context.repos, plantId)
    expect(result.photos).toHaveLength(1)
    expect(await result.photos[0].blob.text()).toBe('original blob')
    expect(await context.repos.backup.snapshot()).toEqual(before)
  })
  it('대표 사진이어도 유효한 일기에 연결되어 있으면 포함한다', async () => {
    const entry = await diary('2026-01-02')
    const attached = await photo(entry.id)
    await context.repos.plants.update(plantId, { coverPhotoId: attached.id })
    expect(
      (await loadGrowthPhotos(context.repos, plantId)).photos.map((p) => p.id),
    ).toEqual([attached.id])
  })
  it('삭제 경합으로 연결 일기가 없는 사진은 후보에서 제외한다', async () => {
    const entry = await diary('2026-01-02')
    await photo(entry.id)
    vi.spyOn(context.repos.diaries, 'listByPlant').mockResolvedValue([])
    expect((await loadGrowthPhotos(context.repos, plantId)).photos).toEqual([])
  })
  it.each(['invalid-id', '6a8dba51-3fa4-4098-a8f9-396628b383f9'])(
    '잘못됐거나 존재하지 않는 식물 ID %s를 구분해 전달한다',
    async (id) => {
      await expect(loadGrowthPhotos(context.repos, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    },
  )
  it('저장소 조회 실패를 숨기지 않는다', async () => {
    vi.spyOn(context.repos.photos, 'listByPlant').mockRejectedValue(
      new Error('storage unavailable'),
    )
    await expect(loadGrowthPhotos(context.repos, plantId)).rejects.toThrow(
      'storage unavailable',
    )
  })
})

// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeaforyDatabase } from './database'
import { createLocalRepositories } from './repositories'
import { RepositoryError } from '../../domain/errors'
import { localDateKey } from '../../domain/calendar'
import type { Repositories } from '../../domain/repositories'

let db: LeaforyDatabase
let repos: Repositories
beforeEach(() => {
  db = new LeaforyDatabase(`leafory-test-${crypto.randomUUID()}`)
  repos = createLocalRepositories(db)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
const plant = () => repos.plants.create({ name: '괴마옥', status: 'observing' })
const diary = (plantId: string, entryDate = '2026-10-24') =>
  repos.diaries.create({
    plantId,
    entryDate,
    condition: 'good',
    content: '새잎이 나왔어요.',
  })
const care = (plantId: string, occurredAt = '2026-10-24T12:00:00+09:00') =>
  repos.careEvents.create({ plantId, eventType: 'watering', occurredAt })
const photo = (plantId: string, entryId?: string) =>
  repos.photos.create({
    plantId,
    entryId,
    blob: new Blob(['photo-bytes'], { type: 'image/png' }),
    mimeType: 'image/png',
    capturedAt: '2026-10-24T10:00:00+09:00',
    sortOrder: 0,
  })

describe('Dexie v1 CRUD', () => {
  it('식물 생성·전체 조회·상세 조회·수정·삭제, UUID와 저장 시각을 관리한다', async () => {
    const created = await plant()
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.createdAt).toMatch(/Z$/)
    expect(created.updatedAt).toBe(created.createdAt)
    expect(await repos.plants.list()).toEqual([created])
    const updated = await repos.plants.update(created.id, {
      name: '초록이',
      status: 'healthy',
      acquiredAt: '2026-10-01',
      memo: '관찰 중',
    })
    expect(updated).toMatchObject({
      id: created.id,
      createdAt: created.createdAt,
      name: '초록이',
      status: 'healthy',
    })
    expect(await repos.plants.getById(created.id)).toEqual(updated)
    await repos.plants.delete(created.id)
    expect(await repos.plants.getById(created.id)).toBeUndefined()
  })
  it('일기를 과거 날짜로 생성·수정·삭제하며 작성 시각과 일기 날짜를 구분한다', async () => {
    const p = await plant()
    const old = await diary(p.id, '2025-01-01')
    const current = await diary(p.id)
    expect(old.createdAt.slice(0, 10)).not.toBe(old.entryDate)
    expect((await repos.diaries.listByPlant(p.id)).map((e) => e.id)).toEqual([
      current.id,
      old.id,
    ])
    const updated = await repos.diaries.update(old.id, {
      entryDate: '2024-02-29',
      condition: 'normal',
      title: '지난 기록',
      content: '수정 내용',
    })
    expect(await repos.diaries.getById(old.id)).toEqual(updated)
    await repos.diaries.delete(old.id)
    expect(await repos.diaries.getById(old.id)).toBeUndefined()
  })
  it('관리 이벤트 생성·수정·삭제와 UTC 정규화를 지원한다', async () => {
    const p = await plant()
    const event = await care(p.id)
    expect(event.occurredAt).toBe('2026-10-24T03:00:00.000Z')
    const updated = await repos.careEvents.update(event.id, {
      eventType: 'grow_light',
      durationMinutes: 90,
      memo: '조명 켜기',
    })
    expect(await repos.careEvents.getById(event.id)).toEqual(updated)
    expect(await repos.careEvents.listByPlant(p.id)).toEqual([updated])
    await repos.careEvents.delete(event.id)
    expect(await repos.careEvents.getById(event.id)).toBeUndefined()
  })
  it('사진 Blob의 바이트·MIME을 저장·조회·수정·삭제한다', async () => {
    const p = await plant()
    const image = await photo(p.id)
    const read = await repos.photos.getById(image.id)
    expect(read?.blob).toBeInstanceOf(Blob)
    expect(await read?.blob.text()).toBe('photo-bytes')
    expect(read?.mimeType).toBe('image/png')
    expect(read?.capturedAt).toBe('2026-10-24T01:00:00.000Z')
    const replacement = new Blob(['new-bytes'], { type: 'image/jpeg' })
    const updated = await repos.photos.update(image.id, {
      blob: replacement,
      mimeType: 'image/jpeg',
      sortOrder: 2,
    })
    expect(await (await repos.photos.getById(updated.id))?.blob.text()).toBe(
      'new-bytes',
    )
    await repos.photos.delete(image.id)
    expect(await repos.photos.listByPlant(p.id)).toEqual([])
  })
  it('사진을 정렬 순서대로 반환한다', async () => {
    const p = await plant()
    const a = await photo(p.id)
    const b = await photo(p.id)
    await repos.photos.update(a.id, { sortOrder: 3 })
    await repos.photos.update(b.id, { sortOrder: 1 })
    expect((await repos.photos.listByPlant(p.id)).map((e) => e.id)).toEqual([
      b.id,
      a.id,
    ])
  })
  it('일기 삭제 시 첨부 사진과 대표 사진 참조를 정리하고 독립 사진은 유지한다', async () => {
    const p = await plant()
    const entry = await diary(p.id)
    const attached = await photo(p.id, entry.id)
    const standalone = await photo(p.id)
    await repos.plants.update(p.id, { coverPhotoId: attached.id })
    await repos.diaries.delete(entry.id)
    expect(await repos.photos.getById(attached.id)).toBeUndefined()
    expect(await repos.photos.getById(standalone.id)).toBeDefined()
    expect((await repos.plants.getById(p.id))?.coverPhotoId).toBeUndefined()
  })
  it('대표 사진 삭제 시 dangling coverPhotoId를 남기지 않는다', async () => {
    const p = await plant()
    const image = await photo(p.id)
    await repos.plants.update(p.id, { coverPhotoId: image.id })
    await repos.photos.delete(image.id)
    expect((await repos.plants.getById(p.id))?.coverPhotoId).toBeUndefined()
  })
  it('식물 삭제는 연결 데이터를 모두 정리하고 다른 식물은 유지한다', async () => {
    const a = await plant()
    const b = await plant()
    const entry = await diary(a.id)
    await photo(a.id, entry.id)
    await photo(a.id)
    await care(a.id)
    const other = await diary(b.id)
    const otherPhoto = await photo(b.id)
    await care(b.id)
    await repos.plants.delete(a.id)
    expect(await db.diaries.where('plantId').equals(a.id).count()).toBe(0)
    expect(await db.photos.where('plantId').equals(a.id).count()).toBe(0)
    expect(await db.careEvents.where('plantId').equals(a.id).count()).toBe(0)
    expect(await repos.diaries.getById(other.id)).toBeDefined()
    expect(await repos.photos.getById(otherPhoto.id)).toBeDefined()
    expect(await repos.queries.totalRecordCount(b.id)).toBe(2)
  })
})

describe('이벤트 기반 조회', () => {
  it('최신 물주기는 입력 순서 대신 occurredAt을 기준으로 계산하고 수정·삭제 시 재계산한다', async () => {
    const p = await plant()
    expect(await repos.queries.lastWateringAt(p.id)).toBeUndefined()
    expect(await repos.queries.daysSinceLastWatering(p.id)).toBeUndefined()
    const latest = await care(p.id, '2026-10-21T12:00:00Z')
    const older = await care(p.id, '2026-10-12T12:00:00Z')
    expect(await repos.queries.lastWateringAt(p.id)).toBe(latest.occurredAt)
    const day = localDateKey(new Date(latest.occurredAt))
    expect(await repos.queries.daysSinceLastWatering(p.id, day)).toBe(0)
    await repos.careEvents.delete(latest.id)
    expect(await repos.queries.lastWateringAt(p.id)).toBe(older.occurredAt)
    await repos.careEvents.update(older.id, {
      occurredAt: '2026-10-24T12:00:00Z',
    })
    expect(await repos.queries.lastWateringAt(p.id)).toBe(
      '2026-10-24T12:00:00.000Z',
    )
    // Long gaps do not change a plant's health status.
    expect((await repos.plants.getById(p.id))?.status).toBe('observing')
  })
  it('하루의 식물등 분을 합산하고 날짜·식물·이벤트 종류를 분리한다', async () => {
    const p = await plant()
    const other = await plant()
    const instant = new Date(2026, 9, 24, 12).toISOString()
    const create = (
      plantId: string,
      occurredAt: string,
      durationMinutes: number,
    ) =>
      repos.careEvents.create({
        plantId,
        occurredAt,
        durationMinutes,
        eventType: 'grow_light',
      })
    const a = await create(p.id, instant, 40)
    const b = await create(p.id, instant, 90)
    await create(p.id, new Date(2026, 9, 23, 12).toISOString(), 200)
    await create(other.id, instant, 300)
    await care(p.id, instant)
    expect(await repos.queries.growLightMinutes(p.id, '2026-10-24')).toBe(130)
    await repos.careEvents.update(a.id, { durationMinutes: 60 })
    expect(await repos.queries.growLightMinutes(p.id, '2026-10-24')).toBe(150)
    await repos.careEvents.delete(b.id)
    expect(await repos.queries.growLightMinutes(p.id, '2026-10-24')).toBe(60)
    expect(await repos.queries.growLightMinutes(p.id, '2026-10-25')).toBe(0)
  })
  it('타임라인은 일기 날짜와 로컬 이벤트 날짜순으로 합치며 원본 ID와 타입을 유지한다', async () => {
    const p = await plant()
    const other = await plant()
    const past = await diary(p.id, '2020-01-01')
    const current = await diary(p.id, '2026-10-24')
    const event = await care(p.id, new Date(2026, 9, 25, 12).toISOString())
    await diary(other.id)
    await photo(p.id, current.id)
    const rows = await repos.queries.recentTimeline(p.id)
    expect(rows.map((r) => [r.id, r.recordType])).toEqual([
      [event.id, 'care_event'],
      [current.id, 'diary'],
      [past.id, 'diary'],
    ])
    expect(rows[0].record).toEqual(event)
    expect(await repos.queries.recentTimeline(p.id, 2)).toHaveLength(2)
    expect(await repos.queries.totalRecordCount(p.id)).toBe(3)
  })
  it('일기와 이벤트가 같은 UUID여도 타임라인에서 타입별로 모두 유지한다', async () => {
    const p = await plant()
    const id = crypto.randomUUID()
    await repos.diaries.create({
      id,
      plantId: p.id,
      entryDate: '2026-10-24',
      condition: 'normal',
    })
    await repos.careEvents.create({
      id,
      plantId: p.id,
      eventType: 'watering',
      occurredAt: '2026-10-24T12:00:00Z',
    })
    expect(
      (await repos.queries.recentTimeline(p.id))
        .map((r) => r.recordType)
        .sort(),
    ).toEqual(['care_event', 'diary'])
  })
})

describe('무결성 및 실패 전달', () => {
  it('잘못된 UUID와 없는 식물 ID를 구분한다', async () => {
    await expect(repos.plants.getById('invalid')).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    const missing = crypto.randomUUID()
    expect(await repos.plants.getById(missing)).toBeUndefined()
    await expect(diary(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(care(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(photo(missing)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(repos.queries.recentTimeline(missing)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      repos.plants.update(missing, { name: '없는 식물' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(repos.plants.delete(missing)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
  it('다른 식물의 일기/사진을 연결하지 않는다', async () => {
    const a = await plant()
    const b = await plant()
    const entry = await diary(a.id)
    const image = await photo(a.id)
    await expect(photo(b.id, entry.id)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    await expect(
      repos.plants.update(b.id, { coverPhotoId: image.id }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      repos.plants.update(a.id, { coverPhotoId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await repos.photos.listByPlant(b.id)).toEqual([])
  })
  it('중복 ID는 덮어쓰지 않고 CONFLICT로 전달한다', async () => {
    const p = await plant()
    await expect(
      repos.plants.create({ id: p.id, name: '중복', status: 'healthy' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', cause: expect.anything() })
    expect((await repos.plants.getById(p.id))?.name).toBe('괴마옥')
  })
  it('일괄 작업 중 실패하면 앞선 생성도 롤백한다', async () => {
    const p = await plant()
    await expect(
      repos.runInTransaction(async (tx) => {
        const entry = await tx.diaries.create({
          plantId: p.id,
          entryDate: '2026-10-24',
          condition: 'good',
        })
        await tx.photos.create({
          plantId: p.id,
          entryId: entry.id,
          blob: new Blob(['x'], { type: 'image/png' }),
          mimeType: 'image/png',
          capturedAt: '2026-10-24T12:00:00Z',
          sortOrder: 0,
        })
        throw new Error('failure after multiple writes')
      }),
    ).rejects.toMatchObject({ code: 'STORAGE', cause: expect.any(Error) })
    expect(await repos.diaries.listByPlant(p.id)).toEqual([])
    expect(await repos.photos.listByPlant(p.id)).toEqual([])
  })
  it('식물 연쇄 삭제 중간의 실패는 이미 삭제한 일기까지 복구한다', async () => {
    const p = await plant()
    const entry = await diary(p.id)
    const image = await photo(p.id, entry.id)
    const event = await care(p.id)
    const hook = () => {
      throw new Error('injected photo deletion failure')
    }
    db.photos.hook('deleting', hook)
    try {
      await expect(repos.plants.delete(p.id)).rejects.toMatchObject({
        code: 'STORAGE',
      })
    } finally {
      db.photos.hook('deleting').unsubscribe(hook)
    }
    expect(await repos.plants.getById(p.id)).toBeDefined()
    expect(await repos.diaries.getById(entry.id)).toBeDefined()
    expect(await repos.photos.getById(image.id)).toBeDefined()
    expect(await repos.careEvents.getById(event.id)).toBeDefined()
  })
  it('저장소가 닫힌 오류도 cause를 보존해 전달한다', async () => {
    await db.open()
    db.close({ disableAutoOpen: true })
    await expect(plant()).rejects.toBeInstanceOf(RepositoryError)
    await expect(plant()).rejects.toMatchObject({
      code: 'STORAGE',
      cause: expect.anything(),
    })
  })
  it('새 DB는 이전 테스트와 데이터를 공유하지 않는다', async () => {
    expect(await repos.plants.list()).toEqual([])
    expect(db.name).toMatch(/^leafory-test-/)
  })
})

describe('일괄 저장과 DB 수명', () => {
  it('식물·일기·사진·대표 사진 연결을 하나의 트랜잭션으로 커밋한다', async () => {
    const saved = await repos.runInTransaction(async (tx) => {
      const p = await tx.plants.create({ name: '새 식물', status: 'healthy' })
      const entry = await tx.diaries.create({
        plantId: p.id,
        entryDate: '2026-10-24',
        condition: 'good',
      })
      const image = await tx.photos.create({
        plantId: p.id,
        entryId: entry.id,
        blob: new Blob(['x'], { type: 'image/png' }),
        mimeType: 'image/png',
        capturedAt: '2026-10-24T12:00:00Z',
        sortOrder: 0,
      })
      return tx.plants.update(p.id, { coverPhotoId: image.id })
    })
    expect((await repos.plants.getById(saved.id))?.coverPhotoId).toBe(
      saved.coverPhotoId,
    )
    expect(await repos.queries.totalRecordCount(saved.id)).toBe(1)
    expect(await repos.photos.listByPlant(saved.id)).toHaveLength(1)
  })
  it('실제 관계 검증 오류도 선행 저장을 롤백하고 원래 오류 코드를 보존한다', async () => {
    await expect(
      repos.runInTransaction(async (tx) => {
        await tx.plants.create({ name: '롤백 대상', status: 'healthy' })
        await tx.diaries.create({
          plantId: crypto.randomUUID(),
          entryDate: '2026-10-24',
          condition: 'good',
        })
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await repos.plants.list()).toEqual([])
  })
  it('같은 이름의 DB를 다시 열어도 식물과 Blob 바이트를 조회할 수 있다', async () => {
    const p = await plant()
    const image = await photo(p.id)
    db.close()
    const reopened = new LeaforyDatabase(db.name)
    try {
      const second = createLocalRepositories(reopened)
      expect((await second.plants.getById(p.id))?.name).toBe(p.name)
      expect(await (await second.photos.getById(image.id))?.blob.text()).toBe(
        'photo-bytes',
      )
      expect(reopened.verno).toBe(1)
    } finally {
      reopened.close()
    }
  })
  it('수정 시 createdAt은 유지하고 updatedAt을 갱신하며 선택 필드를 지울 수 있다', async () => {
    const p = await repos.plants.create({
      name: '메모 식물',
      status: 'healthy',
      memo: '임시 메모',
    })
    const updated = await repos.plants.update(p.id, { memo: undefined })
    expect(updated.createdAt).toBe(p.createdAt)
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(p.updatedAt),
    )
    expect((await repos.plants.getById(p.id))?.memo).toBeUndefined()
  })
})

// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LeaforyDatabase } from '../data/local/database'
import { createLocalRepositories } from '../data/local/repositories'
import { deleteDiary, loadDiary, saveDiary } from './diary-service'
import type { DiaryPhotoDraft } from './diary-service'
import { loadHome, loadPlant } from './plant-service'
let db: LeaforyDatabase
let repos: ReturnType<typeof createLocalRepositories>
let plantId: string
beforeEach(async () => {
  db = new LeaforyDatabase(`diary-service-${crypto.randomUUID()}`)
  repos = createLocalRepositories(db)
  plantId = (
    await repos.plants.create({ name: '일기 식물', status: 'healthy' })
  ).id
})
afterEach(async () => db.delete())
const fields = {
  entryDate: '2025-01-02',
  condition: 'good' as const,
  title: ' 새잎 ',
  content: ' 관찰 메모\n둘째 줄 ',
}
const draft = (text = 'photo'): DiaryPhotoDraft => ({
  key: crypto.randomUUID(),
  blob: new Blob([text], { type: 'image/jpeg' }),
  mimeType: 'image/jpeg',
  capturedAt: new Date().toISOString(),
})
const retained = (
  p: Awaited<ReturnType<typeof loadDiary>>['photos'][number],
): DiaryPhotoDraft => ({ ...p, key: p.id, photoId: p.id })
describe('사진 일기 저장 서비스', () => {
  it('과거 날짜의 일기를 생성하고 내용 수정·삭제 및 통계를 반영한다', async () => {
    const entry = await saveDiary(repos, plantId, fields, [])
    expect(entry).toMatchObject({
      entryDate: '2025-01-02',
      title: '새잎',
      content: '관찰 메모\n둘째 줄',
    })
    await saveDiary(
      repos,
      plantId,
      { ...fields, condition: 'concern', title: '수정' },
      [],
      entry.id,
    )
    expect((await loadDiary(repos, plantId, entry.id)).entry.condition).toBe(
      'concern',
    )
    expect((await loadPlant(repos, plantId)).recordCount).toBe(1)
    await deleteDiary(repos, plantId, entry.id)
    expect((await loadPlant(repos, plantId)).recordCount).toBe(0)
  })
  it('사진 여러 장을 순서대로 저장하고 DB 재개방 후 Blob을 복원한다', async () => {
    const entry = await saveDiary(repos, plantId, fields, [
      draft('first'),
      draft('second'),
    ])
    db.close()
    await db.open()
    const saved = await loadDiary(repos, plantId, entry.id)
    expect(await Promise.all(saved.photos.map((p) => p.blob.text()))).toEqual([
      'first',
      'second',
    ])
    expect(saved.photos.map((p) => p.sortOrder)).toEqual([0, 1])
  })
  it('사진 순서 변경·삭제·추가를 동시에 저장하고 타임라인 첫 사진을 바꾼다', async () => {
    const entry = await saveDiary(repos, plantId, fields, [
      draft('one'),
      draft('two'),
      draft('three'),
    ])
    const { photos } = await loadDiary(repos, plantId, entry.id)
    await saveDiary(
      repos,
      plantId,
      fields,
      [retained(photos[2]), retained(photos[0]), draft('four')],
      entry.id,
    )
    const updated = await loadDiary(repos, plantId, entry.id)
    expect(await Promise.all(updated.photos.map((p) => p.blob.text()))).toEqual(
      ['three', 'one', 'four'],
    )
    expect(await repos.photos.getById(photos[1].id)).toBeUndefined()
    const view = await loadPlant(repos, plantId)
    expect(await view.entries[0].image?.text()).toBe('three')
    expect(view.entries[0]).toMatchObject({
      diaryEntryId: entry.id,
      photoCount: 3,
      condition: 'good',
    })
    expect((await loadHome(repos)).records[0].date).toBe(fields.entryDate)
  })
  it('일기 삭제는 연결 사진만 정리하고 대표 사진·다른 일기·관리 이벤트를 유지한다', async () => {
    const entry = await saveDiary(repos, plantId, fields, [draft('remove')])
    const other = await saveDiary(repos, plantId, fields, [draft('keep')])
    const coverDraft = draft()
    const cover = await repos.photos.create({
      blob: coverDraft.blob,
      mimeType: coverDraft.mimeType,
      capturedAt: coverDraft.capturedAt,
      plantId,
      sortOrder: 0,
    })
    await repos.plants.update(plantId, { coverPhotoId: cover.id })
    const event = await repos.careEvents.create({
      plantId,
      eventType: 'watering',
      occurredAt: new Date().toISOString(),
    })
    await deleteDiary(repos, plantId, entry.id)
    expect(
      (await repos.photos.listByPlant(plantId))
        .map((p) => p.entryId)
        .filter(Boolean),
    ).toEqual([other.id])
    expect(await repos.photos.getById(cover.id)).toBeDefined()
    expect(await repos.careEvents.getById(event.id)).toBeDefined()
    expect((await loadPlant(repos, plantId)).recordCount).toBe(2)
  })
  it('일부 사진 저장 실패 시 새 일기와 이미 저장된 사진도 롤백한다', async () => {
    let count = 0
    const fail = () => {
      if (++count === 2) throw new Error('quota')
    }
    db.photos.hook('creating', fail)
    try {
      await expect(
        saveDiary(repos, plantId, fields, [draft(), draft()]),
      ).rejects.toMatchObject({ code: 'STORAGE' })
    } finally {
      db.photos.hook('creating').unsubscribe(fail)
    }
    expect(await repos.diaries.listByPlant(plantId)).toEqual([])
    expect(await repos.photos.listByPlant(plantId)).toEqual([])
  })
  it('수정 저장 실패 시 일기·기존 사진·순서를 모두 롤백한다', async () => {
    const entry = await saveDiary(repos, plantId, fields, [
      draft('old'),
      draft('keep'),
    ])
    const before = await loadDiary(repos, plantId, entry.id)
    const fail = () => {
      throw new Error('full')
    }
    db.photos.hook('creating', fail)
    try {
      await expect(
        saveDiary(
          repos,
          plantId,
          { ...fields, title: '실패' },
          [retained(before.photos[1]), draft()],
          entry.id,
        ),
      ).rejects.toThrow()
    } finally {
      db.photos.hook('creating').unsubscribe(fail)
    }
    const after = await loadDiary(repos, plantId, entry.id)
    expect(after.entry).toEqual(before.entry)
    expect(after.photos.map((p) => [p.id, p.sortOrder])).toEqual(
      before.photos.map((p) => [p.id, p.sortOrder]),
    )
  })
  it('삭제 중 사진 정리 실패 시 일기와 사진을 보존한다', async () => {
    const entry = await saveDiary(repos, plantId, fields, [draft()])
    const fail = () => {
      throw new Error('blocked')
    }
    db.photos.hook('deleting', fail)
    try {
      await expect(deleteDiary(repos, plantId, entry.id)).rejects.toThrow()
    } finally {
      db.photos.hook('deleting').unsubscribe(fail)
    }
    expect((await loadDiary(repos, plantId, entry.id)).photos).toHaveLength(1)
  })
  it('다른 식물의 일기 조회·수정·삭제를 거부한다', async () => {
    const other = await repos.plants.create({
      name: '다른 식물',
      status: 'healthy',
    })
    const entry = await saveDiary(repos, plantId, fields, [])
    await expect(loadDiary(repos, other.id, entry.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      saveDiary(repos, other.id, fields, [], entry.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(deleteDiary(repos, other.id, entry.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
  it('다른 일기의 사진을 탈취하거나 중복 첨부할 수 없다', async () => {
    const a = await saveDiary(repos, plantId, fields, [draft()])
    const b = await saveDiary(repos, plantId, fields, [])
    const photo = retained((await loadDiary(repos, plantId, a.id)).photos[0])
    await expect(
      saveDiary(repos, plantId, fields, [photo], b.id),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      saveDiary(
        repos,
        plantId,
        fields,
        [photo, { ...photo, key: 'new-key' }],
        a.id,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('실재하지 않는 날짜·잘못된 ID·사진 제한을 검증한다', async () => {
    await expect(
      saveDiary(repos, plantId, { ...fields, entryDate: '2026-02-30' }, []),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(loadDiary(repos, 'bad', 'bad')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      saveDiary(
        repos,
        plantId,
        fields,
        Array.from({ length: 11 }, () => draft()),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      saveDiary(repos, plantId, fields, [
        { ...draft(), mimeType: 'image/heic' },
      ]),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

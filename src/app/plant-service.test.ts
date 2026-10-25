// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LeaforyDatabase } from '../data/local/database'
import { createLocalRepositories } from '../data/local/repositories'
import { loadHome, loadPlant, savePlant } from './plant-service'
let db: LeaforyDatabase
let repos: ReturnType<typeof createLocalRepositories>
beforeEach(() => {
  db = new LeaforyDatabase(`leafory-service-${crypto.randomUUID()}`)
  repos = createLocalRepositories(db)
})
afterEach(async () => db.delete())
const fields = {
  name: '초록이',
  species: 'Monstera deliciosa',
  status: 'healthy' as const,
  memo: '함께 자라는 중',
}
const photo = (content = 'jpeg') => ({
  blob: new Blob([content], { type: 'image/jpeg' }),
  mimeType: 'image/jpeg',
  capturedAt: new Date().toISOString(),
})
describe('실제 식물 저장 서비스', () => {
  it('빈 목록을 반환하며 DB에 목업을 추가하지 않는다', async () => {
    expect(await loadHome(repos)).toEqual({
      views: [],
      records: [],
      weekCount: 0,
    })
    expect(await repos.plants.list()).toEqual([])
  })
  it('사진 없는 식물 등록·수정·삭제를 지원한다', async () => {
    const p = await savePlant(
      repos,
      { ...fields, name: ' 초록이 ' },
      { type: 'keep' },
    )
    expect(p.name).toBe('초록이')
    const view = await loadPlant(repos, p.id)
    expect(view).toMatchObject({
      cover: undefined,
      lastWatered: undefined,
      lightMinutes: undefined,
      recordCount: 0,
      entries: [],
      gallery: [],
    })
    await savePlant(
      repos,
      { ...fields, name: '새 이름', memo: '' },
      { type: 'keep' },
      p.id,
    )
    expect((await loadPlant(repos, p.id)).plant).toMatchObject({
      name: '새 이름',
      memo: undefined,
    })
    await repos.plants.delete(p.id)
    expect((await loadHome(repos)).views).toEqual([])
  })
  it('사진을 저장하고 교체 시 이전 대표 사진을 정리한다', async () => {
    const p = await savePlant(repos, fields, {
      type: 'replace',
      photo: photo('old'),
    })
    const old = p.coverPhotoId!
    expect(await (await repos.photos.getById(old))?.blob.text()).toBe('old')
    const updated = await savePlant(
      repos,
      fields,
      { type: 'replace', photo: photo('new') },
      p.id,
    )
    expect(updated.coverPhotoId).not.toBe(old)
    expect(await repos.photos.getById(old)).toBeUndefined()
    expect(await repos.photos.listByPlant(p.id)).toHaveLength(1)
    expect(await (await loadPlant(repos, p.id)).cover?.text()).toBe('new')
    await savePlant(repos, fields, { type: 'remove' }, p.id)
    expect((await loadPlant(repos, p.id)).cover).toBeUndefined()
    expect(await repos.photos.listByPlant(p.id)).toEqual([])
  })
  it('수정 중 사진 유지와 일기 첨부 사진 보존을 지원한다', async () => {
    const p = await savePlant(repos, fields, {
      type: 'replace',
      photo: photo(),
    })
    expect(
      (
        await savePlant(
          repos,
          { ...fields, name: '수정' },
          { type: 'keep' },
          p.id,
        )
      ).coverPhotoId,
    ).toBe(p.coverPhotoId)
    const entry = await repos.diaries.create({
      plantId: p.id,
      entryDate: '2026-10-24',
      condition: 'normal',
    })
    await repos.photos.update(p.coverPhotoId!, { entryId: entry.id })
    await savePlant(repos, fields, { type: 'remove' }, p.id)
    expect(await repos.photos.getById(p.coverPhotoId!)).toBeDefined()
    expect((await loadPlant(repos, p.id)).cover).toBeUndefined()
  })
  it('사진 저장 실패 시 새 식물도 남지 않는다', async () => {
    const fail = () => {
      throw new Error('quota')
    }
    db.photos.hook('creating', fail)
    try {
      await expect(
        savePlant(repos, fields, { type: 'replace', photo: photo() }),
      ).rejects.toMatchObject({ code: 'STORAGE' })
    } finally {
      db.photos.hook('creating').unsubscribe(fail)
    }
    expect(await repos.plants.list()).toEqual([])
    expect(await db.photos.count()).toBe(0)
  })
  it('교체 중 이전 사진 삭제 실패 시 이름·사진·참조를 모두 복구한다', async () => {
    const p = await savePlant(repos, fields, {
      type: 'replace',
      photo: photo('old'),
    })
    const fail = () => {
      throw new Error('delete failed')
    }
    db.photos.hook('deleting', fail)
    try {
      await expect(
        savePlant(
          repos,
          { ...fields, name: '저장되면 안 됨' },
          { type: 'replace', photo: photo('new') },
          p.id,
        ),
      ).rejects.toMatchObject({ code: 'STORAGE' })
    } finally {
      db.photos.hook('deleting').unsubscribe(fail)
    }
    expect((await repos.plants.getById(p.id))?.name).toBe(fields.name)
    expect((await repos.plants.getById(p.id))?.coverPhotoId).toBe(
      p.coverPhotoId,
    )
    expect(await repos.photos.listByPlant(p.id)).toHaveLength(1)
    expect(await (await loadPlant(repos, p.id)).cover?.text()).toBe('old')
  })
  it('DB 재개방 후 저장한 정보와 대표 사진을 조회한다', async () => {
    const p = await savePlant(repos, fields, {
      type: 'replace',
      photo: photo(),
    })
    db.close()
    const reopened = new LeaforyDatabase(db.name)
    try {
      expect(
        (await loadPlant(createLocalRepositories(reopened), p.id)).plant.name,
      ).toBe(fields.name)
      expect(
        await (
          await loadPlant(createLocalRepositories(reopened), p.id)
        ).cover?.text(),
      ).toBe('jpeg')
    } finally {
      reopened.close()
    }
  })
  it('잘못된 주소·없는 ID와 잘못된 입력을 거부한다', async () => {
    for (const id of ['bad', crypto.randomUUID()])
      await expect(loadPlant(repos, id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    await expect(
      savePlant(repos, { ...fields, name: '   ' }, { type: 'keep' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      savePlant(
        repos,
        { ...fields, acquiredAt: '2026-02-30' },
        { type: 'keep' },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      savePlant(repos, fields, {
        type: 'replace',
        photo: { ...photo(), mimeType: 'image/heic' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

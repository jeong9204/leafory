// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { zipSync, unzipSync } from 'fflate'
import { testDatabase } from '../test/render-app'
import {
  backupErrorMessage,
  exportBackup,
  prepareBackup,
  restoreBackup,
} from './backup-service'
import { MAX_BACKUP_BYTES } from '../lib/backup-zip'
import { validateSnapshot } from '../domain/backup'
let context: ReturnType<typeof testDatabase>
beforeEach(() => {
  context = testDatabase()
})
afterEach(async () => context.db.delete())
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 2, 255, 217])
async function fixture() {
  const { repos } = context
  const plant = await repos.plants.create({
    name: '백업 식물',
    status: 'observing',
    memo: '중요한 기록',
    acquiredAt: '2025-01-02',
  })
  const diary = await repos.diaries.create({
    plantId: plant.id,
    entryDate: '2025-01-03',
    condition: 'good',
    title: '새잎',
    content: '자라고 있어요',
  })
  for (let i = 0; i < 2; i++)
    await repos.photos.create({
      plantId: plant.id,
      entryId: diary.id,
      blob: new Blob([jpeg], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      capturedAt: '2025-01-03T01:00:00Z',
      sortOrder: i,
    })
  const cover = await repos.photos.create({
    plantId: plant.id,
    blob: new Blob([jpeg], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    capturedAt: '2025-01-02T01:00:00Z',
    sortOrder: 0,
  })
  await repos.plants.update(plant.id, { coverPhotoId: cover.id })
  await repos.careEvents.create({
    plantId: plant.id,
    eventType: 'watering',
    occurredAt: '2025-01-03T02:00:00Z',
  })
  await repos.careEvents.create({
    plantId: plant.id,
    eventType: 'grow_light',
    occurredAt: '2025-01-03T03:00:00Z',
    durationMinutes: 90,
  })
  return plant
}
type TestManifest = {
  formatVersion: unknown
  createdAt: unknown
  data: Record<string, Record<string, unknown>[]>
}
async function archive(
  edit: (manifest: TestManifest, files: Record<string, Uint8Array>) => void,
) {
  const result = await exportBackup(context.repos)
  const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
  const metadata = JSON.parse(new TextDecoder().decode(files['metadata.json']))
  edit(metadata, files)
  files['metadata.json'] = new TextEncoder().encode(JSON.stringify(metadata))
  return new Blob([new Uint8Array(zipSync(files))])
}
const metadataOnly = (
  snapshot: Awaited<ReturnType<typeof context.repos.backup.snapshot>>,
) => ({
  ...snapshot,
  photos: snapshot.photos.map(({ blob, ...p }) => ({
    ...p,
    size: blob.size,
    type: blob.type,
  })),
})
describe('ZIP 백업·복원', () => {
  it('식물·일기·사진·관리 기록과 버전·생성 시각을 내보낸다', async () => {
    await fixture()
    const result = await exportBackup(
      context.repos,
      new Date('2026-10-26T00:00:00Z'),
    )
    expect(result.counts).toEqual({
      plants: 1,
      diaries: 1,
      photos: 3,
      careEvents: 2,
    })
    const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
    expect(Object.keys(files)).toHaveLength(4)
    const manifest = JSON.parse(
      new TextDecoder().decode(files['metadata.json']),
    )
    expect(manifest).toMatchObject({
      format: 'leafory-backup',
      formatVersion: 1,
      createdAt: '2026-10-26T00:00:00.000Z',
    })
    expect(manifest.data.photos[0].blob).toBeUndefined()
    expect(manifest.data.photos[0].path).toMatch(/^photos\/.*\.jpg$/)
  })
  it('빈 데이터를 백업하고 전체 교체하면 빈 상태로 복원한다', async () => {
    const backup = await prepareBackup((await exportBackup(context.repos)).blob)
    await fixture()
    await restoreBackup(context.repos, backup)
    expect(await context.repos.backup.counts()).toEqual({
      plants: 0,
      diaries: 0,
      photos: 0,
      careEvents: 0,
    })
  })
  it('전체 복원 결과와 Blob·ID·시각·관계·순서가 일치하고 DB 재개방 후 유지된다', async () => {
    const plant = await fixture()
    const before = await context.repos.backup.snapshot()
    const backup = await prepareBackup((await exportBackup(context.repos)).blob)
    await context.repos.plants.create({
      name: '교체될 식물',
      status: 'healthy',
    })
    await restoreBackup(context.repos, backup)
    context.db.close()
    await context.db.open()
    const restored = await context.repos.backup.snapshot()
    expect(metadataOnly(restored)).toEqual(metadataOnly(before))
    expect(new Uint8Array(await restored.photos[0].blob.arrayBuffer())).toEqual(
      jpeg,
    )
    expect((await context.repos.plants.getById(plant.id))?.coverPhotoId).toBe(
      before.plants[0].coverPhotoId,
    )
    expect(await context.repos.queries.totalRecordCount(plant.id)).toBe(3)
  })
  it('일관된 스냅샷을 내보내며 원본 DB는 변경하지 않는다', async () => {
    await fixture()
    const before = await context.repos.backup.snapshot()
    await exportBackup(context.repos)
    expect(metadataOnly(await context.repos.backup.snapshot())).toEqual(
      metadataOnly(before),
    )
  })
  it.each([new Uint8Array([1, 2, 3]), new Uint8Array(30)])(
    '손상된 ZIP을 거부한다',
    async (bytes) => {
      await expect(prepareBackup(new Blob([bytes]))).rejects.toMatchObject({
        code: 'VALIDATION',
      })
    },
  )
  it('사진 데이터 CRC가 일치하지 않으면 거부한다', async () => {
    await fixture()
    const files = unzipSync(
      new Uint8Array(
        await (await exportBackup(context.repos)).blob.arrayBuffer(),
      ),
    )
    const zip = zipSync(files, { level: 0 })
    const view = new DataView(zip.buffer)
    // First file is a stored JPEG; alter payload without updating the ZIP CRC.
    const offset = 30 + view.getUint16(26, true) + view.getUint16(28, true)
    zip[offset + 1] ^= 1
    await expect(
      prepareBackup(new Blob([new Uint8Array(zip)])),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it.each([
    [
      '버전',
      (m: TestManifest) => {
        m.formatVersion = 99
      },
    ],
    [
      '생성 시각',
      (m: TestManifest) => {
        m.createdAt = 'bad'
      },
    ],
    [
      '목록',
      (m: TestManifest) => {
        m.data.plants = {} as never
      },
    ],
    [
      '필수 필드',
      (m: TestManifest) => {
        Reflect.deleteProperty(m.data.plants[0], 'updatedAt')
      },
    ],
    [
      '중복 ID',
      (m: TestManifest) => {
        m.data.plants.push(m.data.plants[0])
      },
    ],
    [
      '식물 연결',
      (m: TestManifest) => {
        m.data.diaries[0].plantId = crypto.randomUUID()
      },
    ],
    [
      '대표 사진 연결',
      (m: TestManifest) => {
        m.data.plants[0].coverPhotoId = crypto.randomUUID()
      },
    ],
    [
      '일기 연결',
      (m: TestManifest) => {
        m.data.photos[0].entryId = crypto.randomUUID()
      },
    ],
    [
      '날짜',
      (m: TestManifest) => {
        m.data.diaries[0].entryDate = '2026-02-30'
      },
    ],
    [
      '관리 시간',
      (m: TestManifest) => {
        m.data.careEvents.find(
          (e: Record<string, unknown>) => e.eventType === 'grow_light',
        )!.durationMinutes = -1
      },
    ],
    [
      '사진 경로',
      (m: TestManifest) => {
        m.data.photos[0].path = '../private.jpg'
      },
    ],
  ])('잘못된 %s를 거부하고 원본 데이터를 보존한다', async (_, edit) => {
    await fixture()
    const before = metadataOnly(await context.repos.backup.snapshot())
    const file = await archive(edit)
    await expect(prepareBackup(file)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    expect(metadataOnly(await context.repos.backup.snapshot())).toEqual(before)
  })
  it('사진 파일 누락·잘못된 MIME·추가 경로를 거부한다', async () => {
    await fixture()
    const missing = await archive((m, files) => {
      delete files[String(m.data.photos[0].path)]
    })
    await expect(prepareBackup(missing)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    const badPhoto = await archive((m, files) => {
      files[String(m.data.photos[0].path)] = new Uint8Array([1, 2, 3])
    })
    await expect(prepareBackup(badPhoto)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    const extra = await archive((_, files) => {
      files['../secret.txt'] = new Uint8Array([1])
    })
    await expect(prepareBackup(extra)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })
  it('압축 해제 전 과도한 크기를 선언한 ZIP을 거부한다', async () => {
    const file = await exportBackup(context.repos)
    const bytes = new Uint8Array(await file.blob.arrayBuffer()),
      view = new DataView(bytes.buffer)
    const central = view.getUint32(bytes.length - 22 + 16, true)
    view.setUint32(central + 24, MAX_BACKUP_BYTES + 1, true)
    await expect(prepareBackup(new Blob([bytes]))).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })
  it('중복 ZIP 경로를 거부한다', async () => {
    await fixture()
    const file = await exportBackup(context.repos)
    const bytes = new Uint8Array(await file.blob.arrayBuffer()),
      view = new DataView(bytes.buffer)
    const central = view.getUint32(bytes.length - 22 + 16, true)
    const next =
      central +
      46 +
      view.getUint16(central + 28, true) +
      view.getUint16(central + 30, true) +
      view.getUint16(central + 32, true)
    const name = bytes.slice(
      central + 46,
      central + 46 + view.getUint16(central + 28, true),
    )
    bytes.set(name, next + 46)
    await expect(prepareBackup(new Blob([bytes]))).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })
  it('복원 도중 사진 저장 실패 시 전체 테이블의 삭제와 삽입을 롤백한다', async () => {
    await fixture()
    const backup = await prepareBackup((await exportBackup(context.repos)).blob)
    await context.repos.plants.create({
      name: '반드시 보존',
      status: 'healthy',
    })
    const before = metadataOnly(await context.repos.backup.snapshot())
    const fail = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    }
    context.db.photos.hook('creating', fail)
    try {
      await expect(restoreBackup(context.repos, backup)).rejects.toMatchObject({
        code: 'STORAGE',
      })
    } finally {
      context.db.photos.hook('creating').unsubscribe(fail)
    }
    expect(metadataOnly(await context.repos.backup.snapshot())).toEqual(before)
  })
  it('저장소 교체 경계에서도 유효하지 않은 데이터를 재검증한다', async () => {
    await fixture()
    const data = await context.repos.backup.snapshot()
    data.plants[0].status = 'wrong' as 'healthy'
    await expect(context.repos.backup.replace(data)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    expect((await context.repos.backup.counts()).plants).toBe(1)
    expect(() =>
      validateSnapshot({
        plants: [],
        diaries: [],
        photos: [],
        careEvents: [],
        extra: true,
      }),
    ).toThrow()
  })
  it('저장 공간 오류를 원인 체인에서 찾아 안내한다', () => {
    expect(
      backupErrorMessage(
        new Error('wrapper', {
          cause: new DOMException('full', 'QuotaExceededError'),
        }),
      ),
    ).toContain('저장 공간이 부족')
  })
})

it('유효한 ISO 시각의 오프셋 표현은 기존 저장소처럼 UTC로 정규화한다', async () => {
  await fixture()
  const file = await archive((m) => {
    m.data.careEvents[0].occurredAt = '2025-01-03T11:00:00+09:00'
    m.data.photos[0].capturedAt = '2025-01-03T10:00:00+09:00'
  })
  await restoreBackup(context.repos, await prepareBackup(file))
  const data = await context.repos.backup.snapshot()
  expect(data.careEvents[0].occurredAt).toBe('2025-01-03T02:00:00.000Z')
  expect(data.photos[0].capturedAt).toBe('2025-01-03T01:00:00.000Z')
})

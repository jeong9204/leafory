import type { Repositories } from '../domain/repositories'
import type { LocalDataSnapshot } from '../domain/backup'
import {
  exactObject,
  recordFields,
  snapshotCounts,
  validateSnapshot,
} from '../domain/backup'
import type { DiaryPhoto } from '../domain/models'
import { invalid, validateInstant } from '../domain/validation'
import { matchesPhotoSignature } from '../lib/plant-photo'
import {
  MAX_BACKUP_BYTES,
  MAX_METADATA_BYTES,
  MAX_BACKUP_PHOTO_BYTES,
  packBackup,
  unpackBackup,
} from '../lib/backup-zip'
import type { AsyncZippable } from 'fflate'

export const BACKUP_VERSION = 1
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
interface PhotoMetadata extends Omit<DiaryPhoto, 'blob'> {
  path: string
}
interface Manifest {
  format: 'leafory-backup'
  formatVersion: number
  createdAt: string
  data: Omit<LocalDataSnapshot, 'photos'> & { photos: PhotoMetadata[] }
}
export interface PreparedBackup {
  data: LocalDataSnapshot
  createdAt: string
  counts: ReturnType<typeof snapshotCounts>
  sizeBytes: number
}
function photoPath(photo: Pick<DiaryPhoto, 'id' | 'mimeType'>) {
  if (!extensions[photo.mimeType])
    invalid('백업 사진 형식은 JPEG, PNG, WebP만 지원합니다.')
  return `photos/${photo.id}.${extensions[photo.mimeType]}`
}
export async function exportBackup(repos: Repositories, now = new Date()) {
  const data = await repos.backup.snapshot()
  validateSnapshot(data)
  let total = 0
  const files: AsyncZippable = {}
  const photos: PhotoMetadata[] = []
  for (const photo of data.photos) {
    if (photo.blob.size > MAX_BACKUP_PHOTO_BYTES)
      invalid('백업 사진 크기가 장당 15MiB 제한을 초과했습니다.')
    total += photo.blob.size
    if (total > MAX_BACKUP_BYTES)
      invalid('MVP 백업은 전체 100MiB까지만 지원합니다.')
    const { blob, ...metadata } = photo
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (!matchesPhotoSignature(photo.mimeType, bytes))
      invalid('저장된 사진 파일 형식이 올바르지 않습니다.')
    const path = photoPath(photo)
    files[path] = bytes
    photos.push({ ...metadata, path })
  }
  const manifest: Manifest = {
    format: 'leafory-backup',
    formatVersion: BACKUP_VERSION,
    createdAt: now.toISOString(),
    data: { ...data, photos },
  }
  const metadata = new TextEncoder().encode(JSON.stringify(manifest))
  if (
    metadata.length > MAX_METADATA_BYTES ||
    total + metadata.length > MAX_BACKUP_BYTES
  )
    invalid('백업 크기 제한을 초과했습니다.')
  files['metadata.json'] = [metadata, { level: 6 }]
  const zipped = await packBackup(files)
  if (zipped.length > MAX_BACKUP_BYTES)
    invalid('ZIP 파일이 100MiB 제한을 초과했습니다.')
  return {
    blob: new Blob([new Uint8Array(zipped)], { type: 'application/zip' }),
    filename: `leafory-backup-${now.toISOString().replace(/[:.]/g, '-')}.zip`,
    counts: snapshotCounts(data),
  }
}
export async function prepareBackup(file: Blob): Promise<PreparedBackup> {
  if (!file.size || file.size > MAX_BACKUP_BYTES)
    invalid('백업 ZIP은 비어 있지 않은 100MiB 이하 파일이어야 합니다.')
  const files = await unpackBackup(new Uint8Array(await file.arrayBuffer()))
  let raw: unknown
  try {
    raw = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(files['metadata.json']),
    )
  } catch {
    invalid('백업 JSON을 읽을 수 없습니다.')
  }
  exactObject(raw, ['format', 'formatVersion', 'createdAt', 'data'])
  const manifest = raw as Manifest
  if (
    manifest.format !== 'leafory-backup' ||
    manifest.formatVersion !== BACKUP_VERSION
  )
    invalid('지원하지 않는 백업 형식 또는 버전입니다.')
  validateInstant(manifest.createdAt, '백업 생성 시각')
  exactObject(manifest.data, ['plants', 'diaries', 'photos', 'careEvents'])
  if (
    !Array.isArray(manifest.data.photos) ||
    manifest.data.photos.length > 10000
  )
    invalid('백업 사진 목록이 올바르지 않습니다.')
  const used = new Set(['metadata.json'])
  const photos: DiaryPhoto[] = manifest.data.photos.map((photo) => {
    exactObject(photo, [
      ...recordFields.photos.filter((k) => k !== 'blob'),
      'path',
    ])
    if (photo.path !== photoPath(photo) || used.has(photo.path))
      invalid('사진 경로가 올바르지 않거나 중복되었습니다.')
    used.add(photo.path)
    const bytes = files[photo.path]
    if (!bytes || !matchesPhotoSignature(photo.mimeType, bytes))
      invalid('백업 사진이 없거나 형식이 올바르지 않습니다.')
    const { path: _path, ...metadata } = photo
    void _path
    return {
      ...metadata,
      blob: new Blob([new Uint8Array(bytes)], { type: photo.mimeType }),
    }
  })
  if (Object.keys(files).some((name) => !used.has(name)))
    invalid('백업에 메타데이터와 연결되지 않은 파일이 있습니다.')
  const data = { ...manifest.data, photos }
  validateSnapshot(data)
  return {
    data,
    createdAt: manifest.createdAt,
    counts: snapshotCounts(data),
    sizeBytes:
      files['metadata.json'].length +
      photos.reduce((sum, p) => sum + p.blob.size, 0),
  }
}
export async function restoreBackup(
  repos: Repositories,
  backup: PreparedBackup,
) {
  // The repository validates again inside its all-table replacement transaction.
  await repos.backup.replace(backup.data)
}
export function backupErrorMessage(error: unknown) {
  let cause = error
  for (let i = 0; i < 6 && cause !== null && typeof cause === 'object'; i++) {
    const detail = cause as {
      name?: string
      message?: string
      cause?: unknown
      inner?: unknown
    }
    if (
      detail.name === 'QuotaExceededError' ||
      /quota|storage.*full/i.test(detail.message ?? '')
    )
      return '저장 공간이 부족해 작업을 완료하지 못했어요. 복원 중이었다면 기존 데이터는 그대로 유지돼요. 기기 공간을 확보한 뒤 다시 시도해 주세요.'
    cause = detail.cause ?? detail.inner
  }
  return error instanceof Error &&
    'code' in error &&
    error.code === 'VALIDATION'
    ? error.message
    : '작업을 완료하지 못했어요. 복원 중이었다면 기존 데이터는 그대로 유지돼요. 파일과 저장 공간을 확인하고 다시 시도해 주세요.'
}

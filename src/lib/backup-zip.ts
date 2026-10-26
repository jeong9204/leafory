import { unzip, zip } from 'fflate'
import type { AsyncZippable } from 'fflate'
import { invalid } from '../domain/validation'

export const MAX_BACKUP_BYTES = 100 * 1024 * 1024
export const MAX_METADATA_BYTES = 10 * 1024 * 1024
export const MAX_BACKUP_PHOTO_BYTES = 15 * 1024 * 1024
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
interface ZipEntry {
  name: string
  size: number
  crc: number
}
/** Check central/local headers and budgets BEFORE decompression. ZIP64/encryption are unsupported. */
function inspectZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (p: number) => view.getUint16(p, true),
    u32 = (p: number) => view.getUint32(p, true)
  const end = bytes.length - 22
  if (
    u32(end) !== 0x06054b50 ||
    u16(end + 20) !== 0 ||
    u16(end + 4) !== 0 ||
    u16(end + 6) !== 0 ||
    u16(end + 8) !== u16(end + 10)
  )
    invalid('지원하지 않는 ZIP 구조입니다.')
  const count = u16(end + 10),
    start = u32(end + 16)
  if (!count || count > 10001 || start + u32(end + 12) !== end)
    invalid('ZIP 항목 수 또는 구조가 올바르지 않습니다.')
  let pos = start,
    total = 0
  const entries: ZipEntry[] = [],
    names = new Set<string>(),
    ranges: [number, number][] = []
  const decode = new TextDecoder('utf-8', { fatal: true })
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50)
      invalid('손상된 ZIP 헤더입니다.')
    const flags = u16(pos + 8),
      method = u16(pos + 10),
      compressed = u32(pos + 20),
      size = u32(pos + 24),
      nameLength = u16(pos + 28),
      offset = u32(pos + 42)
    const next = pos + 46 + nameLength + u16(pos + 30) + u16(pos + 32)
    if (
      next > end ||
      flags & 0x41 ||
      ![0, 8].includes(method) ||
      u16(pos + 34) !== 0
    )
      invalid('암호화되었거나 지원하지 않는 ZIP입니다.')
    const name = decode.decode(bytes.subarray(pos + 46, pos + 46 + nameLength))
    if (
      names.has(name) ||
      !(
        name === 'metadata.json' ||
        /^photos\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(name)
      )
    )
      invalid('ZIP 파일 이름 또는 경로가 올바르지 않습니다.')
    names.add(name)
    total += size
    if (
      size >
        (name === 'metadata.json'
          ? MAX_METADATA_BYTES
          : MAX_BACKUP_PHOTO_BYTES) ||
      total > MAX_BACKUP_BYTES ||
      compressed > MAX_BACKUP_BYTES
    )
      invalid('백업 압축 해제 크기 제한을 초과했습니다.')
    if (
      offset + 30 > start ||
      u32(offset) !== 0x04034b50 ||
      u16(offset + 6) !== flags ||
      u16(offset + 8) !== method
    )
      invalid('ZIP 파일 헤더가 일치하지 않습니다.')
    const localNameLength = u16(offset + 26),
      dataStart = offset + 30 + localNameLength + u16(offset + 28)
    if (
      dataStart + compressed > start ||
      decode.decode(
        bytes.subarray(offset + 30, offset + 30 + localNameLength),
      ) !== name ||
      (method === 0 && compressed !== size)
    )
      invalid('손상된 ZIP 데이터입니다.')
    ranges.push([offset, dataStart + compressed])
    entries.push({ name, size, crc: u32(pos + 16) })
    pos = next
  }
  if (pos !== end || !names.has('metadata.json'))
    invalid('백업 메타데이터가 없습니다.')
  ranges.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < ranges.length; i++)
    if (ranges[i][0] < ranges[i - 1][1])
      invalid('겹치는 ZIP 데이터가 있습니다.')
  return entries
}
export async function unpackBackup(
  bytes: Uint8Array,
): Promise<Record<string, Uint8Array>> {
  if (bytes.length < 22 || bytes.length > MAX_BACKUP_BYTES)
    invalid('백업 ZIP은 100MiB 이하 파일이어야 합니다.')
  let entries: ZipEntry[]
  try {
    entries = inspectZip(bytes)
  } catch {
    invalid(
      '손상되었거나 지원하지 않는 ZIP 구조입니다. 기존 데이터는 변경되지 않았어요.',
    )
  }
  const files = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) =>
      unzip(bytes, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
  )
  for (const entry of entries)
    if (
      !files[entry.name] ||
      files[entry.name].length !== entry.size ||
      crc32(files[entry.name]) !== entry.crc
    )
      invalid('ZIP 데이터가 손상되었습니다. 무결성 검사를 통과하지 못했어요.')
  return files
}
export function packBackup(files: AsyncZippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, { level: 0, mtime: new Date(1980, 0, 1) }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  )
}

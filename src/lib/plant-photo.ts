import type { PreparedPhoto } from '../app/plant-service'

export const MAX_INPUT_PHOTO_BYTES = 15 * 1024 * 1024
export const MAX_STORED_PHOTO_BYTES = 2 * 1024 * 1024
export const MAX_PHOTO_EDGE = 1600
export const MAX_PHOTO_PIXELS = 40_000_000
export function validatePhotoFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error(
      'JPEG, PNG, WebP 사진을 선택해 주세요. HEIC는 JPEG로 변환해 주세요.',
    )
  if (!file.size || file.size > MAX_INPUT_PHOTO_BYTES)
    throw new Error('사진은 비어 있지 않은 15MB 이하 파일로 선택해 주세요.')
}
export function matchesPhotoSignature(
  type: string,
  bytes: Uint8Array,
): boolean {
  if (type === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  if (type === 'image/webp')
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    )
  return false
}
export function scaledDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_PHOTO_PIXELS
  )
    throw new Error(
      '사진 해상도가 너무 높거나 올바르지 않습니다. 4,000만 화소 이하의 사진을 선택해 주세요.',
    )
  const ratio = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}
async function decode(file: File): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      /* Safari/image format fallback. */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () =>
        reject(new Error('사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.'))
      image.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}
export async function preparePlantPhoto(file: File): Promise<PreparedPhoto> {
  validatePhotoFile(file)
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!matchesPhotoSignature(file.type, bytes))
    throw new Error('파일 내용과 사진 형식이 일치하지 않습니다.')
  const decoded = await decode(file)
  const canvas = document.createElement('canvas')
  try {
    const size = scaledDimensions(decoded.width, decoded.height)
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서 사진을 처리할 수 없습니다.')
    context.fillStyle = '#F7F4EB'
    context.fillRect(0, 0, size.width, size.height)
    context.drawImage(decoded.source, 0, 0, size.width, size.height)
    for (const quality of [0.82, 0.72, 0.62]) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error('사진 변환에 실패했습니다.')),
          'image/jpeg',
          quality,
        ),
      )
      if (blob.size <= MAX_STORED_PHOTO_BYTES && blob.type === 'image/jpeg')
        return {
          blob,
          mimeType: blob.type,
          capturedAt: new Date().toISOString(),
        }
    }
    throw new Error(
      '사진을 충분히 압축하지 못했습니다. 다른 사진을 선택해 주세요.',
    )
  } finally {
    decoded.close()
    canvas.width = 0
    canvas.height = 0
  }
}

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  matchesPhotoSignature,
  preparePlantPhoto,
  scaledDimensions,
  validatePhotoFile,
  MAX_INPUT_PHOTO_BYTES,
  MAX_STORED_PHOTO_BYTES,
} from './plant-photo'
const jpeg = () =>
  new File([new Uint8Array([255, 216, 255, 224, 1])], 'plant.jpg', {
    type: 'image/jpeg',
  })
afterEach(() => vi.unstubAllGlobals())
describe('사진 입력 검증', () => {
  it('JPEG/PNG/WebP 시그니처를 검사하고 위장 파일을 거부한다', () => {
    expect(
      matchesPhotoSignature('image/jpeg', new Uint8Array([255, 216, 255])),
    ).toBe(true)
    expect(
      matchesPhotoSignature(
        'image/png',
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      ),
    ).toBe(true)
    expect(
      matchesPhotoSignature(
        'image/webp',
        new TextEncoder().encode('RIFF0000WEBP'),
      ),
    ).toBe(true)
    expect(
      matchesPhotoSignature('image/png', new TextEncoder().encode('<svg>')),
    ).toBe(false)
  })
  it('형식·용량·빈 파일을 검사한다', () => {
    expect(() => validatePhotoFile(jpeg())).not.toThrow()
    for (const file of [
      new File(['x'], 'photo.heic', { type: 'image/heic' }),
      new File([], 'empty.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array(MAX_INPUT_PHOTO_BYTES + 1)], 'large.png', {
        type: 'image/png',
      }),
    ])
      expect(() => validatePhotoFile(file)).toThrow()
  })
  it('긴 변을 1600px로 줄이고 작은 사진은 확대하지 않는다', () => {
    expect(scaledDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(scaledDimensions(600, 800)).toEqual({ width: 600, height: 800 })
    expect(() => scaledDimensions(10000, 10000)).toThrow()
  })
})
describe('압축 및 자원 정리', () => {
  let close: ReturnType<typeof vi.fn>
  let canvas: {
    width: number
    height: number
    getContext: ReturnType<typeof vi.fn>
    toBlob: ReturnType<typeof vi.fn>
  }
  beforeEach(() => {
    close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }),
    )
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toBlob: vi.fn((callback: (blob: Blob) => void) =>
        callback(new Blob(['compressed'], { type: 'image/jpeg' })),
      ),
    }
    vi.stubGlobal('document', { createElement: () => canvas })
  })
  it('디코딩 후 JPEG로 변환하고 비트맵/캔버스를 해제한다', async () => {
    const result = await preparePlantPhoto(jpeg())
    expect(result.mimeType).toBe('image/jpeg')
    expect(await result.blob.text()).toBe('compressed')
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.82,
    )
    expect(close).toHaveBeenCalledOnce()
    expect(canvas.width).toBe(0)
  })
  it('MIME 위장 파일은 디코딩 전에 거부한다', async () => {
    await expect(
      preparePlantPhoto(new File(['fake'], 'fake.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow('일치하지')
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('압축 결과가 큰 경우 품질을 낮추고 실패 시에도 자원을 해제한다', async () => {
    canvas.toBlob.mockImplementation((callback: (blob: Blob) => void) =>
      callback(
        new Blob([new Uint8Array(MAX_STORED_PHOTO_BYTES + 1)], {
          type: 'image/jpeg',
        }),
      ),
    )
    await expect(preparePlantPhoto(jpeg())).rejects.toThrow('충분히 압축')
    expect(canvas.toBlob.mock.calls.map((c) => c[2])).toEqual([
      0.82, 0.72, 0.62,
    ])
    expect(close).toHaveBeenCalledOnce()
  })
  it('디코딩된 해상도와 캔버스 오류를 안전하게 처리한다', async () => {
    vi.mocked(createImageBitmap).mockResolvedValueOnce({
      width: 10000,
      height: 10000,
      close,
    } as unknown as ImageBitmap)
    await expect(preparePlantPhoto(jpeg())).rejects.toThrow('해상도')
    expect(close).toHaveBeenCalledOnce()
    canvas.getContext.mockReturnValue(null)
    await expect(preparePlantPhoto(jpeg())).rejects.toThrow('처리할 수')
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlantPhoto } from './PlantPhoto'
describe('Blob URL 수명', () => {
  it('사진 교체와 언마운트 시 각각 이전 URL을 해제한다', () => {
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const result = render(
      <PlantPhoto blob={new Blob(['a'])} alt="사진" className="photo" />,
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:first')
    result.rerender(
      <PlantPhoto blob={new Blob(['b'])} alt="사진" className="photo" />,
    )
    expect(revoke).toHaveBeenCalledWith('blob:first')
    result.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:second')
    create.mockRestore()
    revoke.mockRestore()
  })
})

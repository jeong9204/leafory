import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, testDatabase } from '../test/render-app'

let context: ReturnType<typeof testDatabase>
beforeEach(() => {
  context = testDatabase()
})
afterEach(async () => {
  vi.restoreAllMocks()
  await context.db.delete()
})
async function editor() {
  renderApp(context.repos, '/plants/new')
  return screen.findByLabelText(/식물 이름/)
}

describe('등록·수정 학명 추천', () => {
  it('후보는 자동 선택하지 않고 키보드 선택 시 학명만 채우며 직접 고쳐 저장할 수 있다', async () => {
    const user = userEvent.setup()
    const name = await editor()
    await user.type(name, '스투키')
    const species = screen.getByLabelText(/학명 또는 품종/)
    expect(species).toHaveValue('')
    expect(screen.getAllByRole('button', { name: /학명 선택$/ })).toHaveLength(
      2,
    )
    const candidate = screen.getByRole('button', {
      name: /Dracaena angolensis 학명 선택/,
    })
    candidate.focus()
    await user.keyboard('{Enter}')
    expect(species).toHaveValue('Dracaena angolensis')
    expect(name).toHaveValue('스투키')
    expect(await context.repos.plants.list()).toEqual([])
    await user.clear(species)
    await user.type(species, '직접 확인한 품종')
    await user.clear(name)
    await user.type(name, '나만의 스투키')
    expect(species).toHaveValue('직접 확인한 품종')
    await user.click(screen.getByRole('button', { name: '식물 등록' }))
    await screen.findByRole('heading', { name: '나만의 스투키' })
    expect((await context.repos.plants.list())[0]).toMatchObject({
      name: '나만의 스투키',
      species: '직접 확인한 품종',
    })
  })
  it('검색 결과가 있어도 선택하지 않고 이름만 저장할 수 있다', async () => {
    const user = userEvent.setup()
    await user.type(await editor(), '몬스테라')
    await user.click(screen.getByRole('button', { name: '식물 등록' }))
    await screen.findByRole('heading', { name: '몬스테라' })
    const plants = await context.repos.plants.list()
    expect(plants).toHaveLength(1)
    expect(plants[0].species).toBeUndefined()
  })
  it('후보가 없는 이름은 직접 입력 가능하며 저장 실패 시 선택한 학명과 입력을 유지한다', async () => {
    const user = userEvent.setup()
    const name = await editor()
    await user.type(name, '없는식물이름')
    expect(screen.getByRole('status')).toHaveTextContent('직접 입력하거나 비워')
    await user.type(screen.getByLabelText(/학명 또는 품종/), '내 품종')
    await user.clear(name)
    await user.type(name, '괴마옥')
    expect(screen.getByLabelText(/학명 또는 품종/)).toHaveValue('내 품종')
    await user.click(
      screen.getByRole('button', { name: /Euphorbia bupleurifolia 학명 선택/ }),
    )
    await user.type(screen.getByLabelText(/식물 메모/), '남길 메모')
    vi.spyOn(context.repos, 'runInTransaction').mockRejectedValueOnce(
      new Error('storage full'),
    )
    await user.click(screen.getByRole('button', { name: '식물 등록' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '입력 내용을 유지',
    )
    expect(name).toHaveValue('괴마옥')
    expect(screen.getByLabelText(/학명 또는 품종/)).toHaveValue(
      'Euphorbia bupleurifolia',
    )
    expect(screen.getByLabelText(/식물 메모/)).toHaveValue('남길 메모')
    expect(await context.repos.plants.list()).toEqual([])
  })
  it('기존 학명은 후보 검색이나 이름 수정으로 자동 교정하지 않으며 명시적 선택만 반영한다', async () => {
    const user = userEvent.setup()
    const plant = await context.repos.plants.create({
      name: '스투키',
      species: 'Sansevieria trifasciata',
      status: 'observing',
      memo: '기존 메모',
      acquiredAt: '2025-01-02',
    })
    renderApp(context.repos, `/plants/${plant.id}/edit`)
    const name = await screen.findByLabelText(/식물 이름/)
    const species = screen.getByLabelText(/학명 또는 품종/)
    expect(species).toHaveValue('Sansevieria trifasciata')
    fireEvent.change(name, { target: { value: '극락조' } })
    expect(species).toHaveValue('Sansevieria trifasciata')
    await user.click(screen.getByRole('button', { name: '수정 저장' }))
    await screen.findByRole('heading', { name: '극락조' })
    expect(await context.repos.plants.getById(plant.id)).toMatchObject({
      species: 'Sansevieria trifasciata',
      status: 'observing',
      memo: '기존 메모',
      acquiredAt: '2025-01-02',
    })
    await user.click(screen.getByRole('button', { name: '식물 관리 메뉴' }))
    await user.click(screen.getByRole('link', { name: '정보 수정' }))
    await screen.findByLabelText(/식물 이름/)
    await user.click(
      screen.getByRole('button', { name: /Strelitzia nicolai 학명 선택/ }),
    )
    expect(screen.getByLabelText(/학명 또는 품종/)).toHaveValue(
      'Strelitzia nicolai',
    )
    await user.click(screen.getByRole('button', { name: '수정 저장' }))
    await screen.findByRole('heading', { name: '극락조' })
    expect(await context.repos.plants.getById(plant.id)).toMatchObject({
      species: 'Strelitzia nicolai',
      status: 'observing',
      memo: '기존 메모',
      acquiredAt: '2025-01-02',
    })
  })
})

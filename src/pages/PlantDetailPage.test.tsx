import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  fixtureIds,
  renderApp,
  seedPlants,
  testDatabase,
} from '../test/render-app'
const mockPlants = [
  {
    id: fixtureIds[0],
    name: '괴마옥',
    scientificName: 'Euphorbia bupleurifolia',
  },
  { id: fixtureIds[1], name: '몬스테라', scientificName: 'Monstera deliciosa' },
  {
    id: fixtureIds[2],
    name: '스투키',
    scientificName: 'Sansevieria trifasciata',
  },
]
let context: ReturnType<typeof testDatabase>
beforeEach(async () => {
  context = testDatabase()
  await seedPlants(context.repos)
})
afterEach(async () => context.db.delete())
import { PlantRecordTabs } from '../components/plant-detail/PlantRecordTabs'
import { PlantTimeline } from '../components/plant-detail/PlantTimeline'

function renderDetail(id = fixtureIds[0]) {
  return renderApp(context.repos, `/plants/${id}`)
}

describe('식물 상세 화면', () => {
  it.each(mockPlants)(
    '$name 경로에 맞는 식물 정보와 기록 수를 표시한다',
    async (plant) => {
      renderDetail(plant.id)
      expect(
        await screen.findByRole('heading', { level: 1, name: plant.name }),
      ).toBeInTheDocument()
      expect(screen.getByText(plant.scientificName)).toBeInTheDocument()
      expect(
        screen.getByRole('img', {
          name: `${plant.name} 대표 사진 (사진 없음)`,
        }),
      ).toBeInTheDocument()
      const summary = screen.getByRole('region', {
        name: `${plant.name} 현재 상태와 관리 요약`,
      })
      expect(within(summary).getByText('0개')).toBeInTheDocument()
      expect(within(summary).getAllByText('기록 없음')).toHaveLength(2)
      expect(screen.getByText('아직 기록이 없어요.')).toBeVisible()
    },
  )

  it('빠른 기록은 활성 상태이며 메모 수정은 실제 편집 화면으로 연결한다', async () => {
    renderDetail()
    await screen.findByRole('heading', { name: '괴마옥' })
    expect(screen.getByRole('link', { name: '빠른 기록' })).toHaveAttribute(
      'href',
      `/plants/${fixtureIds[0]}/care/new`,
    )
    expect(screen.getByRole('link', { name: '일기 쓰기' })).toHaveAttribute(
      'href',
      `/plants/${fixtureIds[0]}/diary/new`,
    )
    expect(screen.getByRole('link', { name: '수정하기' })).toHaveAttribute(
      'href',
      `/plants/${fixtureIds[0]}/edit`,
    )
    expect(
      screen.getByText('몸통은 단단하고, 잎 상태는 안정적이에요.'),
    ).toBeInTheDocument()
  })

  it('사진 탭과 타임라인 탭이 서로 다른 패널을 전환한다', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('tab', { name: '사진' })
    await user.click(screen.getByRole('tab', { name: '사진' }))
    expect(screen.getByRole('tab', { name: '사진' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const photos = screen.getByRole('tabpanel', { name: '사진' })
    expect(within(photos).getByText('아직 사진이 없어요.')).toBeVisible()
    expect(
      screen.queryByRole('list', { name: '식물 관리 타임라인' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '타임라인' }))
    expect(screen.getByText('아직 기록이 없어요.')).toBeVisible()
  })

  it('방향키와 Home/End로 탭 선택과 키보드 포커스를 이동한다', async () => {
    const user = userEvent.setup()
    renderDetail()
    const timeline = await screen.findByRole('tab', { name: '타임라인' })
    const photos = screen.getByRole('tab', { name: '사진' })
    timeline.focus()
    await user.keyboard('{ArrowRight}')
    expect(photos).toHaveFocus()
    expect(photos).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(timeline).toHaveFocus()
    await user.keyboard('{End}')
    expect(photos).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(timeline).toHaveFocus()
  })

  it('홈 → 상세 → 뒤로 가기 링크로 홈을 복구한다', async () => {
    const user = userEvent.setup()
    renderApp(context.repos)
    await screen.findByRole('heading', { name: '나의 작은 정원' })
    await user.click(screen.getByRole('link', { name: '괴마옥 상세 보기' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: '괴마옥' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('link', { name: '내 식물 목록으로 돌아가기' }),
    )
    expect(
      await screen.findByRole('heading', { name: '나의 작은 정원' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: '내 식물 목록' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(3)
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('존재하지 않는 ID는 다른 식물 정보를 대신 보여주지 않는다', async () => {
    renderDetail('missing')
    expect(
      await screen.findByRole('heading', { name: '식물을 찾을 수 없습니다' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '내 식물로 돌아가기' }),
    ).toHaveAttribute('href', '/')
  })
})

describe('재사용 기록 컴포넌트', () => {
  it('기록과 사진이 비어 있을 때 빈 상태를 표시한다', async () => {
    const user = userEvent.setup()
    render(<PlantRecordTabs entries={[]} />)
    expect(screen.getByText('아직 기록이 없어요.')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: '사진' }))
    expect(screen.getByText('아직 사진이 없어요.')).toBeVisible()
  })
  it('사진이 없는 관리 이벤트도 표시한다', () => {
    render(
      <PlantTimeline
        entries={[
          {
            id: 'light-only',
            kind: 'light',
            date: '2026-10-24',
            title: '식물등 3시간',
            description: '사진 없는 관리 기록',
          },
        ]}
      />,
    )
    expect(
      screen.getByRole('heading', { name: '식물등 3시간' }),
    ).toBeInTheDocument()
    expect(screen.getByText('사진 없는 관리 기록')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

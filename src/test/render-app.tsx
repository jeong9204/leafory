import 'fake-indexeddb/auto'
import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import App from '../App'
import { routes } from '../app/routes'
import { RepositoryProvider } from '../app/RepositoryProvider'
import { LeaforyDatabase } from '../data/local/database'
import { createLocalRepositories } from '../data/local/repositories'
import type { Repositories } from '../domain/repositories'
export function testDatabase() {
  const db = new LeaforyDatabase(`leafory-ui-${crypto.randomUUID()}`)
  return { db, repos: createLocalRepositories(db) }
}
export function renderApp(repositories: Repositories, path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <RepositoryProvider repositories={repositories}>
      <App router={router} />
    </RepositoryProvider>,
  )
}
export const fixtureIds = [
  'c13d892e-140d-491a-8087-a8bcd80bab01',
  'c13d892e-140d-491a-8087-a8bcd80bab02',
  'c13d892e-140d-491a-8087-a8bcd80bab03',
]
export async function seedPlants(repos: Repositories, withCare = false) {
  const fixtures = [
    ['괴마옥', 'Euphorbia bupleurifolia', 'observing', '2026-10-21', 3],
    ['몬스테라', 'Monstera deliciosa', 'healthy', '2026-10-18', 6],
    ['스투키', 'Sansevieria trifasciata', 'healthy', '2026-10-12', 4],
  ] as const
  for (const [index, fixture] of fixtures.entries()) {
    const [name, species, status, last, light] = fixture
    await repos.plants.create({
      id: fixtureIds[index],
      name,
      species,
      status,
      memo: '몸통은 단단하고, 잎 상태는 안정적이에요.',
    })
    if (withCare) {
      await repos.careEvents.create({
        plantId: fixtureIds[index],
        eventType: 'watering',
        occurredAt: `${last}T12:00:00Z`,
      })
      await repos.careEvents.create({
        plantId: fixtureIds[index],
        eventType: 'grow_light',
        occurredAt: new Date(2026, 9, 24, 12).toISOString(),
        durationMinutes: light * 60,
      })
    }
  }
}

import type { Plant } from '../../domain/models'
export function plantArt(plant: Pick<Plant, 'name' | 'species'>) {
  // Decorative hints only. A user-provided species takes precedence over a nickname.
  const text = (plant.species || plant.name).toLowerCase()
  if (/monstera|몬스테라/.test(text)) return 'monstera'
  if (/adenium|아데니움|사막의 장미/.test(text)) return 'adenium'
  if (/sansevieria|dracaena trifasciata|스투키|산세베리아/.test(text))
    return 'snake'
  if (/epipremnum|scindapsus|philodendron|스킨답서스|필로덴드론/.test(text))
    return 'trailing'
  if (/salvia rosmarinus|rosmarinus|로즈마리/.test(text)) return 'rosemary'
  if (/echeveria|crassula|다육|에케베리아/.test(text)) return 'succulent'
  if (/euphorbia bupleurifolia|cact|괴마옥|선인장/.test(text)) return 'cactus'
  return 'default'
}

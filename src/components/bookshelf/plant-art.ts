import type { Plant } from '../../domain/models'
export function plantArt(plant: Pick<Plant, 'name' | 'species'>) {
  // Decorative hints only. A user-provided species takes precedence over a nickname.
  const species = plant.species?.trim().toLowerCase().replace(/\s+/g, ' ')
  const text = species || plant.name.trim().toLowerCase()
  // Exact taxon/name only: uncertain Euphorbia names must not imply this species.
  if (
    species === 'euphorbia bupleurifolia' ||
    (!species &&
      /^(괴마옥|유포르비아 부플레우리폴리아|euphorbia bupleurifolia)$/.test(
        text,
      ))
  )
    return 'euphorbia-bupleurifolia'
  if (/monstera|몬스테라/.test(text)) return 'monstera'
  if (/adenium|아데니움|사막의 장미/.test(text)) return 'adenium'
  if (/sansevieria|dracaena trifasciata|스투키|산세베리아/.test(text))
    return 'snake'
  if (/philodendron|필로덴드론/.test(text)) return 'philodendron'
  if (/euonymus|사철/.test(text)) return 'evergreen'
  if (/epipremnum|scindapsus|스킨답서스/.test(text)) return 'trailing'
  if (/salvia rosmarinus|rosmarinus|로즈마리/.test(text)) return 'rosemary'
  if (/echeveria|crassula|다육|에케베리아/.test(text)) return 'succulent'
  if (/cact|선인장/.test(text)) return 'cactus'
  return 'default'
}

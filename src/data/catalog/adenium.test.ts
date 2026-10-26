import { describe, expect, it } from 'vitest'
import { searchPlantCatalog } from './search'
const names = (query: string) =>
  searchPlantCatalog(query).map((plant) => plant.scientificName)

describe('아데니움 카탈로그 검색 회귀', () => {
  it.each([
    '아데니움',
    'Adenium',
    '사막의 장미',
    '사막의장미',
    'aDeNiUm',
    'adeni',
    '아데',
  ])('%s 검색은 종을 확정하지 않고 복수 후보를 반환한다', (query) => {
    expect(names(query)).toEqual(['Adenium obesum', 'Adenium multiflorum'])
  })
  it.each(['Adenium arabicum', '아데니움 아라비쿰'])(
    '%s은 POWO 기준 동의어 후보로 연결하고 별도 종으로 중복 표시하지 않는다',
    (query) => {
      expect(names(query)).toEqual(['Adenium obesum'])
    },
  )
  it.each(['Adenium obesum', 'Adenium multiflorum'])(
    '%s 종명을 입력하면 해당 후보를 찾는다',
    (scientificName) => {
      expect(names(scientificName)).toEqual([scientificName])
    },
  )
})

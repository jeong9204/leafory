import { describe, expect, it } from 'vitest'
import { plantCatalog, searchPlantCatalog } from './search'

const names = (query: string) =>
  searchPlantCatalog(query).map((p) => p.scientificName)

describe('로컬 식물 카탈로그 검색', () => {
  it('32종의 고유 후보와 개별 분류 출처·확인 날짜를 제공한다', () => {
    expect(plantCatalog).toHaveLength(32)
    expect(new Set(plantCatalog.map((p) => p.id)).size).toBe(32)
    expect(new Set(plantCatalog.map((p) => p.scientificName)).size).toBe(32)
    for (const plant of plantCatalog) {
      expect(plant.commonName).not.toBe('')
      expect(plant.sourceUrl).toMatch(
        /^https:\/\/powo.science.kew.org\/taxon\/urn:lsid:ipni.org:names:\d+-\d$/,
      )
      expect(plant.checkedAt).toBe('2026-10-26')
    }
  })
  it.each([
    ['괴마옥', 'Euphorbia bupleurifolia'],
    ['나비란', 'Chlorophytum comosum'],
    ['제이드플랜트', 'Crassula ovata'],
    ['Monstera deliciosa', 'Monstera deliciosa'],
    ['  MONSTERA   DEL  ', 'Monstera deliciosa'],
    ['Ｍｏｎｓｔｅｒａ', 'Monstera deliciosa'],
    ['스테라', 'Monstera deliciosa'],
    ['산세베리아 실린드리카', 'Dracaena angolensis'],
    ['Sansevieria cylindrica', 'Dracaena angolensis'],
    ['Calathea orbifolia', 'Goeppertia orbifolia'],
    ['Dypsis lutescens', 'Chrysalidocarpus lutescens'],
    ['Thaumatophyllum bipinnatifidum', 'Philodendron bipinnatifidum'],
  ])(
    '%s 일반명·별칭·현행/이전 학명과 부분 일치를 지원한다',
    (query, expected) => {
      expect(names(query)).toContain(expected)
    },
  )
  it('모호한 유통명에 서로 다른 종을 후보로 유지한다', () => {
    expect(names('스투키')).toEqual(['Dracaena angolensis', 'Dracaena stuckyi'])
    expect(names('극락조')).toEqual([
      'Strelitzia reginae',
      'Strelitzia nicolai',
    ])
    expect(names('스킨답서스')).toEqual([
      'Epipremnum aureum',
      'Scindapsus pictus',
    ])
    expect(names('고무나무')).toHaveLength(4)
    expect(names('몬스테라')).toHaveLength(2)
  })
  it('빈 검색과 미등록 이름에는 후보가 없고 원본 순서를 변경하지 않는다', () => {
    const original = plantCatalog.map((p) => p.id)
    for (const query of ['', '   ', '없는식물이름', '· _-'])
      expect(names(query)).toEqual([])
    names('고무나무')
    expect(plantCatalog.map((p) => p.id)).toEqual(original)
  })
})

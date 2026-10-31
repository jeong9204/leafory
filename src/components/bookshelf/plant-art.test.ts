import { describe, it, expect } from 'vitest'
import { plantArt } from './plant-art'
describe('장식용 화분 선택', () => {
  it.each([
    ['괴마옥', 'euphorbia-bupleurifolia'],
    ['선인장', 'cactus'],
    ['유포르비아 부플레우리폴리아', 'euphorbia-bupleurifolia'],
    ['몬스테라', 'monstera'],
    ['아데니움', 'adenium'],
    ['스투키', 'snake'],
    ['필로덴드론', 'philodendron'],
    ['스킨답서스', 'trailing'],
    ['사철', 'evergreen'],
    ['로즈마리', 'rosemary'],
    ['다육이', 'succulent'],
    ['나의 친구', 'default'],
  ])('%s에 %s 그림을 쓴다', (name, art) => expect(plantArt({ name })).toBe(art))
  it.each([
    [
      { name: '선인장', species: 'Euphorbia bupleurifolia' },
      'euphorbia-bupleurifolia',
    ],
    [{ name: '괴마옥', species: 'Cactaceae' }, 'cactus'],
    [{ name: '괴마옥', species: 'Euphorbia bupleurifolia hybrid' }, 'default'],
    [{ name: '괴마옥', species: 'Euphorbia bupleurifoliax' }, 'default'],
    [{ name: '괴마옥 같은 친구' }, 'default'],
    [{ name: 'Euphorbia bupleurifolia' }, 'euphorbia-bupleurifolia'],
    [
      { name: '괴마옥', species: ' Euphorbia   bupleurifolia ' },
      'euphorbia-bupleurifolia',
    ],
    [{ name: '괴마옥', species: '   ' }, 'euphorbia-bupleurifolia'],
  ])('정확한 표시 힌트만 사용한다: %j', (plant, expected) => {
    const before = { ...plant }
    expect(plantArt(plant)).toBe(expected)
    expect(plant).toEqual(before)
  })
  it('사용자 별명보다 학명 힌트를 우선하고 분류를 저장하지 않는다', () => {
    const plant = { name: '몬스테라라는 별명', species: 'Adenium obesum' }
    expect(plantArt(plant)).toBe('adenium')
    expect(plant.species).toBe('Adenium obesum')
  })
})

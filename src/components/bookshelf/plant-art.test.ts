import { describe, it, expect } from 'vitest'
import { plantArt } from './plant-art'
describe('장식용 화분 선택', () => {
  it.each([
    ['괴마옥', 'cactus'],
    ['몬스테라', 'monstera'],
    ['아데니움', 'adenium'],
    ['스투키', 'snake'],
    ['필로덴드론', 'trailing'],
    ['로즈마리', 'rosemary'],
    ['다육이', 'succulent'],
    ['나의 친구', 'default'],
  ])('%s에 %s 그림을 쓴다', (name, art) => expect(plantArt({ name })).toBe(art))
  it('사용자 별명보다 학명 힌트를 우선하고 분류를 저장하지 않는다', () => {
    const plant = { name: '몬스테라라는 별명', species: 'Adenium obesum' }
    expect(plantArt(plant)).toBe('adenium')
    expect(plant.species).toBe('Adenium obesum')
  })
})

import { daysBefore } from '../../lib/dates'

export interface MockPlant {
  id: string
  name: string
  scientificName: string
  image: string
  status: string
  lastWatered: string
  lightHours: number
}

// Fixed sample history: elapsed days continue to change with the actual date.
export const mockPlants: MockPlant[] = [
  {
    id: 'euphorbia',
    name: '괴마옥',
    scientificName: 'Euphorbia bupleurifolia',
    image: '/images/cactus.jpg',
    status: '관찰 중',
    lastWatered: '2026-10-21',
    lightHours: 3,
  },
  {
    id: 'monstera',
    name: '몬스테라',
    scientificName: 'Monstera deliciosa',
    image: '/images/monstera.jpg',
    status: '잘 자라는 중',
    lastWatered: '2026-10-18',
    lightHours: 6,
  },
  {
    id: 'snake-plant',
    name: '스투키',
    scientificName: 'Sansevieria trifasciata',
    image: '/images/snake-plant.jpg',
    status: '건강해요',
    lastWatered: '2026-10-12',
    lightHours: 4,
  },
]

export function createMockRecords(today: string) {
  return [
    {
      id: 'new-leaf',
      date: today,
      title: '새잎 확인',
      description: '작은 새잎이 또 나왔어요. 🌱',
      image: '/images/monstera.jpg',
      imageAlt: '초록빛 몬스테라 잎',
      plantId: 'monstera',
    },
    {
      id: 'watering',
      date: daysBefore(today, 1),
      title: '물주기 완료',
      description: '겉흙이 말라서 물을 듬뿍 줬어요.',
      image: '/images/cactus.jpg',
      imageAlt: '물을 준 괴마옥 화분',
      plantId: 'euphorbia',
    },
    {
      id: 'light',
      date: daysBefore(today, 2),
      title: '식물등 3시간',
      description: '오늘도 햇빛을 충분히 받았어요.',
      image: '/images/cactus.jpg',
      imageAlt: '괴마옥 화분',
      plantId: 'euphorbia',
    },
    {
      id: 'observation',
      date: daysBefore(today, 3),
      title: '건강하게 자라는 중',
      description: '잎 상태를 살펴봤어요.',
      image: '/images/snake-plant.jpg',
      imageAlt: '곧게 자라는 스투키',
      plantId: 'snake-plant',
    },
  ]
}

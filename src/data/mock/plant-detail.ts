import { daysBefore, todayKey } from '../../lib/dates'
import type { MockPlant } from './home'

export interface PlantTimelineEntry {
  id: string
  kind: 'growth' | 'watering' | 'light'
  date: string
  title: string
  description: string
  image?: string
  imageAlt?: string
}

/** UI-only fixtures; no database instance or persistence. */
export function createMockPlantDetail(plant: MockPlant, today = todayKey()) {
  const entries: PlantTimelineEntry[] = [
    {
      id: `${plant.id}-growth`,
      kind: 'growth',
      date: today,
      title: '새잎 확인',
      description: '작은 새잎이 또 나왔어요. 🌱',
      image: plant.image,
      imageAlt: `${plant.name} 성장 관찰 사진`,
    },
    {
      id: `${plant.id}-watering`,
      kind: 'watering',
      date: plant.lastWatered,
      title: '물주기 완료',
      description: '겉흙이 말라서 물을 듬뿍 줬어요.',
      image: plant.image,
      imageAlt: `${plant.name} 물주기 기록 사진`,
    },
    {
      id: `${plant.id}-light`,
      kind: 'light',
      date: daysBefore(plant.lastWatered, 1),
      title: `식물등 ${plant.lightHours}시간`,
      description: '오늘은 조명을 조금 더 길게 켰어요.',
      image: plant.image,
      imageAlt: `${plant.name} 식물등 관리 기록 사진`,
    },
  ]
  return {
    entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
    message:
      plant.id === 'euphorbia'
        ? '오늘도 천천히\n자라고 있어요.'
        : '초록빛 하루를\n함께하고 있어요.',
    memo:
      plant.id === 'euphorbia'
        ? '몸통은 단단하고, 잎 상태는 안정적이에요.'
        : '잎 상태와 흙의 마름을 천천히 살펴보고 있어요.',
  }
}

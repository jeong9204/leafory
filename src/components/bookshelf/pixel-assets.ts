import type { SyntheticEvent } from 'react'

/** Reviewed originals remain in painted/; display assets never change user data. */
export const refinedAssets = {
  adenium: [192, 192],
  monstera: [192, 192],
  'euphorbia-bupleurifolia': [192, 192],
  cactus: [192, 192],
  trailing: [192, 192],
  philodendron: [192, 192],
  evergreen: [192, 192],
  snake: [192, 192],
  rosemary: [192, 192],
  succulent: [192, 192],
  default: [192, 192],
  ivy: [120, 339],
  books: [96, 120],
  frame: [96, 96],
  lamp: [96, 120],
  cat: [192, 120],
  globe: [96, 120],
  lantern: [96, 120],
  house: [48, 60],
  spray: [48, 60],
  can: [120, 96],
} as const

export function pixelAsset(art: string) {
  return Object.hasOwn(refinedAssets, art)
    ? `/pixel/refined/${art}.webp`
    : `/pixel/${art}.svg`
}

export function pixelDimensions(art: string): readonly [number, number] {
  return Object.hasOwn(refinedAssets, art)
    ? refinedAssets[art as keyof typeof refinedAssets]
    : [80, 96]
}

/** A failed default must not create an infinite error/request loop. */
export function fallbackPixelAsset(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  const fallback = pixelAsset('default')
  if (image.getAttribute('src') !== fallback) image.src = fallback
}

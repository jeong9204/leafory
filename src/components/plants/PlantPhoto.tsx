import { useEffect, useRef } from 'react'
import { Sprout } from 'lucide-react'
interface PhotoProps {
  blob?: Blob
  alt: string
  className: string
  width?: number | string
  height?: number | string
}
function BlobPhoto({
  blob,
  alt,
  className,
  width,
  height,
}: PhotoProps & { blob: Blob }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(blob)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return (
    <img
      ref={image}
      alt={alt}
      className={className}
      width={width}
      height={height}
    />
  )
}
export function PlantPhoto(props: PhotoProps) {
  if (props.blob) return <BlobPhoto {...props} blob={props.blob} />
  return (
    <div
      className={`${props.className} plant-photo-placeholder`}
      role="img"
      aria-label={`${props.alt} (사진 없음)`}
    >
      <Sprout aria-hidden="true" />
      <span>사진 없음</span>
    </div>
  )
}

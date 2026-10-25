export function DataFeedback({
  error,
  retry,
}: {
  error?: boolean
  retry?: () => void
}) {
  if (error)
    return (
      <section className="data-feedback" role="alert">
        <h1>정보를 불러오지 못했어요</h1>
        <p>
          이 기기의 저장 공간과 브라우저 설정을 확인한 뒤 다시 시도해 주세요.
        </p>
        <button type="button" onClick={retry}>
          다시 시도
        </button>
      </section>
    )
  return (
    <p className="data-feedback" role="status">
      초록빛 기록을 불러오는 중이에요…
    </p>
  )
}

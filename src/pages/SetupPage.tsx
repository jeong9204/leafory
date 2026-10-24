interface SetupPageProps {
  title: string
}

export function SetupPage({ title }: SetupPageProps) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-forest">{title}</h1>
      <p className="mt-3 leading-relaxed">
        프로젝트 초기 설정이 완료되었습니다. 화면과 기능은 다음 단계에서
        구현합니다.
      </p>
    </>
  )
}

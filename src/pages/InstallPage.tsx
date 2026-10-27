import { useEffect, useState } from 'react'
import { Link } from 'react-router'

export function InstallPage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    if (
      import.meta.env.PROD &&
      window.isSecureContext &&
      'serviceWorker' in navigator
    ) {
      void navigator.serviceWorker.ready.then(() => {
        if (alive) setReady(true)
      })
    }
    return () => {
      alive = false
    }
  }, [])
  const secure = window.isSecureContext
  const supported = 'serviceWorker' in navigator
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)
  return (
    <div className="install-page">
      <Link to="/">← 내 정원으로</Link>
      <h1>Leafory를 홈 화면에</h1>
      <p>
        {standalone
          ? '홈 화면 앱으로 사용 중이에요.'
          : '홈 화면에 추가해 나의 정원을 편하게 기록하세요.'}
      </p>
      {(!secure || !supported) && (
        <p role="status">
          현재 접속 환경에서는 오프라인 준비를 할 수 없어요. HTTPS 주소의 Safari
          또는 Chrome에서 열어 주세요.
        </p>
      )}
      {ready && (
        <p role="status">
          오프라인 지원이 활성화됐어요. 필요한 앱 파일이 이 기기에 남아 있을 때
          다시 열 수 있어요.
        </p>
      )}
      <section className="surface">
        <h2>iPhone · iPad</h2>
        <ol>
          <li>Safari에서 Leafory를 열어 주세요.</li>
          <li>공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요.</li>
          <li>‘웹 앱으로 열기’가 보이면 켜고 추가하세요.</li>
        </ol>
      </section>
      <section className="surface">
        <h2>Android</h2>
        <ol>
          <li>Chrome에서 Leafory를 열어 주세요.</li>
          <li>메뉴의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.</li>
          <li>Leafory 아이콘을 눌러 다시 열어 보세요.</li>
        </ol>
      </section>
      <section className="surface">
        <h2>연결이 없어도 함께해요</h2>
        <p>
          처음에는 온라인에서 앱을 열고 필요한 화면·폰트·파일 저장이 끝날 때까지
          기다려 주세요. 필요한 앱 파일(캐시)이 남아 있고 이 기기의 기록을 읽을
          수 있을 때 식물 등록, 사진 일기, 관리 기록, 캘린더와 ZIP 백업·복원을
          오프라인에서 사용할 수 있어요.
        </p>
        <p>
          앱 파일이 아직 저장되지 않았거나 브라우저가 정리한 경우에는 연결 후
          다시 열어야 해요. 사진 선택과 파일 저장은 기기·브라우저 지원에 따라
          달라질 수 있어요.
        </p>
        <p>
          학명 분류의 외부 출처 보기와 새 버전 다운로드는 인터넷 연결이
          필요해요.
        </p>
      </section>
      <section className="surface">
        <h2>기록은 이 기기에 저장돼요</h2>
        <p>
          사진과 기록은 이 브라우저·기기의 로컬 저장소에만 저장돼요. 계정과
          클라우드 동기화는 제공하지 않아요.
        </p>
        <p>
          설치 전후 또는 다른 주소·브라우저·기기로 이동할 때는 ZIP 백업을 보관해
          주세요. 기록이 따로 보이면 백업·복원으로 옮길 수 있어요.
        </p>
        <p>
          앱 업데이트는 저장한 사진과 기록을 지우지 않아요. 브라우저 데이터
          삭제는 앱 업데이트와 달라요.
        </p>
        <Link to="/backup" className="secondary-button">
          데이터 백업·복원
        </Link>
      </section>
    </div>
  )
}

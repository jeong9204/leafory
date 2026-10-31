import {
  Archive,
  ChevronRight,
  Download,
  Plus,
  Sprout,
  NotebookText,
} from 'lucide-react'
import { Link } from 'react-router'
import { useCallback, useEffect, useState } from 'react'
import { loadBookshelf } from '../app/bookshelf-service'
import { useRepositories } from '../app/repository-context'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { localDateKey } from '../domain/calendar'
import { DataFeedback } from '../components/plants/DataFeedback'
import { fullDate } from '../lib/dates'
import { Bookshelf, PixelDecoration } from '../components/bookshelf/Bookshelf'
import {
  pixelAsset,
  fallbackPixelAsset,
} from '../components/bookshelf/pixel-assets'
import { plantArt } from '../components/bookshelf/plant-art'
import './bookshelf-home.css'
export function HomePage() {
  const [today, setToday] = useState(localDateKey)
  useEffect(() => {
    const refresh = () => setToday(localDateKey())
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const { repositories } = useRepositories()
  const query = useCallback(
    () => loadBookshelf(repositories, today),
    [repositories, today],
  )
  const { result, reload } = useRepositoryQuery(query)
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error') return <DataFeedback error retry={reload} />
  const { views, records, weekCount } = result.data
  return (
    <div className="bookshelf-home">
      <header className="garden-header">
        <PixelDecoration art="ivy" className="header-ivy" />
        <PixelDecoration art="ivy" className="header-ivy right" />
        <PixelDecoration art="frame" className="header-frame" />
        <PixelDecoration art="lamp" className="header-lamp" />
        <div className="garden-header-top">
          <span className="garden-wordmark">LEAFORY</span>
          <time dateTime={today}>{fullDate(today)}</time>
          <Link to="/backup" aria-label="백업 관리">
            <Archive aria-hidden="true" />
          </Link>
        </div>
        <p className="garden-eyebrow">A LITTLE GREEN, A LITTLE JOY</p>
        <h1>
          <Sprout aria-hidden="true" />
          나의 작은 정원
          <Sprout aria-hidden="true" />
        </h1>
        <p className="garden-greeting">오늘도, 식물이 있는 하루</p>
        <div className="garden-summary" aria-label="나의 정원 요약">
          <a href="#my-plants" aria-label={`함께하는 식물 ${views.length}`}>
            <Sprout aria-hidden="true" />
            함께하는 식물 <strong>{views.length}</strong>
          </a>
          <span aria-hidden="true">·</span>
          <Link to="/records" aria-label={`이번 주 기록 ${weekCount}`}>
            <NotebookText aria-hidden="true" />
            이번 주 기록 <strong>{weekCount}</strong>
          </Link>
        </div>
      </header>
      <section
        id="my-plants"
        aria-labelledby="plants-heading"
        className="garden-collection"
      >
        <div className="garden-collection-heading">
          <h2 id="plants-heading">
            내 식물 <span>{views.length}개의 초록 친구</span>
          </h2>
          <Link to="/plants/new">
            <Plus aria-hidden="true" />
            식물 추가
          </Link>
        </div>
        <Bookshelf views={views} today={today} />
        <p className="garden-caption">
          화분을 눌러 식물의 이야기를 만나 보세요.
          <br />
          물방울 + 버튼으로 물주기를 기록해요. 자세한 관리는 화분을 눌러
          확인해요.
        </p>
      </section>
      <section className="garden-journal" aria-labelledby="records-heading">
        <div>
          <span className="garden-eyebrow">GARDEN NOTES</span>
          <h2 id="records-heading">최근 기록</h2>
          <Link to="/records">
            모두 보기 <ChevronRight aria-hidden="true" />
          </Link>
        </div>
        {records.length ? (
          <ul>
            {records.map((record) => (
              <li key={record.id}>
                <Link to={`/plants/${record.plantId}`}>
                  <img
                    className="pixel-art garden-note-thumbnail"
                    onError={fallbackPixelAsset}
                    src={pixelAsset(
                      plantArt(
                        views.find((view) => view.plant.id === record.plantId)!
                          .plant,
                      ),
                    )}
                    width="40"
                    height="40"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>
                    <time dateTime={record.date}>{fullDate(record.date)}</time>
                    <strong>{record.title}</strong>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="garden-journal-empty">
            아직 기록이 없어요. 식물과 함께할 이야기를 기다려요.
          </p>
        )}
      </section>
      <footer className="garden-footer">
        <Link to="/install">
          <Download aria-hidden="true" />홈 화면 설치·오프라인 안내
        </Link>
        <Link to="/backup">
          <Archive aria-hidden="true" />
          데이터 백업·복원
        </Link>
        <p>당신의 속도로, 초록과 함께.</p>
      </footer>
    </div>
  )
}

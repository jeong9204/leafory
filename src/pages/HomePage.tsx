import {
  ChevronRight,
  NotebookText,
  Sprout,
  Plus,
  Archive,
  Download,
} from 'lucide-react'
import { Link } from 'react-router'
import { useCallback, useEffect, useState } from 'react'
import { PlantCard } from '../components/home/PlantCard'
import { loadHome } from '../app/plant-service'
import { useRepositories } from '../app/repository-context'
import { useRepositoryQuery } from '../hooks/useRepositoryQuery'
import { localDateKey } from '../domain/calendar'
import { DataFeedback } from '../components/plants/DataFeedback'
import { PlantPhoto } from '../components/plants/PlantPhoto'
import { fullDate } from '../lib/dates'

export function HomePage() {
  const [today, setToday] = useState(localDateKey)
  useEffect(() => {
    const refresh = () => setToday(localDateKey())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const { repositories } = useRepositories()
  const query = useCallback(
    () => loadHome(repositories, today),
    [repositories, today],
  )
  const { result, reload } = useRepositoryQuery(query)
  if (result.status === 'loading') return <DataFeedback />
  if (result.status === 'error') return <DataFeedback error retry={reload} />
  const { views, records, weekCount } = result.data

  return (
    <>
      <header className="home-hero">
        <div className="hero-copy">
          <p className="hero-date">{fullDate(today)}</p>
          <h1>나의 작은 정원</h1>
          <p className="hero-greeting">
            오늘도 식물들과 함께하는 하루 <Sprout aria-hidden="true" />
          </p>
        </div>
        <p className="hero-note" aria-hidden="true">
          작은 식물이
          <br />큰 행복을
          <br />
          가져다줘요
          <br />
          <span>···</span>
        </p>
      </header>
      <div className="home-content">
        <section aria-label="나의 정원 요약" className="summary-card surface">
          <a
            href="#my-plants"
            className="summary-item"
            aria-label={`함께하는 식물 ${views.length}`}
          >
            <span className="summary-icon plants">
              <Sprout aria-hidden="true" />
            </span>
            <span>
              <span className="summary-label">함께하는 식물</span>
              <span className="summary-value">
                <strong>{views.length}</strong>
                <ChevronRight aria-hidden="true" />
              </span>
            </span>
          </a>
          <Link
            to="/records"
            className="summary-item"
            aria-label={`이번 주 기록 ${weekCount}`}
          >
            <span className="summary-icon records">
              <NotebookText aria-hidden="true" />
            </span>
            <span>
              <span className="summary-label">이번 주 기록</span>
              <span className="summary-value">
                <strong>{weekCount}</strong>
                <ChevronRight aria-hidden="true" />
              </span>
            </span>
          </Link>
        </section>
        <section
          id="my-plants"
          aria-labelledby="plants-heading"
          className="home-section"
        >
          <div className="section-heading">
            <h2 id="plants-heading">내 식물</h2>
            <Link to="/plants/new" className="add-plant-link">
              <Plus aria-hidden="true" />
              식물 추가
            </Link>
          </div>
          {views.length ? (
            <ul
              id="plant-list"
              aria-label="내 식물 목록"
              className="plant-list"
            >
              {views.map((view) => (
                <PlantCard key={view.plant.id} view={view} today={today} />
              ))}
            </ul>
          ) : (
            <div className="empty-plants surface">
              <Sprout aria-hidden="true" />
              <h3>첫 초록 친구를 만나 보세요</h3>
              <p>
                함께 자랄 식물을 등록하고
                <br />
                나만의 작은 정원을 시작해요.
              </p>
              <Link to="/plants/new" className="primary-button">
                <Plus aria-hidden="true" />첫 식물 등록
              </Link>
            </div>
          )}
        </section>
        <section
          aria-labelledby="records-heading"
          className="home-section recent-section"
        >
          <div className="section-heading">
            <h2 id="records-heading">최근 기록</h2>
            <Link to="/records">
              모두 보기
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
          {!records.length && (
            <p className="empty-records surface">
              아직 기록이 없어요. 식물과 함께할 이야기를 기다려요.
            </p>
          )}
          <ul className="recent-list">
            {records.slice(0, 2).map((record) => (
              <li key={record.id}>
                <Link
                  to={`/plants/${record.plantId}`}
                  className="record-card surface"
                >
                  <PlantPhoto
                    blob={record.image}
                    alt={record.imageAlt ?? '기록 사진'}
                    width="64"
                    height="64"
                    className="record-photo"
                  />
                  <div className="min-w-0">
                    <time dateTime={record.date}>{fullDate(record.date)}</time>
                    <h3>{record.title}</h3>
                    <p>{record.description}</p>
                  </div>
                  <ChevronRight className="record-chevron" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <Link to="/install" className="backup-home-link">
          <Download aria-hidden="true" />홈 화면 설치·오프라인 안내
        </Link>
        <Link to="/backup" className="backup-home-link">
          <Archive aria-hidden="true" />
          데이터 백업·복원
        </Link>
      </div>
    </>
  )
}

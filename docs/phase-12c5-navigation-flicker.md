# Phase 12C-5 — 뒤로 가기 번쩍임 분석 및 최소 보완

## 범위와 판정

- 기준: `test/iphone-pwa`, `83ce7ca7c3ac6815bde82de952d1df01748f0c9e`.
- 작업 시작 시 tracked/staged 변경 없음. 이전 단계의 미추적 QA 캡처는 보존했다.
- iPhone PWA의 순간적인 흰 프레임은 이 환경에서 직접 재현하지 못했다. 아래 수정은 코드와 제어된 테스트로 확인한 로딩 화면 교체 및 복원 타이밍을 줄인다. WebKit 페인팅 문제를 해결했다고 판정하지 않는다.
- DB/Repository/사진 Blob/타이머 데이터/서비스 워커 정책/디자인/CSS/도트 에셋은 변경하지 않았다. 커밋·Push·배포 없음.

## 원인 분리

| 구분        | 확인한 사실                                                                                                                                                                                                                                                  | 판정                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 라우트 교체 | AppLayout은 유지되지만 식물·일기 등 자식 페이지는 경로 이동 시 언마운트/재마운트된다. POP도 이전 React 인스턴스를 자동 보존하지 않는다.                                                                                                                      | 코드 확인                                                                                              |
| 로딩 UI     | `useRepositoryQuery`는 마운트마다 loading으로 시작했다. PlantDetailPage, DiaryDetailPage, RecordsPage, CalendarPage는 이때 본문 전체를 작은 DataFeedback으로 교체한다. 이미 마운트된 상태의 재조회는 기존 success를 유지했지만, 뒤로 가기는 대상이 아니었다. | 전체 본문 → 로딩 문구 → 전체 본문 전환을 설명할 수 있음                                                |
| 스크롤      | 12C-4는 데이터를 기다리고, 타이머의 `data-layout-pending`이 사라진 뒤 2중 rAF에서 좌표를 복원한다. 짧은 로딩 DOM에 복원하는 문제는 방지하지만, 내용이 이미 준비된 복귀에도 중간 페인트 기회가 있었다.                                                        | 제어된 rAF 테스트로 구분. 2 rAF가 항상 정확히 2개의 흰 프레임이라는 뜻은 아님                          |
| 타이머      | LightTimerCard가 별도 조회를 수행한다. loading/ready 사이 높이 차이는 이전 단계에서 약 143px로 측정됐다.                                                                                                                                                     | 대기 표식과 기존 cold 복원 절차 유지                                                                   |
| 사진        | PlantPhoto는 Blob 변경/언마운트 시 URL을 해제하고 새 마운트/새 Blob 객체에서 URL을 생성한다. Repository 재조회는 같은 사진에도 새 Blob 객체를 반환할 수 있다.                                                                                                | URL 재생성은 확인. URL이 새로 생겼다는 사실만으로 실제 디코딩 비용·흰 프레임의 원인까지 확정할 수 없음 |
| 배경        | body는 `#F7F4EB`, 서브페이지는 기존 크림·베이지 토큰. 화면 전체를 흰색으로 바꾸는 전환 CSS는 발견하지 못했다.                                                                                                                                                | 최종 빌드 DOM에서도 body `rgb(247, 244, 235)` 확인. iOS 네이티브 전환 프레임은 별개                    |
| iOS         | standalone 및 스와이프는 WebKit 네이티브 화면 합성과 관련된다.                                                                                                                                                                                               | Chromium 결과로 대체 검증하지 않음                                                                     |

React는 useLayoutEffect를 페인트 전에 실행하지만 useEffect는 페인트 뒤 실행될 수 있다. [React useLayoutEffect](https://react.dev/reference/react/useLayoutEffect), [useEffect](https://react.dev/reference/react/useEffect).

## 적용한 변경

### 읽기 전용 화면의 짧은 조회 결과 재사용

- `QueryCache`를 RepositoryProvider별로 생성한다. DB·sessionStorage·Cache Storage에 저장하지 않는다.
- 명시적으로 opt-in한 식물 상세, 일기 상세, 기록 목록, 캘린더, 타이머 조회만 사용한다. 홈·편집 폼·백업·성장 비교 조회는 변경하지 않는다.
- 식물/일기는 실제 UUID를 포함하는 키로 분리한다. 다른 ID의 데이터를 대신 표시하지 않는다.
- 유효한 이전 결과가 있으면 첫 렌더부터 success를 표시하고, 매번 Repository를 다시 조회한다. 조회를 생략하거나 영구 캐시로 쓰지 않는다.
- TTL 60초, 최대 8개 항목, 캐시에 보관하는 Blob 바이트 합계 최대 16MiB. 동일 Blob 참조는 한 번만 계산한다. 메타데이터/브라우저 디코딩 메모리까지 16MiB라는 뜻은 아니다.
- 만료 항목은 조회/삽입 시 정리한다. 만료 시간에 타이머로 강제 제거하지는 않으며, provider 종료/페이지 재실행 때 전체 메모리가 사라진다.
- 큰 사진 조회가 예산을 넘으면 캐시하지 않고 기존 cold 조회로 동작한다.
- 저장·삭제·전체 복원의 기존 `invalidate()`에서 캐시를 **동기적으로 비운 후** revision을 변경한다. 이미 시작한 오래된 요청은 generation 검사로 새 결과를 덮거나 캐시를 재오염하지 못한다.
- 실패한 재조회는 해당 항목을 제거하고 기존 오류/없는 기록 안내를 표시한다.
- 활성 화면은 기존처럼 재조회 중 이전 결과를 잠깐 유지한다. 다른 탭 등의 변경은 복귀 시 재조회/포커스 재조회로 반영되므로 저장 직후 전역 실시간 동기화를 새로 구현한 것은 아니다.
- 캐시에 임시로 남는 사진은 원래 Blob 참조이며 수정·재인코딩·중복 DB 저장하지 않는다.

### 준비된 상세 화면의 첫 페인트 전 복원

- 유효한 snapshot으로 시작한 상세 POP에 한해, 타이머의 미완료 표식이 없다면 layout effect에서 유효 범위로 clamp한 기존 좌표를 바로 적용한다.
- cold 조회/타이머 준비 중에는 기존 observer 및 2중 rAF 경로를 유지한다.
- 사용자 스크롤 개입, pageshow/pagehide, 수동 scrollRestoration 범위, 유효하지 않은 좌표 보정, 기록 페이지의 독립 복원 정책은 유지한다.
- 전 화면 강제 `scrollTo(0,0)`, 화면 숨김, 강제 리페인트 CSS, 임의 지연은 추가하지 않았다.

### hash URL에서 사진 탭 복귀 예외

검증 중 관리 기록 hash로 진입 → 사진 탭 선택 → 일기 → 복귀 시, 기존 `anchorHash ? timeline : initialTab` 초기화가 저장된 사진 탭을 덮는 것을 확인했다. POP에서 저장된 탭이 있으면 그것을 우선한다. 새 hash 진입은 계속 타임라인을 열고 해당 기록에 포커스/스크롤한다.

## 적용하지 않은 변경

- 전역 Blob URL 풀: ID·크기·MIME만 같다고 동일 사진으로 판단하면 수정된 사진이 오래 남을 수 있다. 기존 URL 해제 정책과 테스트를 유지했다. 따라서 사진 자체의 디코딩/로딩 순간은 남을 수 있다.
- URL을 해제하지 않는 keep-alive: 대용량 사진 메모리를 계속 유지할 위험이 있어 도입하지 않았다.
- decode-before-swap: [HTMLImageElement.decode](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode)로 교체 시점을 조정할 수 있지만, 현재 iPhone 증상의 직접 원인으로 확인하지 못해 공통 사진 컴포넌트를 변경하지 않았다. [URL 해제 문서](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static).
- cold 화면의 추정 높이 skeleton: 신규 진입/새로고침/60초 이후/예산 초과에는 기존 로딩 안내를 유지한다. 가변 갤러리·타임라인의 높이를 임의로 예측해 복원하는 변경은 하지 않았다. cold 로딩 번쩍임까지 제거하는 수정은 아니다.
- 서비스 워커·오프라인·캐시 정책 변경 없음. 메모리 snapshot은 재실행 복구용 DB나 PWA 캐시가 아니다.

## 수정 파일

| 파일                                                                                          | 내용                                      |
| --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `src/app/query-cache.ts`                                                                      | bounded provider snapshot                 |
| `src/app/RepositoryProvider.tsx`, `repository-context.ts`                                     | provider 격리와 invalidate                |
| `src/hooks/useRepositoryQuery.ts`                                                             | opt-in 초기 snapshot + 항상 재조회        |
| `src/hooks/usePlantDetailScroll.ts`                                                           | warm POP pre-paint 복원                   |
| `src/pages/PlantDetailPage.tsx`, `DiaryDetailPage.tsx`, `RecordsPage.tsx`, `CalendarPage.tsx` | 읽기 query 키 연결                        |
| `src/components/timer/LightTimerCard.tsx`                                                     | 타이머 조회 snapshot; 데이터 로직 유지    |
| `src/components/plant-detail/PlantRecordTabs.tsx`                                             | 저장된 POP 사진 탭 우선                   |
| `src/app/query-cache.test.ts`, `src/hooks/useRepositoryQuery.test.tsx`                        | 캐시/갱신/경합 테스트                     |
| `src/hooks/usePlantDetailScroll.test.tsx`, `src/pages/PlantDetailPage.test.tsx`               | 기존 복원 유지 + warm/hash 예외           |
| `src/pages/DetailQueryFreshness.test.tsx`                                                     | 실제 일기 편집·삭제 후 warmed 상세 최신화 |
| 이 문서, `docs/screenshots/phase-12c5/`                                                       | 검토 자료                                 |

## 검증

### 제어된 테스트에서 수정 전후

| 조건                                     | 기존 코드             | 수정 후                                                             |
| ---------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| 같은 화면 재마운트, Repository 응답 대기 | 최초 loading          | 유효 snapshot 있으면 즉시 이전 success; 재조회 성공 시 최신 success |
| 캐시 없는 초기 진입                      | loading → success     | 동일                                                                |
| 준비된 POP 스크롤                        | 두 번 rAF 이후 적용   | layout effect에서 적용, 예약 rAF 0개                                |
| 타이머 미준비                            | 준비될 때까지 대기    | 동일                                                                |
| 저장/삭제/전체 복원                      | revision 재조회       | 캐시 동기 무효화 + revision 재조회                                  |
| 이전 요청이 뒤늦게 완료                  | 언마운트 current 검사 | current + generation 검사                                           |

이 비교는 React 상태 및 rAF 제어 테스트이며, 실제 iPhone 동영상의 프레임별 계측값은 아니다.

### 실제 브라우저 QA

`localhost:4297` 새 테스트 origin의 빈 저장소를 UI에서 확인한 후, 이전부터 사용한 합성 ZIP(식물 2, 일기 2, 사진 2, 관리 34)을 복원했다. 개인 기록/사진을 쓰지 않았다. 사용자 PWA/Preview 저장소는 접근하지 않았다.

- 390px 상세 중간 → 일기 → 화면 화살표: **2243 → 2243px**.
- 390px 사진 탭 → 일기 → 브라우저 뒤로: hash 없는 경로 **669 → 669px**, 사진 탭/이미지 표시 유지.
- 320px 기록 더 보기(36개) → 일기 → 화면 화살표: **2054 → 2054px**, 36개 표시 유지.
- 사진 일기 + 특정 식물 복합 필터 → 일기 → 브라우저 뒤로: `?type=diary&plant=...` 복원, 가로 넘침 없음.
- 캘린더 11월 1일 → 일기 → 화살표: `/calendar?date=2026-11-01` 복귀.
- 사진 없는 일기: 이미지 0개, 320px 가로 넘침 없음.
- 320px 상세 새로고침: 이미지 로딩 완료, `scrollWidth === innerWidth === 320`.
- 최종 production 빌드에서 기록 → 관리 앵커: 해당 항목 포커스, viewport 안 위치 확인(상단 약 455px). 이어 일기 왕복 **2243 → 2243px**. 새 QA 탭 console error 없음.
- 개발 중 hook state 형태 수정에 따른 Fast Refresh의 옛 state 충돌이 한 차례 있었다. 새로 로드한 production 빌드에서는 재현하지 않았다. 최종 QA와 HMR 로그를 구분했다.

스크린샷은 안정된 복귀 화면·레이아웃 확인 자료다. 짧은 흰 프레임의 발생/미발생을 정지 캡처로 증명하지 않는다.

### 전체 품질 검사

Node **24.22.2**, npm **11.19.1**에서 `npm run check`와 `git diff --check`를 실행했다. 최종 수치는 아래 확정 결과에 기록했다.

- TypeScript / ESLint / Prettier / 전체 Vitest / Production build / PWA build 검사.
- 기존 486개 테스트를 삭제하지 않고 유지. 새 테스트: TTL/격리/Blob 예산/무효화 세대, warm 재진입, 재조회 성공·오류, 미선택 query 제외, ID 변경, 오래된 요청 경합, 실제 일기 수정·삭제, pre-paint/미준비 타이머, hash/탭 우선순위.
- 기존 서비스 워커 VM의 오프라인·업데이트·데이터 캐시 제외 테스트 포함. 실기기 비행기 모드 테스트를 수행했다는 뜻은 아니다.
- CSS 산출물은 기준과 같은 `index-DE24x0vB.css`. 디자인·PWA 정책 파일 변경 없음.

## iPhone에서 남은 확인

1. 같은 식물에서 60초 이내 일기 왕복: 화살표와 스와이프 각각 영상 촬영.
2. 상단/중간/하단, 사진 탭, hash 진입 뒤 사진 탭에서도 좌표·탭 유지 확인.
3. 60초 이상 경과, 앱 재실행, 직접 URL, 큰 사진 여러 장(캐시 예산 초과 가능)도 분리해 확인.
4. 사진 없는 일기와 여러 장 일기, 느린 사진 디코딩에서 빈 프레임이 사진에만 생기는지 전체 화면인지 구분.
5. Safari 일반 탭과 홈 화면 standalone을 같은 데이터로 비교. iOS 스와이프 스냅샷·합성·Safe Area는 데스크톱에서 미검증.
6. 작성/수정 후 최신 데이터, 기록 필터·더 보기·스크롤, 타이머 진행 상태, 비행기 모드 재실행 확인. 앱/사이트 데이터를 지우지 않는다.

iPhone의 진짜 화면 녹화와 scrollY/DOM 높이/이미지 decode 완료를 동기화한 프레임 분석은 수행하지 못했다. 앱 계층의 교체를 줄였으며, 모든 번쩍임이 해결됐다는 결론은 내리지 않는다.

## 최종 확정 결과

- 전체 검사: **48개 테스트 파일 / 502개 테스트 통과**(기존 486 + 신규 16), 타입·린트·포맷·프로덕션 빌드·PWA 검사 통과.
- `git diff --check` 통과. baseline HEAD/브랜치 유지, staged 변경 없음.
- precache **72개 / 3,185,597B**, 기준 3,184,363B 대비 **+1,234B**. 읽기 캐시/복원 코드에 따른 JS 차이이며 CSS와 캐시 정책은 동일하다.
- refined **21종**, painted WebP **0종** precache. 기존 원본은 유지.
- 최종 hash + 사진 탭 복귀: **320px 592 → 592px**, **390px 669 → 669px**, 모두 사진 탭 유지. 이미지 로딩 완료, 390px 가로 넘침 없음.
- 최신 production 진입 JS `/assets/index-CzTqDkoP.js`와 실제 DOM script 일치를 확인했다. 중간 빌드가 남아 있는 상태를 최신 QA로 오인하지 않도록, 격리 origin에서 정상 UI의 ‘업데이트 적용’을 사용했다. 데이터 초기화/서비스 워커 해제는 하지 않았다.
- 업데이트 후 QA 데이터 **식물 2 / 일기 2 / 사진 2 / 관리 34** 보존 확인.
- 이후 로컬 QA 서버를 중지하고 새로고침해 백업 화면과 기록 36개가 표시되는 것을 확인했다. 이는 서버 접속 불가 조건의 서비스 워커 앱 셸/IndexedDB 조회 검증이다. 기기 전체 비행기 모드 또는 iPhone 실기기 테스트가 아니다.
- 최종 검증 탭 console error 0. 앞서 기록한 개발 HMR의 임시 오류와 분리했다.

### 캡처 안내

- `screenshots/phase-12c5/verified-photos-320.jpg`: 최신 hash+사진 탭 복귀.
- `screenshots/phase-12c5/verified-photos-390.jpg`: 최신 hash+사진 탭 복귀.
- `screenshots/phase-12c5/after-records-320.jpg`: 필터 복귀 화면.
- `screenshots/phase-12c5/after-no-photo-diary-320.jpg`: 사진 없는 일기.
- `screenshots/phase-12c5/server-unavailable-records-390.jpg`: 서버 중지 후 기록 화면.
- 그 외 `after-*`, `final-*`는 중간 조사 캡처이며 일부는 hash 사진 탭 보완 전이다. 최종 승인용 사진 탭은 `verified-*`를 기준으로 본다.

main 및 origin/main은 `d7165a69085a5a8c01e078f04589cb6d1d49106f`로 유지했다. 원격 쓰기·Production 접근·Vercel 배포를 하지 않았다.

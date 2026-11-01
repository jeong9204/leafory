# Phase 12C-3 — 뒤로 가기 및 내비게이션 점검

## 기준과 원인

- 브랜치 `test/iphone-pwa`, 시작/완료 HEAD `cd062fdebbcfcbb41d8d5dd313fe01d5d829b515`.
- 시작 시 tracked 변경과 staged 변경 없음. 기존 미추적 Phase 12B/12C 검토 캡처는 보존했다.
- `DiaryDetailPage`의 상단 화살표는 `Link to=/plants/:id`였다. 기록에서 일기로 진입하는 PUSH는 정상이지만 화살표가 식물 상세를 추가 PUSH했다. 네이티브 뒤로 가기(POP)와 화면 버튼의 목적지가 달랐다.
- `AppLayout`은 이 화면의 헤더를 만들지 않는다. 화면별 헤더와 폼의 고정 경로가 원인이며 라우터 전체 재작성은 필요하지 않았다.
- 기록의 관리 이벤트는 식물 상세 hash로, 캘린더 관리 이벤트는 기존 관리 수정 화면으로 이동한다. 별도 관리 상세 라우트는 없다.

## 공통 복귀 방식

`NavigationLink`는 기존 href와 PUSH 동작을 유지하며 출발 pathname/search/hash, location key, 같은 탭 세션 식별자, React Router의 native history idx를 navigation state로 전달한다. 하단 NavLink도 같은 메타데이터를 전달한다.

`BackLink`/`useBackNavigation`은 다음 조건을 확인한다.

1. 실제 앱의 허용된 내부 경로만 허용. 외부 URL, protocol-relative 경로, 역슬래시·제어 문자, 정규화가 달라지는 경로, 알 수 없는 라우트는 거부한다.
2. 같은 세션, 다른 location key/URL인지 확인한다.
3. BrowserRouter에서는 출발 idx 바로 다음 entry인지 확인한다. idx 0의 직접 접속·새 탭에서 복사된 state로 외부 history를 POP하지 않는다.
4. 조건을 만족하면 `navigate(-1)`. 조건이 없거나 잘못됐으면 안전한 기본 경로를 `replace`한다. 단순 `history.length`나 referrer 추측은 사용하지 않는다.
5. 수정 키·새 탭 열기는 정상 내부 href를 사용한다. 일반 클릭만 POP로 처리한다. 브라우저 자체 POP는 가로채지 않는다.

세션 식별자는 sessionStorage에 저장한다. 저장이 제한된 환경은 메모리로 동작하고 새 실행에서는 안전한 fallback을 사용한다. 새로고침 후 state와 탭 세션이 유지되면 원래 진입 경로로 돌아간다. 앱 재실행으로 history/state가 사라지면 기본 내부 경로로 이동한다.

React Router native idx 사용은 최소한의 브라우저 history 연속성 확인이다. 향후 Router 업그레이드 때 실제 BrowserRouter QA를 반복해야 한다. MemoryRouter 테스트는 native idx 없이 동일 세션 Link 출처를 사용한다.

## 화면별 복귀·저장 정책

| 화면/진입                  | 상단 뒤로 가기·취소                     | 저장                                                 |
| -------------------------- | --------------------------------------- | ---------------------------------------------------- |
| 기록 → 일기 상세           | 기존 기록 entry로 POP, query 유지       | 해당 없음                                            |
| 캘린더 → 일기 상세         | 원래 선택 날짜·식물의 캘린더로 POP      | 해당 없음                                            |
| 식물 → 일기 상세           | 원래 식물 상세로 POP                    | 해당 없음                                            |
| 기록 → 관리 hash           | 원래 기록으로 POP                       | 해당 없음                                            |
| 홈 최근 기록/화분 → 식물   | 기존 홈 entry로 POP                     | 해당 없음                                            |
| 일기 상세/식물 → 일기 수정 | 실제 호출 화면으로 POP                  | 저장 후 같은 호출 화면으로 POP, 기존 entry 중복 방지 |
| 관리 hash → 관리 수정      | hash가 포함된 기존 식물 entry로 POP     | 동일, 이후 기록으로 다시 돌아갈 수 있음              |
| 캘린더 → 관리 수정         | 원래 캘린더로 POP                       | 같은 캘린더로 POP 및 invalidate 재조회               |
| 식물 → 식물 수정           | 원래 식물 entry로 POP                   | 동일                                                 |
| 신규 식물/일기 작성        | 호출 화면으로 POP                       | 새 상세로 폼을 replace하고 기존 호출 출처 유지       |
| 신규 관리 기록             | 호출 화면으로 POP                       | 호출 화면으로 POP 및 재조회                          |
| 성장 비교                  | 실제 호출 화면 우선, fallback 식물 상세 | 해당 없음                                            |
| 백업·설치·기록 상단 화살표 | 실제 호출 화면 우선, fallback 홈        | 기존 백업 기능 유지                                  |

직접 접속 fallback: 일기 상세→식물, 일기 수정→해당 일기 상세, 신규 일기/관리→식물, 관리 수정→식물의 해당 관리 hash, 식물 수정→식물, 식물 등록/식물 상세/백업/설치/기록→홈.

기존 일기 삭제 완료→식물 replace, 식물 삭제 완료→홈 정책은 유지했다. 삭제는 취소/뒤로 가기가 아니며 삭제된 리소스로 다시 돌아가지 않는다. 데이터 저장·삭제 서비스는 변경하지 않았다. AppLayout의 기타 페이지 `← Leafory`는 명시적인 홈 링크로 유지했다.

폼의 기존 unsaved blocker/beforeunload는 POP에도 적용된다. 저장 성공 때만 allowNavigation 후 복귀하며 저장 실패는 기존 입력 유지 정책을 따른다.

## 기록 페이지 상태 복원

- URL query가 유형·식물 필터의 기준이며 필터 변경은 기존 replace 정책 유지. 필터 교체 시 호출 출처 state는 보존한다.
- 기존 history key별 메모리 Map 유지. 동일 탭 새로고침 복귀를 위해 표시 개수·필터 식별·scrollY만 sessionStorage에 추가 저장한다. 최대 40개 entry이며 레코드 본문/사진/Blob은 넣지 않는다. 저장소 실패 시 메모리 방식으로 계속 동작한다.
- 브라우저 QA에서 추가 발견: 페이지 unmount 후 짧아진 DOM의 scrollY=0을 cleanup에서 저장하면 원래 위치를 잃었다. 행 클릭 직전에 위치를 저장하고 이탈 중 덮어쓰기를 막았다. 일반 cleanup도 마지막으로 관측한 위치를 사용한다.
- 비동기 데이터 로딩과 30개 이상 목록 렌더가 완료된 뒤 requestAnimationFrame에서 위치를 복원한다. 데이터 삭제로 페이지가 짧아진 경우 브라우저가 가능한 범위로 제한한다.

## 변경 파일

- 신규 공통: `src/lib/navigation.ts`, `src/hooks/useBackNavigation.ts`, `src/components/navigation/NavigationLink.tsx`, `src/lib/record-position.ts`.
- 신규 테스트: `src/lib/navigation.test.ts`, `src/pages/Navigation.test.tsx`.
- 수정: `src/components/BottomNavigation.tsx`, `src/components/bookshelf/Bookshelf.tsx`, `src/components/plant-detail/PlantRecordTabs.tsx`, `src/components/plant-detail/PlantTimeline.tsx`, `src/components/plants/PlantForm.tsx`.
- 수정 화면: `HomePage`, `RecordsPage`, `CalendarPage`, `PlantDetailPage`, `PlantEditorPage`, `DiaryDetailPage`, `DiaryEditorPage`, `CareEditorPage`, `GrowthComparisonPage`, `BackupPage`, `InstallPage`.
- 기존 `CalendarPage.test.tsx` 1개 시나리오는 저장 후 고정 식물 상세를 거치는 기대값을 실제 호출 캘린더 복귀로 변경했다. 테스트 삭제 없음.
- CSS·도트 에셋·DB·Repository·서비스 워커 정책 변경 없음. 홈은 링크의 출처 정보 전달만 변경했다.

## 자동 검사

Node 24.22.2 / npm 11.19.1, `npm run check` 통과:

- TypeScript, ESLint, Prettier 통과.
- Vitest **44 파일, 473개 통과**: 기존 438개 시나리오 유지 + 35개 추가.
- Production build 및 PWA 검증 통과.
- precache **72개, 3,180,509B** (기준 3,176,444B 대비 코드 변경으로 4,065B 증가), refined WebP **21개**, painted WebP **0개**. 코드 변경으로 JS 해시/용량만 달라지며 precache 정책은 유지한다.
- `git diff --check` 통과.

추가 검증: 일기 화면 버튼/Router POP, 캘린더·식물 진입, 직접 접속 replace, 일기 저장/취소/미저장 이탈, 4종 관리 hash와 수정 취소, 관리 수정 저장, 홈 복귀, 32개 목록/복합 필터/스크롤, 외부·잘못된 state·세션 불일치·idx 0·자기 경로 방어, UI 위치 저장 범위.

기존 삭제 hash 안내·앵커 포커스·reduced-motion·일기/사진/타이머/백업 회귀 테스트도 유지했다.

## 실제 브라우저 QA

새 localhost origin `127.0.0.1:4293`의 빈 DB(식물/일기/사진/관리 모두 0)를 확인한 후 합성 QA ZIP만 복원했다. 식물 2, 일기 2, 관리 34, 사진 0. 실제 사용자 origin/IndexedDB·사진은 열거나 초기화하지 않았다.

실제 React Router BrowserRouter에서 확인:

- 기록의 `사진 일기 + 식물` query → 일기 → 화면 화살표와 브라우저 `back()`을 각각 실행: 동일 query/선택 필터 복원.
- 30개 더 보기 후 36개 → 일기 상세 새로고침 → 화면 화살표: **36개 및 scrollY 2054px → 2054px** 복원.
- 캘린더 11월 1일 → 일기 → 캘린더: 날짜 query 유지. 캘린더 → 비료 수정 → 취소도 같은 날짜로 복귀.
- 기록 물주기 → 관리 hash의 정확한 article에 포커스 → 수정 취소 → 식물 hash → 기록 query 복귀.
- 기록 → 일기 → 수정 취소 → 원래 일기 → 원래 기록의 2단계 복귀.
- 새 탭 직접 일기 URL → 화살표: 외부 페이지 대신 식물 상세.
- 320px·390px 기록/일기 캡처, 두 폭 모두 가로 overflow 없음. 디자인/CSS 변경 없음.

빠른 연속 자동 클릭은 pending 화면의 이전 DOM을 누를 수 있어, 각 화면의 제목/로딩 완료를 기다린 뒤 복귀 동작을 분리해 판정했다.

캡처: `docs/screenshots/phase-12c3/diary-back-320.jpg`, `diary-back-390.jpg`, `records-return-320.jpg`, `records-return-390.jpg`. 모두 합성 QA 자료이며 개인 사진 없음.

## 미검증 및 iPhone 재확인

- 실제 iPhone PWA 스와이프 제스처·프로세스 종료 후 재실행·OS의 session/history 복원은 데스크톱에서 검증하지 못했다. 일반 브라우저 POP와는 별도다.
- 외부 사이트에서 들어오는 실제 iOS 동작은 실기기 미검증. 직접 새 탭 fallback과 부적절한 출처 state 방어는 검증했다.
- 설치된 구버전 PWA의 업데이트/비행기 모드 재실행은 이번에 배포하지 않았으므로 미검증. 기존 정책과 빌드 검사는 유지된다.
- iPhone: ZIP 백업 후 기록 복합 필터/더 보기/스크롤에서 일기 진입, 화면 화살표·스와이프 각각, 상세 새로고침, 일기 수정 저장/취소/이탈 확인, 관리 수정 후 hash 포커스, 날짜별 캘린더 복귀를 확인한다. 앱 삭제/사이트 데이터 초기화 불필요.

## Git 및 데이터 보호

커밋·Push·배포 없음. HEAD/원격 추적 브랜치 baseline 유지, main/Production 변경 없음. 기존 미추적 검토 자료 보존. 실제 사용자 DB/사진/타이머 상태, DB 스키마, 백업 형식, PWA 업데이트 정책을 변경하지 않았다.

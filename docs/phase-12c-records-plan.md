# Phase 12C-1 — 전체 기록 페이지 분석 및 구현 설계

## 0. 작업 범위와 기준

- 분석 기준: `test/iphone-pwa`, HEAD `841bc3a442385d9dc512709ffa14c171b2e73006`.
- 시작 시 소스·staging 변경 없음. 기존 미추적 `docs/screenshots/phase-12b/`는 그대로 보존한다.
- **이번 산출물은 설계 문서와 정적 시안뿐이다.** 라우트·React·CSS·Repository·DB·기록·테스트·PWA는 수정하지 않는다. 커밋·Push·배포도 하지 않는다.
- 아래의 타입·파일 이름·query parameter·앵커는 **Phase 12C-2 구현 제안**이며 현재 존재하는 API로 오해하지 않아야 한다.
- 사용자 IndexedDB는 열지 않았다. 실제 사용자 기록·개인 사진을 예시로 추출하지 않았다.

## 1. 현재 `/records`

[src/app/routes.tsx](../src/app/routes.tsx)의 `records`는 `SetupPage(title="기록 목록")`를 렌더링한다. 실제 기록 조회·필터·그룹·상세 이동은 없다. `SetupPage`는 초기 설정 안내 문구를 표시하며 다른 미지원 경로(`*`)도 사용한다. **이 공통 placeholder를 고쳐 전체 기록을 구현하면 안 된다.** 다음 단계에서 `/records`만 별도 `RecordsPage`로 교체하는 방식이 적절하다.

`AppLayout`은 `/records`를 자체 헤더가 없는 화면으로 판단해 `← Leafory / 식물 등록` 헤더와 main padding을 붙인다. 새 페이지에 전용 헤더를 만들 때는 `hasOwnHeader`에 `/records`를 추가해 헤더·padding 중복을 막는다. `subpage-shell`, PWA 상태 안내, `홈 | 기록 | 캘린더`, 활성 메뉴, safe-area 여백은 기존 구조를 재사용한다.

홈 '최근 기록 → 모두 보기', 홈 '이번 주 기록', 하단 기록 메뉴는 이미 `/records`를 가리킨다. 현재 '이번 주 기록'도 필터 query 없이 전체 기록으로 이동하며, 이번 설계에서 주간 필터를 새로 가정하지 않는다.

## 2. 홈 최근 기록의 실제 데이터 흐름

현재 실행 경로는 **`HomePage → useRepositoryQuery → loadBookshelf`** 이다. `plant-service.ts`에 남아 있는 `loadHome()`은 현재 홈이 호출하는 함수가 아니다.

1. [HomePage](../src/pages/HomePage.tsx)는 `useRepositories()`의 Repository를 받는다.
2. [loadBookshelf](../src/app/bookshelf-service.ts)는 `plants.list()`로 식물을 조회한다.
3. 각 식물의 `careEvents.listByPlant(id)` / `diaries.listByPlant(id)`를 병렬 조회한다.
4. 관리 이벤트의 `occurredAt`을 `localDateKey(new Date(...))`로 변환하고, 일기는 `entryDate`를 사용한다.
5. 원본 ID·plantId·date·title·관리 이벤트 occurredAt만 얇게 투영해 합친다. 현재 투영에는 `recordType`이 없다.
6. 날짜 내림차순 → occurredAt 문자열 내림차순(시각 없는 일기는 빈 문자열) → ID 오름차순으로 정렬하고 **2개**를 노출한다. 같은 날은 시각 있는 관리 이벤트가 일기보다 앞선다.
7. 이번 주 수는 전체 관리 이벤트와 일기의 기록 날짜로 계산한다. 원본을 중복 저장하지 않는다.
8. `HomePage` 안의 JSX가 최근 기록 목록을 직접 그린다. 별도 최근 기록 컴포넌트는 없다.

홈은 **사진 Repository와 Blob을 읽지 않는다.** 전체 기록도 이 장점을 유지해야 한다. `loadHome()`/`loadPlant()`를 전체 목록용으로 호출하면 대표 사진·전체 일기 사진까지 읽게 되므로 권장하지 않는다.

### 도트 썸네일

- `plantArt({ name, species }) → pixelAsset(art)` 조합으로 `/pixel/refined/*.webp`를 얻는다.
- 학명이 있으면 이름보다 우선하며, 괴마옥(`Euphorbia bupleurifolia`)과 일반 선인장을 구분한다. 미지원 식물은 `default`.
- `fallbackPixelAsset`은 로딩 실패 시 기본 화분을 사용하며 무한 fallback 요청을 막는다.
- 홈은 40×40px, pixel rendering, lazy loading, async decoding을 사용한다. 식물 이름을 옆에서 제공하는 목록의 장식 썸네일은 `alt=""` / `aria-hidden`으로 중복 읽기를 막는다.
- 현재 홈은 행마다 `views.find(...)`를 하지만 2개뿐이다. 전체 기록은 `Map<plantId, plant>`를 한 번 만들어 O(1) 조회한다.
- 현재 홈의 최근 기록은 **일기까지 모두 식물 상세로 이동**한다. 전체 기록에서는 일기 상세로 직접 연결하는 개선을 제안하며, 홈 링크 변경 여부는 별도 범위로 명시해야 한다.

## 3. 원본 모델·ID·Repository

근거: [models.ts](../src/domain/models.ts), [repositories.ts](../src/domain/repositories.ts), [local/repositories.ts](../src/data/local/repositories.ts).

| 원본           | 필드와 의미                                                                                    | 기존 조회                                         |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Plant          | UUID id, name, species?, status, memo?, coverPhotoId?, createdAt/updatedAt                     | `plants.list()`, `plants.getById(id)`             |
| CareEvent      | UUID id, plantId, eventType, occurredAt(UTC ISO), durationMinutes?, memo?, createdAt/updatedAt | `careEvents.listByPlant(id)`, CRUD                |
| DiaryEntry     | UUID id, plantId, entryDate(YYYY-MM-DD), condition, title?, content?, createdAt/updatedAt      | `diaries.listByPlant(id)`, CRUD                   |
| DiaryPhoto     | UUID id, plantId, entryId?, Blob, MIME, capturedAt, createdAt, sortOrder                       | 전체 목록에서는 불필요. 기존 상세 화면에서만 조회 |
| GrowLightTimer | 단일 세션 상태·누적 시간                                                                       | 완료 전에는 목록 대상 아님                        |

`plantId`는 기존 Plant를 참조한다. UUID는 테이블별 PK이므로 일기와 관리 이벤트에서 같은 ID가 존재할 수 있다. 표시 키는 **`diary:<id>` / `care_event:<id>`**로 하고 원본 ID를 바꾸지 않는다. ID만으로 중복 제거하지 않는다.

현재 지원 유형은 정확히 `watering | grow_light | repotting | fertilizing`과 `DiaryEntry`다. 병충해·알림·식물 등록·타이머 시작·개별 사진을 새로운 기록 유형으로 만들지 않는다. 사진 없는 일기도 허용하므로 '사진 일기' 필터는 **사진 개수와 무관하게 모든 DiaryEntry**를 뜻한다. 사진 장수·대표 사진·타이머 세션은 기록 수에 더하지 않는다.

### 타이머 완료 기록

[local/light-timer.ts](../src/data/local/light-timer.ts)의 `finish`는 기존 CareEvent에 저장한다.

- `id = sessionId`, `eventType = grow_light`, `plantId` 유지.
- `occurredAt = 마지막 측정 종료/일시정지 시각`, **시작 시각이 아님**.
- `durationMinutes = floor(accumulatedMs / 60000)`; 일시정지 시간은 제외된다.
- `memo`에 '식물등 타이머 자동 기록 / 실제 누적 HH:MM:SS / 시작 ISO / 측정 종료 ISO'가 담긴다.
- 이벤트 생성과 세션 삭제는 트랜잭션으로 처리하고 동일 세션 종료 재시도는 같은 기록을 반환한다. 목록에서 또 복제하지 않는다.
- 시작·실행·일시정지 상태는 미완료이므로 목록에 넣지 않는다. 1분 미만 기록 없이 종료도 CareEvent가 없으므로 나타나지 않는다.
- 자정을 넘겨도 **종료일의 이벤트 한 개**로 그룹화한다. 날짜별로 시간을 분할하거나 새 이벤트를 만들지 않는다.

표시는 [parseTimerRecord / formatTimerRange / formatTimerUsage](../src/lib/timer-record-display.ts)를 재사용한다. 식물등 이벤트에서만 파싱하고, 성공 시 '타이머 기록' 배지와 짧은 사용 시간 요약을 표시한다. 원본 ISO 메타데이터를 카드에 그대로 노출하지 않는다. 사용자 메모는 파싱 결과의 `userMemo`를 요약하며 원문은 기존 상세에서 확인한다. 파싱 실패한 과거 메모는 수동 기록과 동일한 일반 텍스트로 안전하게 보존한다. 메모를 DB에서 일괄 수정하지 않는다.

## 4. 제안: 공통 표시 모델과 조회

새 DB 모델/테이블이 아니라 **app 계층의 파생 DTO**만 만든다. 다음은 설계 예시이며 실행 코드를 추가하지 않았다.

```ts
type RecordKind = CareEvent['eventType'] | 'diary'

type RecordListEntry = {
  key: string // `${recordType}:${sourceId}`
  sourceId: UUID // 원본 id, 변경하지 않음
  recordType: 'care_event' | 'diary'
  kind: RecordKind
  plantId: UUID
  date: LocalDate // 그룹 날짜
  createdAt: IsoDateTime // 안정적인 보조 정렬에만 사용
  occurredAt?: IsoDateTime // CareEvent에만 있음
  title: string
  summary?: string
  href: string // 실제 존재하는 라우트로 연결
  isTimerRecord?: boolean // 표시 전용, 별도 DB 저장 없음
}
```

실제 구현에서는 discriminated union으로 care 이벤트에는 eventType/occurredAt이 필수, 일기에는 entryDate가 필수가 되도록 좁힐 수 있다. Plant 메타데이터는 반환값 `plants`/Map으로 조인하고, 각 행에 원본 Plant나 Blob 전체를 중복 보관하지 않는다. `isTimerRecord`도 파싱 결과에서 계산하며 수동 데이터에 추정 값을 기록하지 않는다. 새 DTO를 domain의 기존 `TimelineRecord`나 CareEvent 저장 구조에 덮어쓰지 않는다.

### 조회 경로 추천

`loadRecordIndex(repos)`(제안): `plants.list()` 후 각 식물의 care/diary `listByPlant()`를 읽고, 타입을 보존해 위 모델로 변환한다. **`photos.*`, `backup.snapshot()`, `loadPlant()`는 호출하지 않는다.**

- 현재 재사용 후보 중 [loadCalendar](../src/app/calendar-service.ts)가 가장 가깝다. 이미 plantId/name·원본 id·유형·로컬 날짜·href를 가진 통합 메타데이터를 만든다.
- 다만 바로 그대로 호출하면 관리 기록 링크가 편집 화면이고, 타입별 key·학명 매핑용 Plant 조인·정렬 정책·메모 요약을 보완해야 한다. 캘린더의 URL 동작을 바꾸지 않도록 작은 공통 변환/정렬 helper를 추출하는 편을 권장한다.
- `queries.recentTimeline(plantId, limit)`은 타입을 보존하지만 식물별 제한 결과이며, 현재 구현은 전체를 읽고 정렬 후 slice한다. 전체 목록의 진짜 DB pagination이 아니다. `limit=20` 등을 전체 기록에 재사용하면 오래된 기록을 빠뜨린다.
- `loadBookshelf()`는 shelf 통계·2개 slice까지 묶여 있어 그대로 재사용할 전체 목록 API가 아니다. 처음에는 순수한 제목/정렬/thumbnail helper만 재사용하고 홈의 조회 구조는 유지하는 것이 안전하다.

### 정합성과 조회 비용

초기 MVP는 기존 `repos.runInTransaction()` 안에서 메타데이터를 일관된 snapshot으로 읽는 방안을 권장한다. 단, **현재 이 API는 `rw`이고 사진·타이머 테이블을 포함한 모든 테이블을 잠근다.** 읽기만 하는 콜백이어도 read-only 트랜잭션이라고 부르면 안 된다. Blob을 읽지 않는 것과 테이블 lock 범위는 다르다. 트랜잭션 안에 이미지 decode·외부 요청·React 렌더링을 넣지 않는다.

실제 측정에서 저장/타이머 동작과 경합한다면, 후속 최적화로 Repository에 **metadata 전용 read API**를 추가하는 방안을 검토한다. 이 단계에서 API·schema를 추가하지 않는다. 단순 병렬 개별 조회로 시작하는 경우 식물 삭제 중 `NOT_FOUND`가 날 수 있으므로, 실패를 빈 목록으로 바꾸지 말고 재조회/오류 상태로 처리해야 한다.

## 5. 필터·그룹·안정적 정렬

### 필터

- 유형: `전체`, `물주기`, `식물등`, `사진 일기`, `기타 관리`.
- `기타 관리 = repotting + fertilizing`뿐이다. 행에서는 각각 '분갈이', '비료'라고 명시한다.
- 식물: `전체 식물` + 현재 저장된 식물. 같은 이름도 plantId로 구분한다.
- 두 필터는 AND. `전체`는 유형 조건만 해제하고 식물 선택은 유지한다. 별도 '필터 초기화'는 둘 다 초기화한다.
- 실제 지원하는 유형은 기록 0개여도 선택할 수 있고 결과 0개를 보여 준다. 미지원 유형은 추가하지 않는다.
- 제안 URL: `/records?type=watering&plant=<uuid>`. '전체'는 해당 parameter 없음. 알려지지 않은 type/삭제된 plant는 전체로 정상화하고 안내한다. malformed ID를 DB 조회에 그대로 넣지 않는다.
- 필터 변경은 `replace`로 history 과다 생성을 막고, 날짜 그룹·노출 개수·더 보기 위치를 초기화한다. 상세에서 돌아올 때 query와 노출 개수/스크롤을 복구하는 UX를 검증한다.

### 날짜·시간의 의미

- CareEvent 그룹 날짜 = 기기 로컬 `localDateKey(new Date(occurredAt))`, 시각도 기기 로컬로 표시한다.
- Diary 그룹 날짜 = `entryDate` 그대로. **createdAt/capturedAt을 실제 관찰 시각으로 표시하지 않는다.** 목록에는 날짜만 표시하고 HH:mm는 생략한다.
- `fullDate()`는 달력 날짜를 한국어로 표시하는 데 재사용한다. 해외 시간대에서 날짜가 하루 바뀌지 않도록 기존 UTC-noon 방식의 날짜-only formatter를 유지한다.
- `lib/dates.ts`의 `todayKey()`는 예전 한국 시간 고정 helper다. 새 화면의 '오늘' 판정에는 쓰지 않고 `domain/calendar.ts`의 `localDateKey()`를 사용한다.
- '오늘/어제'만 쓰지 않고 연도를 포함한 날짜를 함께 표시한다. 기기 복귀/자정 시 상대 날짜 라벨을 갱신한다.

### 제안 정렬 규칙 (완전한 tie-breaker)

원본 배열의 순서, Promise 완료 순서, React render 순서에 의존하지 않는다.

1. `date` 내림차순.
2. 같은 날짜면 **실제 시각 있는 관리 이벤트 먼저**, 시각 없는 일기는 뒤. 이는 현재 홈의 정책을 유지하는 방향이다.
3. 관리 이벤트끼리는 `Date.parse(occurredAt)` 내림차순. 같은 실제 시각이면 `createdAt` 내림차순.
4. 일기끼리는 `createdAt` 내림차순. 이것은 같은 날짜 일기 사이의 보조 정렬이며 화면의 기록 날짜/시각을 바꾸지 않는다.
5. 동일하면 `recordType` 고정 순서(care_event → diary), `kind` 고정 순서(watering → grow_light → repotting → fertilizing → diary).
6. 여전히 같으면 원본 ID를 코드포인트 오름차순 비교, 마지막으로 plantId 오름차순. 로케일에 따라 변하지 않는 비교를 사용한다.

**현재 코드와의 차이:** 홈·상세는 같은 날짜 일기를 UUID순으로 정렬하지만, `queries.recentTimeline()`은 일기의 createdAt을 관리 이벤트 시각과 직접 비교하고, 캘린더는 관리 우선·kind·id 순이다. 제안은 세 구현이 원래 동일하다는 가정이 아니다. 관리 기록과 일기가 같은 시각에 *생성*돼도 2단계에서 위치가 결정되고, 타입별 같은 시각은 5~6단계에서 안정화된다. createdAt을 관찰 시각으로 섞지 않는다.

Phase 12C-2에서는 우선 전체 기록에 이 정책을 적용하고, 홈 정렬도 공유할지는 검토 후 명시적으로 결정한다. 공유하면 같은 날짜 일기·동시각 관리의 2개 최근 기록 선택이 일부 달라질 수 있다. 승인 없이 홈·상세·캘린더의 기존 정렬을 일괄 바꾸지 않는다.

## 6. 상세 이동: 현재 가능 / 추가 구현 구분

| 유형                      | 현재 존재하는 화면                                                  | 전체 기록 추천                                   |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| 일기                      | `/plants/:id/diary/:entryId` (상세), 뒤에 `/edit` (수정)            | 일기 상세로 직접 이동                            |
| 물주기·식물등·분갈이·비료 | 식물 상세 `/plants/:id`, 관리 수정 `/plants/:id/care/:eventId/edit` | 기본은 식물 상세의 해당 타임라인 항목으로 이동   |
| 타이머 기록               | 완료 후 일반 grow_light CareEvent                                   | 식물등과 동일. 별도 타이머 기록 상세 라우트 없음 |

**현재 타임라인에는 항목 id/hash 이동·highlight·해당 기록 탭 자동 선택 기능이 없다.** 따라서 `/plants/:id#care-event-<id>`는 기존 지원 URL이 아니다. 관리 기록 *상세 전용 라우트*도 없다. 편집 라우트는 실제로 존재하지만 열자마자 조회 상세인 것처럼 표시하면 안 된다.

추천 최소 추가(Phase 12C-2 승인 대상): 기존 상세에 `#care-event-<UUID>`를 읽는 얇은 이동 지원을 넣는다. 타임라인 탭을 선택하고 비동기 로딩 후 해당 항목까지 이동·포커스/일시 강조한다. 직접 URL/새로고침에서도 같은 동작을 하도록 hash를 선택하고, nav 높이·safe-area를 포함한 `scroll-margin`으로 가림을 막는다. 무조건 smooth scroll을 쓰지 않고 reduced-motion을 존중한다. 키보드 포커스는 기록 article에 `tabIndex=-1` 등으로 옮기고 보조기기에 제목을 제공한다.

기록이 삭제됐거나 다른 식물 소속이면 '이 기록을 찾을 수 없어요. 최신 기록을 확인해 주세요.'를 안내하고 해당 식물 상세는 유지한다. 식물도 삭제됐으면 기존 not-found 화면을 사용한다. 이 작은 상세 이동 보완까지 승인하지 않는 경우, MVP는 실제 식물 상세로만 이동하고 특정 항목까지 이동한다고 약속하지 않는다. 사용자 기대와 가장 잘 맞는 권장안은 hash 이동 지원이다.

## 7. 최소 공통 컴포넌트 구성

대규모 범용 기록 시스템을 만들지 않는다. 처음 권장하는 경계는 다음 정도다.

- `app/records-service.ts`(제안): 메타데이터 조회/통합, 순수한 제목·정렬·filter helper. 저장 작업 없음.
- `pages/RecordsPage.tsx` + 작은 전용 CSS(제안): URL 필터·조회 상태·날짜별 렌더링·노출 개수 관리.
- `components/records/RecordListItem.tsx`(제안): 도트 썸네일·제목·날짜/시각·화살표. `compact`(홈) / `full`(전체 기록) 두 형태까지만 지원. 링크는 caller가 전달해 홈의 현재 이동 방식을 유지할 수 있다.
- `RecordDateGroup`은 최초에는 페이지 안의 작은 함수/`section + h2 + ul`로 충분하다. 별도 재사용처가 없으면 파일을 늘리지 않는다.
- `RecordFilter` / `RecordEmptyState`도 처음에는 페이지의 짧은 마크업으로 시작한다. 로딩·오류는 기존 `DataFeedback`을 재사용한다.
- `plantArt`, `pixelAsset`, `fallbackPixelAsset`, `careLabels`, `fullDate`, 타이머 파서, `useRepositoryQuery`, `RepositoryProvider.invalidate`, `BottomNavigation`을 그대로 사용한다.

홈에서 공통 행을 추출한다면 **40px 이미지·간격·날짜/제목·화살표·기존 href·최근 2개를 먼저 그대로 보존**하고 회귀 캡처를 비교한다. `.garden-journal li span` 같은 현재 descendant selector와 새 마크업의 간섭도 확인한다. 전체 화면에 `.bookshelf-home` 클래스를 붙이거나 홈 CSS 전체를 덮어씌우지 않는다. 일괄 컴포넌트 추출보다 작은 중복이 더 안전하면 홈 JSX를 이번 구현에서 그대로 두는 대안도 가능하다.

## 8. 디자인·화면 구성안

상단은 요청대로 `GARDEN NOTES / 나의 기록 / 초록 친구들과 함께한 모든 순간`이다. 별도 뒤로 가기는 기존 홈 이동 방식과 맞추고 하단 3개 메뉴를 유지한다.

- 기존 `--ui-cream #f9ead7`, `--ui-surface #fff0d6`, `--ui-wood #5e3116`, `--ui-ink #43200b`, `--ui-border #d6ad7d`, `--ui-muted #826044`, `--ui-olive #466242`를 사용한다.
- Pretendard 400/500/600/700. 제목 28px 전후, 본문 14~15px, 식물명·시각 12px 전후. 도트 썸네일은 40~44px; 원본 사진으로 교체하지 않는다.
- 320px에서도 유형 필터를 **줄바꿈하는 44px 이상 칩 버튼**으로 배치해 화면 전체 가로 스크롤을 만들지 않는다. `aria-pressed`, 식물 select의 label, 검색 결과 개수 status를 제공한다. 탭 패널이 아니므로 필터를 ARIA tab으로 꾸미지 않는다.
- 날짜 그룹 헤더: `2026년 11월 1일 (일) · 오늘` + 그룹 기록 수.
- 행: 식물 도트 → 식물 이름(보조) / 제목(최대 2줄) / 관리 유형·로컬 시각 또는 일기 날짜 → 화살표. 제목 없는 일기는 '관찰 일기'. 식물등은 '식물등 N분'. 타이머 배지는 작게, 긴 시간 범위·ISO 메타데이터는 상세에서 확인한다.
- 메모를 노출한다면 최대 1~2줄 plain text. HTML을 해석하지 않으며, 사용자 메모·타이머 메타데이터가 행 전체를 밀어내지 않게 한다. 중첩 링크·행 내부 삭제/편집 버튼은 첫 MVP에서 추가하지 않는다.
- 홈의 최근 기록과 같은 연한 크림 카드·갈색 구분선·도트 아이콘을 사용하되, 큰 책장 장식·프레임·사진 갤러리는 추가하지 않는다.
- 앱 셸의 76px 메뉴 + safe-area + 24px 하단 여유를 재사용한다. 스크롤 끝의 마지막 행·'더 보기'가 메뉴에 가리지 않는지 확인한다.

### 빈 화면과 오류 문구

| 조건                              | 제안 문구 / 행동                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 전체 데이터에 기록 0개, 식물 있음 | '아직 남긴 기록이 없어요. 식물 상세에서 첫 물주기나 관찰 일기를 남겨 보세요.' · '내 정원으로'                 |
| 식물도 0개                        | '첫 초록 친구를 만나 보세요. 식물을 등록하면 이곳에 함께한 순간이 모여요.' · 기존 `/plants/new`로 '식물 등록' |
| 전체 기록은 있으나 필터 결과 0개  | '선택한 조건의 기록이 없어요. 다른 식물이나 기록 종류를 선택해 보세요.' · '필터 초기화'                       |
| 조회 실패                         | 기존 DataFeedback/다시 시도. 빈 기록으로 오인시키지 않음                                                      |
| 필터 식물이 삭제됨                | 전체 식물로 정상화 + '선택한 식물을 찾을 수 없어 전체 기록을 보여 드려요.'                                    |

사진 없는 일기·사진 로딩 실패를 빈 기록으로 취급하지 않는다. 기록의 실제 사진은 상세에서만 읽는다.

### 390px 정적 시안

[390px 검토 시안](design/phase-12c/records-concept-390.jpg). **실제 앱 캡처가 아니고, 모든 식물 이름·날짜·숫자·내용은 가상 데이터**다. 실제 코드에서 확인한 유형과 기존 도트 에셋·색상만 사용한다. 실제 사용자 데이터 예시는 포함하지 않는다. 시안의 필터·버튼은 동작하지 않으며 앱 라우트에 연결되지 않는다. 제작용 임시 HTML은 프로젝트 밖에 두고, 검토 이미지만 문서 폴더에 보관한다.

## 9. 데이터 증가·삭제·갱신

현재 API만 쓰면 P개 식물에 `1 + 2P`회 조회 후 N개 기록을 메모리에 모은다. DB 조회·정렬은 O(N) 데이터와 O(N log N) 정렬을 요구하며, 기존 `listByPlant()` 안의 정렬 비용도 더해진다. 다량의 메모도 함께 materialize되므로 목록에서 문자열을 줄여 보여 준다고 DB 전송 비용까지 줄어드는 것은 아니다. 다만 사진 Blob 로딩을 제외하는 효과는 크다.

첫 MVP는 **클라이언트 '30개 더 보기'**를 권장한다. 전체 metadata를 읽고 필터·정렬한 뒤 30개씩 렌더링하므로 **렌더링 제한이지 DB pagination은 아니다.** 날짜 그룹은 노출된 prefix에 대해 만들고, '표시된 수 / 필터 결과 전체 수'를 구분한다. 같은 날짜가 경계를 넘어도 더 보기 시 같은 그룹으로 합쳐야 한다. 필터 때 다른 식물의 후반 기록도 빠뜨리지 않도록 slice 이전에 필터한다.

수천~수만 건 목표는 아직 측정하지 않았으므로 빠르다고 단정하지 않는다. 많은 식물에 무제한 Promise.all이 부담이면 concurrency를 제한한다. 1,000/10,000건 metadata fixture로 첫 로드·필터·메모리·스크롤을 측정한 뒤, 기존 인덱스를 이용한 제한 조회/두 소스 merge cursor를 검토한다. diary는 생성일과 기록일이 달라 단일 timestamp cursor로 섞기 어렵다. 새 중복 기록 테이블이나 Blob 사본으로 해결하지 않는다. 필요 시 후속 Repository read API를 검토하되 schema 변경은 별도 근거가 있을 때만 한다.

현재 식물 삭제는 연결 일기·사진·CareEvent를 원자적으로 삭제한다. 단 실행/일시정지 타이머가 있으면 삭제를 차단한다. 일기 삭제는 연결 사진만 정리하고 별도 관리 이벤트는 유지한다. 전체 기록은 존재하는 식물에서 조회하므로 삭제 후 stale 항목을 계속 보여 주지 않아야 한다.

`useRepositoryQuery`는 invalidate revision, focus, visibilitychange에 재조회하며 오래된 Promise 결과의 적용을 막는다. 기존 작성/수정/삭제/타이머 완료/복원 동작이 invalidate를 호출하는 구조를 재사용한다. 필터 선택은 새 데이터에도 유지하고 사라진 식물만 정상화한다. 다른 탭 변경은 현재 즉시 실시간 반영이 아니라 포커스 복귀 재조회 수준이므로, liveQuery/BroadcastChannel을 이미 지원한다고 가정하지 않는다.

## 10. 구현 순서 (Phase 12C-2 승인 후)

1. 날짜-only 일기의 정렬 정책, 홈 공유 범위, 관리 기록 hash 이동 지원을 최종 확정.
2. 테스트 fixture를 독립 fake-indexeddb에 작성. 실제 사용자 DB는 사용하지 않음.
3. Blob 없는 metadata 통합 DTO·제목·안정적 comparator·필터 helper 구현 및 단위 테스트.
4. `/records`만 전용 페이지로 교체하고 AppLayout 전용 헤더 처리를 추가.
5. 정적 시안을 기준으로 필터·날짜 그룹·도트 행·2종 빈 상태·오류·더 보기 UI 연결.
6. 기존 일기 상세 링크 연결. 승인한 경우 상세 타임라인의 hash 이동만 최소 추가.
7. invalidate/삭제/뒤로 가기/새로고침/필터 URL·스크롤 복원 검증.
8. 홈 컴포넌트를 공유한다면 최근 2개·href·정렬·썸네일 디자인 회귀 확인. 아니면 홈을 그대로 둠.
9. 320/390px, 긴 이름, 키보드 포커스, safe-area·메뉴 겹침, 성능 fixture 검증.
10. 전체 타입·린트·포맷·Vitest·빌드·PWA 검사 후 비교 캡처 보고. 자동 커밋·배포는 별도 승인 전까지 하지 않음.

## 11. 위험과 테스트 계획

| 위험                           | 필수 테스트                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 동일 ID/동시각에서 불안정한 행 | 다른 테이블 같은 UUID, 같은 occurredAt/createdAt, 다른 plantId·유형, 입력/Promise 완료 순서를 바꿔도 같은 결과                                         |
| 최신순 의미 혼동               | 과거 일기를 오늘 작성·수정해도 entryDate 그룹 유지, 일기 실제 시각을 만들지 않음, 관리 우선·일기 보조 정렬 명시                                        |
| 시간대·자정                    | 한국·다른 시간대, UTC 오프셋이 다른 동일 instant, DST, 연도 경계, 자정 복귀, 타이머 자정 횡단은 종료일 한 건                                           |
| 타이머 원문 노출/잘못된 추정   | 정상/옛/손상 메모, 추가 사용자 메모, 수동 식물등, 실행 중 세션 제외, 1분 미만 미기록, 동일 세션 중복 종료                                              |
| 필터 누락                      | 전체·4유형 칩·기타(분갈이/비료), 식물 AND 조합, 0건/필터 0건 구분, 사진 없는 일기, invalid query·삭제된 plant                                          |
| 이동 실패                      | 일기 상세, 실제 관리 항목 hash는 비동기 로딩·새로고침·사진 탭에서 진입·키보드·back 복원, 삭제된 원본/다른 식물 기록                                    |
| 데이터 정합성                  | 등록·수정·유형/날짜 변경·삭제·식물 cascade·ZIP 복원 invalidate, 조회 도중 식물 삭제, 저장 실패를 빈 상태로 표시하지 않음                               |
| 불필요한 사진 로딩             | photos/backup.snapshot spy가 호출되지 않음, Blob URL 생성 없음, 도트 fallback, 사진 없는 식물 정상                                                     |
| 긴 목록·접근성                 | 0·1·30·31·1,000·10,000건, 더 보기/같은 날짜 그룹 합치기, 긴 식물 이름·제목, 320/390px 가로 넘침·44px 터치·선택 상태·reduced motion·마지막 행 메뉴 가림 |
| 기존 기능 회귀                 | 식물 CRUD·일기·성장 비교·물주기·타이머·캘린더·ZIP·PWA, refined 21종·painted 제외 유지, 홈 최근 기록 동작·픽셀 디자인                                   |

## 12. 이번 단계 검증 기록

- 기존 bookshelf/calendar/timer-record-display 테스트 **3개 파일, 25개 테스트 통과** (Node 24.22.2 / npm 11.19.1). 테스트를 추가·수정·삭제하지 않았다. 417개 전체 회귀·빌드는 문서/정적 이미지 작업이므로 이번에 재실행하지 않았으며, Phase 12C-2 완료 조건에 포함한다.
- 설계 문서 Prettier 검사와 `git diff --check` 통과.
- 정적 시안은 **390×1127px** 전체 세로 이미지다. 로컬 폰트와 기존 도트 에셋의 로딩·가로 넘침 없음(390px)을 확인했다. 실제 앱/PWA·기능·iPhone 실기기 캡처는 아니다.
- 소스·기존 테스트·DB·PWA의 tracked diff 없음. 새 파일은 이 문서와 정적 검토 JPG뿐이며 기존 Phase 12B 미추적 캡처는 보존했다.
- 실제 사용자 DB를 조회/수정하지 않았으며 커밋·Push·배포하지 않았다.

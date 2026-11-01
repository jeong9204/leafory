# Phase 12C-2 — 전체 기록 페이지 구현

## 범위와 변경 파일

기준: `test/iphone-pwa`, HEAD `841bc3a442385d9dc512709ffa14c171b2e73006`. 기존 설계 문서·정적 시안·Phase 12B QA 캡처는 보존했다. 로컬 구현 단계의 제한을 준수했으며, 이후 승인에 따라 Phase 12C 파일만 테스트 브랜치에 커밋·Push하고 Preview로 배포한다.

| 파일                                              | 변경                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/app/records-service.ts` (신규)               | 사진을 읽지 않는 metadata 통합 DTO, 필터, 안정적 comparator                             |
| `src/pages/RecordsPage.tsx` (신규)                | 실제 `/records`, 날짜별 그룹, URL 필터, 빈 상태·오류, 30개씩 더 보기, back 복원         |
| `src/pages/records.css` (신규)                    | 기존 Phase 12B 토큰을 이용한 GARDEN NOTES 디자인                                        |
| `src/app/routes.tsx`                              | `/records`만 lazy RecordsPage로 교체. SetupPage는 미지원 경로에서 유지                  |
| `src/app/AppLayout.tsx`                           | `/records` 전용 헤더 지원. 기존 safe-area·PWA 상태·하단 메뉴 조건 유지                  |
| `src/pages/PlantDetailPage.tsx`                   | hash 변경 시 기록 탭만 remount해 타임라인으로 진입. 타이머·상단 요약은 remount하지 않음 |
| `src/components/plant-detail/PlantRecordTabs.tsx` | async 로딩 후 hash 항목으로 포커스·스크롤, 없는 기록 안내                               |
| `src/components/plant-detail/PlantTimeline.tsx`   | 원본 CareEvent ID 기반 article anchor·접근 가능한 이름·programmatic focus               |
| `src/pages/plant-detail.css`                      | anchor 여백·강조·없는 기록 메시지. 직접 상세 URL에서도 로드되도록 상세 CSS에 배치       |
| `src/app/records-service.test.ts` (신규)          | metadata·필터·날짜/정렬·타이머·삭제·사진 미로드                                         |
| `src/pages/RecordsPage.test.tsx` (신규)           | 화면·더 보기·URL·back·갱신·anchor 회귀                                                  |
| `src/app/routes.test.tsx`                         | 기존 테스트 수 유지. records의 승인된 새 제목과 lazy 로딩 대기만 갱신                   |
| 이 문서, `docs/screenshots/phase-12c/`            | 구현·검증 보고와 로컬 QA 캡처                                                           |

## 실제 데이터 흐름

`RecordsPage → useRepositoryQuery → loadRecordIndex(repositories)`.

1. 기존 `runInTransaction`으로 식물 목록과 각 식물의 `careEvents.listByPlant` / `diaries.listByPlant`를 조회한다.
2. 원본 id·recordType·plantId·기록 날짜·생성 시각과 제목/이동 경로를 파생 DTO에 투영한다. 키는 `care_event:<id>` / `diary:<id>`로 테이블 간 같은 UUID도 보존한다.
3. 타이머 완료는 기존 grow_light 이벤트다. 기존 파서가 성공하면 '타이머 기록 · 실제 사용 …'를 표시하고 원본 ISO 메모는 목록에 표시하지 않는다. 추가 사용자 메모를 포함한 원본은 변경하지 않으며 기존 상세에서 그대로 확인한다. 파싱 실패 시 일반 식물등 기록으로 표시한다.
4. 전체 metadata를 정렬·필터한 후 30개씩 렌더링하고 날짜 그룹을 만든다. 사진 없는 일기도 포함하며 사진 한 장마다 별도 행을 만들지 않는다.
5. plantId Map으로 이름·학명을 조인하고 기존 `plantArt → pixelAsset → fallbackPixelAsset`으로 도트 썸네일을 얻는다. `photos.*`, `backup.snapshot`, `loadPlant`를 목록 조회에서 호출하지 않는다. 목록에서는 Blob URL도 만들지 않는다.

새 DB 테이블/마이그레이션/Repository API/의존성은 없다. 기존 transaction API가 `rw`이며 사진·타이머 테이블까지 lock하는 점은 그대로다. 콜백은 읽기만 수행하며 이미지 decode·외부 I/O를 넣지 않는다. 실제 사용자 저장소를 읽거나 초기화하지 않았다.

홈의 최근 2개, 썸네일·날짜·제목·화살표, 클릭 경로와 정렬은 수정하지 않았다. 캘린더 서비스·정렬도 그대로다. 홈 행을 공통 컴포넌트로 바꾸는 것은 불필요한 회귀 범위가 생기므로 하지 않았다.

## 필터·정렬·복원

- 유형: 전체 / 물주기 / 식물등 / 사진 일기 / 기타 관리. 기타는 분갈이+비료만 포함.
- 식물 선택은 plantId 기반이며 유형 필터와 AND로 적용한다.
- `/records?type=watering&plant=<uuid>`처럼 URL에 저장해 새로고침 후 유지한다. 전체는 parameter를 제거한다.
- 잘못된 유형·삭제된 식물은 해당 조건을 해제하고 안내한다. 존재하지 않는 plantId를 자식 Repository에 그대로 전달하지 않는다.
- 필터 변경/초기화 시 표시 수는 30으로 돌아간다. **전체 데이터에서 필터 후 slice**하므로 초기 30개 밖의 과거 일기도 찾는다.
- 날짜 내림차순 → 같은 날짜의 시각 있는 관리 이벤트 우선 → occurredAt 실제 instant 내림차순 → createdAt 내림차순 → recordType·고정 kind 순서 → 원본 ID·plantId 코드포인트 오름차순.
- 일기는 entryDate로 그룹화하며 createdAt은 같은 날짜 일기의 보조 정렬일 뿐이다. 실제 관찰 시각처럼 표시하지 않는다. 시간대가 바뀌면 관리 이벤트만 기기 로컬 날짜/시각으로 다시 판정한다.
- 더 보기는 30개 단위이며 같은 날짜는 하나의 그룹으로 합친다. 표시된 수와 필터 전체 수를 구분한다.
- 상세에서 돌아올 때 history entry key별 표시 개수·스크롤을 메모리에서 복원한다. Repository별 WeakMap, 최대 40개 entry이며 사용자 기록·사진은 저장하지 않는다. 브라우저 새로고침 후에는 필터만 유지하고 표시 수는 30으로 시작한다.
- focus/visibilitychange·기존 invalidate로 수정·삭제·복원 결과를 재조회한다. 다른 탭 변경의 실시간 push 구독은 추가하지 않았다.

## 관리 기록 앵커

- 일기: 기존 `/plants/:plantId/diary/:entryId` 상세로 이동.
- 관리: `/plants/:plantId#care-event-:eventId`로 이동. 식물 데이터 로딩 후 타임라인 탭을 표시하고 해당 article에 `focus({preventScroll:true})` 및 `scrollIntoView`를 적용한다.
- 직접 URL·새로고침, hash 변경, 사진 탭에서 다른 hash로 진입을 지원한다. 같은 hash의 단순 재조회에서는 포커스를 반복해서 빼앗지 않는다.
- `prefers-reduced-motion: reduce`에서는 smooth scrolling 없이 이동한다. 그 외에는 smooth scrolling을 사용한다. 위치 지정은 다음 animation frame에서 실행한다.
- article에 원본 id·`tabIndex=-1`·접근 가능한 제목을 제공하고 hash target/키보드 focus를 올리브 outline으로 표시한다. safe-area와 하단 메뉴를 고려한 scroll margin을 둔다.
- 기록이 사라졌거나 해당 식물의 기록이 아니면 '이 기록을 찾을 수 없어요. 최신 기록을 확인해 주세요.'를 표시한다. 식물 자체가 없으면 기존 not-found 화면을 사용한다.
- 관리 이벤트 수정·삭제·타이머 데이터 처리는 기존 코드를 유지한다.

## 화면·브라우저 검증

승인된 정적 시안의 크림색 그룹 카드, 브라운 구분선, 올리브 선택 상태, Pretendard, 도트 썸네일을 사용한다. 제작용 문구나 시안 가상 데이터는 앱에 추가하지 않았다. 뒤로 가기는 기존 서브페이지 헤더 패턴에 맞췄다.

실제 라우터·컴포넌트·Dexie Repository를 사용하는 임시 QA 진입점에서 생성한 **별도 DB**로 캡처했다. 샘플 이름/기록은 QA용이며 사용자 DB나 배포 앱에 주입하지 않았다. 사진은 프로젝트 공개 이미지로만 확인했다. 임시 진입점은 프로젝트에서 제거하고 `/private/tmp`에 보존했다.

| 자료                   | 캡처 / 결과                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- |
| 390px 목록             | [records-390.jpg](screenshots/phase-12c-ui/after-390.jpg)                          |
| 320px 목록             | [records-320.jpg](screenshots/phase-12c-ui/after-320.jpg)                          |
| 복합 필터 0건          | [records-filter-empty-320.jpg](screenshots/phase-12c/records-filter-empty-320.jpg) |
| 식물·기록 0개          | [records-empty-320.jpg](screenshots/phase-12c/records-empty-320.jpg)               |
| 기록 앵커              | [record-anchor-320.jpg](screenshots/phase-12c/record-direct-anchor-320.jpg)        |
| 실제 URL 새로고침 앵커 | [record-direct-anchor-320.jpg](screenshots/phase-12c/record-direct-anchor-320.jpg) |

- 320/390px 모두 `scrollWidth === innerWidth`, 도트 이미지 로딩 실패 없음. 유형 칩 높이 44px, 줄바꿈 확인.
- 앵커 스크롤 완료 후 article focus 및 하단 메뉴 가림 없음 확인. 긴 식물 이름과 타이머 배지도 확인.
- 별도로 새 localhost origin의 실제 `BrowserRouter`에서 빈 DB임을 확인하고 UI로 QA 식물/물주기 기록을 생성했다. `?type=watering` 새로고침 유지, 관리 hash URL 직접 새로고침 포커스, 브라우저 뒤로 가기 필터 복원을 확인했다. 해당 QA origin 외 기존 브라우저 사용자 데이터는 조작하지 않았다.
- 브라우저 앱 콘솔 error 없음. iPhone 네이티브 키보드·날짜 선택기·실제 Safe Area는 이 Chromium 검사로 검증했다고 보지 않는다.

## 테스트 및 품질 결과

Node **24.22.2** / npm **11.19.1**에서 `npm run check` 통과:

| 검사               | 결과                                                  |
| ------------------ | ----------------------------------------------------- |
| TypeScript         | 통과                                                  |
| ESLint             | 통과 · 경고 0                                         |
| Prettier           | 전체 검사 통과                                        |
| Vitest             | **42개 파일, 438개 테스트 통과** (기존 417 + 신규 21) |
| Production build   | 통과                                                  |
| PWA 검사           | 통과 · precache **72개 / 3,176,444B**                 |
| `git diff --check` | 통과                                                  |

기존 70개에서 RecordsPage의 lazy JS/CSS 2개가 추가되어 72개다. 새 route JS는 약 7.58kB, CSS는 약 3.65kB이며 초기 정적 JS 그래프 합계는 약 488.07kB다. PWA 정책·업데이트 로직은 수정하지 않았다. refined 21종 포함·painted WebP 제외와 원본 보존은 빌드 검증에서 확인했다.

전체 포맷 검사 중 기존 미추적 Phase 12B QA 파일 `preview-release-verification.json`의 들여쓰기만 정리했다. 키·값과 검증 내용은 그대로 보존했으며 앱/사용자 데이터 변경은 아니다.

기존 기록 탭의 라우터 없는 단독 렌더링 테스트도 유지하기 위해 hash/이동 key는 상세 페이지가 optional props로 전달한다. 테스트를 우회하거나 기존 재사용 조건을 삭제하지 않았다.

신규 service 9개 + 화면 12개 = **21개 테스트**를 추가했다. 기존 417개를 삭제하지 않았으며, 라우트 테스트의 records 제목 기대값을 '나의 기록'으로 바꾸고 lazy 로딩을 기다리도록 수정했다.

신규 범위: 일기/관리 복합 key, 사진/backup/미완료 타이머 미조회, 유형·식물·복합 필터, 과거 일기, 한국/미국 시간대, offset 및 동시각 정렬, 타이머 메타데이터, 수정·삭제/cascade, 조회 오류, 0개·필터 0개, 30/31개, 필터 후 pagination, back 표시 개수 복원, 삭제된 hash, 사진 탭에서 hash 이동, reduced-motion·포커스.

## 성능·남은 위험

- 현재 조회는 식물 P개에 `1+2P`회 metadata 조회, N개를 메모리에서 정렬한다. 비용은 대략 O(N log N), 기존 자식 Repository 내부 정렬 비용도 있다.
- 30개 더 보기는 DOM 수 제한이며 DB pagination이 아니다. 큰 메모가 있는 원본 metadata도 조회 때는 읽는다. 수천/수만 건 실기기 부하와 기존 rw transaction lock 경합은 별도 측정이 필요하다.
- 긴 article은 전체를 한 화면에 담을 수 없지만 해당 기록 제목·포커스와 기존 스크롤 경로를 유지한다. 이미지 늦은 로딩/서비스 워커 업데이트 후의 실기기 위치는 확인이 필요하다.
- 스크롤 복원은 같은 실행 세션에서의 back 동작을 지원한다. 앱 강제 종료·새로고침 후 임의 위치까지 영속 복원하는 기능은 아니다.

## iPhone 확인 목록

1. 테스트 전 ZIP 백업을 보관하고 기존 식물·일기·사진·타이머 유지 확인. 앱·Safari 데이터·IndexedDB는 삭제하지 않는다.
2. 기록 메뉴/홈 모두 보기, 320px에 가까운 좁은 폭에서 필터 줄바꿈·터치·select와 하단 홈 인디케이터 확인.
3. 기록 31개 이상에서 더 보기, 유형+식물 필터, 상세에서 back 후 위치·표시 개수 확인.
4. 일기 상세·관리 hash 이동, 사진 탭에서 진입, 직접 새로고침, 삭제된 기록 안내, VoiceOver 포커스 확인.
5. 동작 줄이기 설정에서 스크롤, 화면 끝 마지막 행과 고정 메뉴 간격 확인.
6. 기존 PWA 업데이트·오프라인 재실행과 사진 일기/관리 기록/타이머·백업 회귀. 이번 단계는 로컬 작업이며 Preview 배포는 하지 않았다.

## 최종 모바일 UI 보완 (2026-11-01)

승인된 기록 페이지에서 표시 부분만 소폭 수정했다.

- `src/pages/records.css`: 식물 이름을 12px/400의 한 줄 말줄임으로 표시한다. 제목은 15px/700, 우드 잉크 색상과 기존 2줄 clamp를 사용한다. 썸네일 44×44px, 화살표 14×14px에 min/max width와 중앙 정렬을 명시했다. 기존 44px/가변 콘텐츠/14px grid 구조는 유지한다.
- `src/pages/RecordsPage.tsx`: 식물 이름 전체를 title 속성에도 제공하고 타이머 배지를 `타이머 · 1분 1초` 형태로 간소화했다. 원본 문자열은 DOM 접근 가능한 링크 이름에 남아 있다.
- `src/pages/RecordsPage.test.tsx`: 짧은 배지 문구를 확인하고 저장된 원본 메모·분 단위 사용 시간이 그대로인지 검증하는 회귀 테스트 1개를 추가했다. 기존 437개를 삭제하지 않았다.
- 이 문서와 `docs/screenshots/phase-12c-ui/`: 같은 격리 QA DB의 수정 전후 캡처를 보존했다. 긴 이름·긴 일기 제목·타이머·날짜 그룹을 사용했으며 실제 사용자 데이터를 사용하지 않았다.

조회·정렬·필터·메타데이터 DTO·타이머 파서 및 계산·상세 href·DB·홈 디자인은 이번 UI 보완에서 변경하지 않았다.

| 검토 자료         | 320px                                                  | 390px                                                  |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| 전체 기록 전후    | [비교](screenshots/phase-12c-ui/compare-320.jpg)       | [비교](screenshots/phase-12c-ui/compare-390.jpg)       |
| 긴 일기 제목 전후 | [비교](screenshots/phase-12c-ui/compare-diary-320.jpg) | [비교](screenshots/phase-12c-ui/compare-diary-390.jpg) |
| 화면 하단         | [확인](screenshots/phase-12c-ui/after-bottom-320.jpg)  | [확인](screenshots/phase-12c-ui/after-bottom-390.jpg)  |

브라우저 측정: 320/390px에서 가로 넘침 없음, 이름 높이 18px·nowrap/ellipsis, 제목 최대 43.5px(21.75px × 2줄), 썸네일 폭 44px·화살표 폭 14px, 필터 높이 44px. 긴 이름은 320px에서 실제 말줄임을 확인했고 390px에서 여유가 있으면 한 줄 전체를 표시한다. 화면 끝 마지막 행 하단 약 y=719, 고정 메뉴 상단 y=768로 약 49px 여유가 있었다. 측정값은 `docs/screenshots/phase-12c-ui/layout-checks.json`에 보존한다.

Node 24.22.2 / npm 11.19.1에서 타입·린트·전체 포맷·**42개 파일 438개 테스트(기존 437 + 신규 1)**·프로덕션 빌드·PWA 검사가 모두 통과했다. precache는 **72개 / 3,176,444B**이며 refined 21종 포함·painted 원본 제외 정책은 유지된다. iPhone의 실제 Safe Area·네이티브 입력 환경은 실기기 재확인 대상이다. 이번 단계는 test/iphone-pwa 로컬 변경만 수행하며 커밋·Push·배포하지 않는다.

## 최종 Preview 배포 준비 (2026-11-01)

- 승인된 구현·UI 변경과 신규 21개 테스트를 포함한다. 기존 417개를 포함해 총 438개다. Node 24.22.2 / npm 11.19.1에서 전체 검사를 재실행해 통과했다.
- 최종 320/390px, 전후 비교, 빈 상태, 앵커, 정적 시안 이미지와 두 문서를 선별해 보관한다. 중복 캡처·QA JSON·생성용 코드·가상 데이터 ZIP은 커밋에서 제외하고 로컬에 보존한다.
- 홈 최근 기록·캘린더·데이터 모델·Repository·PWA 정책·21개 refined 에셋은 수정하지 않았다. precache 72개 / 3,176,444B, painted WebP 제외를 유지한다.
- GitHub Push 대상은 test/iphone-pwa뿐이다. main/Production에는 병합·Push·배포하지 않는다.
- 배포 후 검증은 새로운 배포 URL의 빈 저장소임을 먼저 확인한 다음 가상 QA 데이터로 진행한다. 기존 사용자 origin의 IndexedDB·사진·타이머를 조작하지 않는다. 실제 iPhone 오프라인·Safe Area 검증은 사용자 실기기 확인 항목으로 구분한다.
- 배포 SHA·Ready·Source·Node/npm 및 직접 확인하지 못한 항목은 배포 후 완료 보고에 기록한다.

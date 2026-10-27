# Phase 9 — 식물 성장 사진 비교

구현·검증: 2026-10-27. 기준 브랜치 `test/iphone-pwa`.
기능과 최종 UI는 사용자 승인을 받은 `test/iphone-pwa` 전용 변경입니다.
Git 반영과 Preview 배포 결과는 완료 보고에서 확인합니다. `main`과 Production은 변경 대상이 아닙니다.

후속 [제목·선택 개수·동일 높이 프레임 UI 보완](phase-9-ui.md)과 모바일 캡처도 참고하세요.

## 사용 흐름

식물 상세 → 성장 비교(`/plants/:id/compare`) → 사진 두 장 선택 → 선택한 사진 비교.
선택 화면과 비교 화면은 구분됩니다. 처음·최근 사진 선택, 선택 초기화, 사진 다시 선택을 지원합니다.
두 장을 선택하면 나머지 체크박스는 비활성화되고 기존 선택을 해제해 바꿀 수 있습니다.
사진이 0·1장이면 안내하며 비교·빠른 선택은 비활성화합니다.

기존 크림·세이지 색상, 로컬 Pretendard, 하단 네비게이션을 유지했습니다.
선택 썸네일은 정사각형 cover, 비교 이미지는 같은 4:5 영역에서 contain으로 표시합니다.
두 원본의 가로세로 비율이 달라도 원본 전체를 볼 수 있으며 Blob은 변경하지 않습니다.
비교 영역은 작은 화면에서도 두 열입니다. 날짜는 연도를 포함한 `YYYY.MM.DD`입니다.

## 데이터 정책

- 새 `app/growth-service.ts`의 `loadGrowthPhotos(repositories, plantId)`가 기존 Plant·DiaryEntry·DiaryPhoto
  Repository를 읽고 `{ plant, photos }`를 반환합니다. React와 Dexie 구현에는 의존하지 않습니다.
- photos의 각 항목은 `{ id, entryId, date, title, blob }`입니다. date는 사용자 로컬 달력 날짜로
  저장된 **일기의 entryDate**이며 사진 업로드·촬영 시각으로 대체하지 않습니다.
- 유효한 해당 식물의 일기에 연결된 사진만 포함합니다. entryId가 없는 대표 사진은 제외합니다.
  대표 사진으로도 지정돼 있지만 유효한 일기 연결을 가진 사진은 포함합니다.
- 오래된 일기 날짜순, 같은 날짜는 일기 생성 시각 → 일기 ID → 사진 sortOrder → 사진 ID로
  정렬합니다. 같은 날짜·일기의 여러 사진도 비교할 수 있습니다. 빠른 선택은 이 순서의 양 끝입니다.
- 기존 데이터 모델·DB v1 스키마·테이블·사진·일기·관리 기록은 변경하지 않습니다.
  비교 선택도 DB나 백업에 저장하지 않습니다. 앱 새로고침 시 선택만 초기화되고 사진은 유지됩니다.

## 삭제·오류·메모리 처리

기존 `useRepositoryQuery`로 앱 내부 데이터 변경 revision, 창 포커스, 문서 재표시 및 수동
새로고침을 반영합니다. 비교 진입 시에도 다시 조회합니다. 별도의 IndexedDB 직접 구독은 추가하지 않았습니다.
일기 날짜·제목·사진 변경은 다음 조회에 반영됩니다. 삭제된 사진/일기를 선택했다면 해당 ID를
유효한 선택에서 제외하고 남은 선택을 유지하며 재선택을 안내합니다. 다른 사진으로 몰래 대체하지 않습니다.
삭제 경합으로 일기 연결이 없는 사진도 제외합니다. 없는 식물은 안내, 저장소 오류는 재시도 화면입니다.

기존 PlantPhoto의 Blob URL 생성·해제 로직을 재사용합니다. 선택/비교 전환, 사진 변경·제거,
페이지 이탈 시 해제합니다. 사진 비교는 시각적 확인 기능이며 자동 성장 측정·판정은 하지 않습니다.

## 변경 파일

- `src/app/growth-service.ts`, `src/app/growth-service.test.ts`: 읽기 모델·정렬·연결 필터와 데이터 검증.
- `src/components/growth/GrowthComparison.tsx`, `.test.tsx`: 선택·비교·삭제된 선택·URL 수명.
- `src/pages/GrowthComparisonPage.tsx`, `.test.tsx`, `growth-comparison.css`: 조회·오류·반응형 화면.
- `src/app/routes.tsx`, `routes.test.tsx`, `AppLayout.tsx`: lazy route와 자체 헤더 연결.
- `src/pages/PlantDetailPage.tsx`, `plant-detail.css`: 성장 비교 진입 링크. 기존 기록 버튼·탭 간격 유지.
- `src/pwa/vercel.test.ts`: 기존 SPA rewrite가 새 경로를 포함하는지 검사. Vercel 설정은 미변경.
- `README.md`, 이 문서 및 `docs/screenshots/phase-9/`: 사용 방법과 검증 자료.

서비스 워커 캐시·업데이트 보호 정책은 변경하지 않았습니다. 새 지연 로딩 JS/CSS는 기존 빌드
과정에서 자동 precache되며 PWA 빌드 검사에서 셸·청크·폰트·아이콘 32개를 확인했습니다.

## 테스트

타입·린트·포맷·전체 **294개 테스트 / 31파일**·빌드 통과.
기존 식물·관리 기록·사진 일기·백업·캘린더·PWA 회귀 검사를 포함합니다.
새 3개 테스트 파일의 21개 시나리오 및 기존 라우팅 테스트의 새 경로 항목을 추가했습니다.

- 사진 없음·1장·여러 장, 대표 사진 제외/일기 연결 예외, 다른 식물 분리.
- 과거 날짜·날짜별 순서·같은 일기 sortOrder, 일기 날짜 수정·사진/일기 삭제 반영.
- 조회 전후 snapshot과 원본 Blob 보존, 없는 식물/잘못된 ID/조회 오류 전달.
- 두 장 선택 제한·해제·초기화·처음/최근 선택·다시 선택·연도 포함 날짜.
- 비교 진입 전 삭제, 비교 중 삭제 후 재조회와 남은 선택 유지.
- 선택/비교 전환·언마운트에서 생성한 모든 Blob URL 해제, 조회 실패 재시도.

## 실제 브라우저 확인

Chrome의 320/390/402px viewport로 실제 앱·Repository·Dexie 연결을 확인했습니다.
기존 데이터와 분리된 `http://127.0.0.1:4188`의 전용 `leafory-phase9-qa-20261027-*` DB만
사용했습니다. 각 경우에 원래 앱의 기본 DB를 열거나 초기화하지 않았습니다.
검증 코드·임시 진입 파일은 검증 후 제거하며 QA DB도 자동 삭제하지 않습니다.

QA 이미지는 저장소의 기존 cactus 목업을 서로 다른 비율로 만든 테스트 Blob입니다.
실제 성장의 전후 사진이나 사용자의 개인 사진이 아닙니다. 원본 비율 360×540, 720×360을
사용했고 사진 0·1·2·4장, 과거 날짜, 긴 제목, 실제 상세 링크 진입과 새로고침 복원을 확인했습니다.

| viewport | 비교 영역(각 사진) | 가로 넘침 | 날짜                    |
| -------- | ------------------ | --------- | ----------------------- |
| 320px    | 138×172.5px        | 없음      | 2025.07.01 / 2026.10.27 |
| 390px    | 173×216.25px       | 없음      | 동일                    |
| 402px    | 179×223.75px       | 없음      | 동일                    |

320px 긴 목록 끝에서 비교 버튼 하단은 약 744px, 네비게이션 상단은 768px로 약 24px
여백을 확인했습니다. 전체 페이지 캡처에서는 고정 네비게이션이 문서 중간에 보일 수 있습니다.
실제 화면 끝 캡처를 함께 제공합니다. 브라우저 safe-area는 0이며 iPhone standalone 실기기
검증은 이번 결과에 포함하지 않습니다. 승인된 다음 배포에서 업데이트 후 확인해야 합니다.

| 화면            | 320px                                           | 390px                                           | 402px                                           |
| --------------- | ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| 사진 선택 (4장) | [캡처](screenshots/phase-9/selection-4-320.jpg) | [캡처](screenshots/phase-9/selection-4-390.jpg) | [캡처](screenshots/phase-9/selection-4-402.jpg) |
| 두 사진 비교    | [캡처](screenshots/phase-9/comparison-320.jpg)  | [캡처](screenshots/phase-9/comparison-390.jpg)  | [캡처](screenshots/phase-9/comparison-402.jpg)  |
| 사진 없음       | [캡처](screenshots/phase-9/selection-0-320.jpg) | [캡처](screenshots/phase-9/selection-0-390.jpg) | [캡처](screenshots/phase-9/selection-0-402.jpg) |
| 사진 1장        | [캡처](screenshots/phase-9/selection-1-320.jpg) | [캡처](screenshots/phase-9/selection-1-390.jpg) | [캡처](screenshots/phase-9/selection-1-402.jpg) |
| 사진 2장        | [캡처](screenshots/phase-9/selection-2-320.jpg) | [캡처](screenshots/phase-9/selection-2-390.jpg) | [캡처](screenshots/phase-9/selection-2-402.jpg) |

[320px 목록 끝·하단 여백](screenshots/phase-9/selection-bottom-320.jpg).

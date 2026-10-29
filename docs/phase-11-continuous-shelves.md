# Phase 11 연결된 가로 선반 보완

기존 Phase 11 미커밋 작업을 보존한 상태에서 책장 내부 표시만 다듬었습니다. 브랜치는 `test/iphone-pwa`, HEAD는 `6dc70b0`이며 커밋·Push·배포를 하지 않습니다.

## 변경 파일

- `src/components/bookshelf/Bookshelf.tsx`: 식물별 분할 선반 대신 각 행 끝의 공통 가로 선반과 빈 칸 소품 배치
- `src/pages/bookshelf-home.css`: 내부 세로 질감 대비 완화, 전체 폭 가로 선반, 작은 이름 명패, 안전한 소품 공간
- `src/components/bookshelf/Bookshelf.test.tsx`: 기존 개수별 회귀 시나리오에 9개 추가
- 본 문서와 `docs/screenshots/phase-11-continuous/` 비교 캡처

기존 미커밋 HomePage, 홈 조회 서비스, 픽셀 SVG, 이전 문서·캡처도 그대로 남깁니다. 상단 헤더, 요약, 식물 추가, 최근 기록, 폰트, 하단 3개 메뉴는 이번에 수정하지 않았습니다.

## 세로 구분선과 선반

- 별도의 칸막이 DOM은 없었으며, 기존 `wood.svg`의 진한 세로 이음선과 타일의 대비가 칸막이처럼 보였습니다. 원본 파일을 변경하지 않고 내부 배경에서만 18% 불투명도의 장식 레이어로 표현해 크게 완화했습니다. 책장 바깥 기둥은 유지합니다.
- 기존 각 `.shelf-plant::after`가 그리던 분할 가로 선반을 제거했습니다. 이제 CSS Grid의 행 끝에서 `.shelf-rail`이 `grid-column: 1 / -1`로 책장 안쪽 폭 전체를 한 번에 그립니다.
- 각 가로 선반은 16px 두께의 밝은 윗면·브라운 앞면·짙은 아랫면과 그림자를 공유합니다. 행이 늘어나도 동일한 바깥 프레임 안에서 연결됩니다.
- 식물 셀에는 배경 박스·카드 테두리를 추가하지 않았습니다. 이름표는 최대 108px 폭, 46px 높이의 작은 명패와 약한 1px 테두리로 줄였습니다. 클릭 영역은 전체 화분 링크를 유지합니다.

## 식물·소품

- 기존 320px 2열, 390/402px 3열 Grid와 실제 등록 식물만 표시하는 원칙을 유지합니다. 종류별 그림 높이와 고정 스테이지 바닥을 유지해 명패 기준선이 맞습니다.
- 별도의 작은 장식층을 제거하고 처음 두 가로 선반 끝에만 작은 책/물뿌리개를 놓습니다. 34px의 셀 아래 여유 공간 안에 32px 소품을 배치하여 명패·상태·링크와 겹치지 않게 합니다.
- 마지막 행에 빈 칸이 있으면 해당 칸에 책과 물뿌리개를 놓습니다. 실제 식물 칸을 줄이지 않으며 임의 랜덤 배치를 하지 않습니다.
- 소품과 선반은 `aria-hidden`, presentation 역할, `pointer-events: none`으로 화면 읽기나 클릭을 가로채지 않습니다.
- 빈 책장 UI, 물주기/식물등 요약과 접근성 레이블, 기존 상세 링크를 유지합니다. 기록만 표시하며 건강·건조 상태를 추정하지 않습니다.

## 실제 브라우저 검증

내장 브라우저에서 사용자 DB와 분리된 `leafory-continuous-qa-20261029-*`만 사용했습니다. 이전 캡처는 직전 보완 작업에서 보존했고, 이번에는 동일한 9개 샘플 구성으로 새 캡처를 만들었습니다. iPhone 실기기 캡처는 아닙니다.

| 너비              | 이전                                                             | 수정 후                                                         |
| ----------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| 320px             | [이전](screenshots/phase-11-continuous/before-320.jpg)           | [수정](screenshots/phase-11-continuous/after-320.jpg)           |
| 390px             | [이전](screenshots/phase-11-continuous/before-390.jpg)           | [수정](screenshots/phase-11-continuous/after-390.jpg)           |
| 402px             | [이전](screenshots/phase-11-continuous/before-402.jpg)           | [수정](screenshots/phase-11-continuous/after-402.jpg)           |
| 390px 전체 스크롤 | [이전 전체](screenshots/phase-11-continuous/before-full-390.jpg) | [수정 전체](screenshots/phase-11-continuous/after-full-390.jpg) |

전체 페이지 캡처에는 고정 하단 메뉴가 중간에 표시될 수 있습니다. 실제 스크롤 중에는 viewport 하단에 고정되며, 페이지 끝 실측은 footer 하단 743.9px / 메뉴 시작 768px로 약 24px 여유를 확인했습니다. [하단 캡처](screenshots/phase-11-continuous/bottom-390.jpg)

- 식물 0/1/2/3/9/12개 × 320/390/402px의 18개 조합에서 scrollWidth가 viewport 너비와 일치했습니다. 장식과 화분 링크·이름표·상태·물주기 버튼의 교차 영역은 모두 없었습니다.
- 선반 수: 식물 9개는 320px 5개 / 390·402px 3개, 식물 12개는 320px 6개 / 390·402px 4개로 실제 계산한 행 수와 일치했습니다.
- 320px 첫 행 명패는 모두 top 506.2px / bottom 552.2px, 높이 46px로 정렬되었습니다. 긴 이름은 line-clamp=2, 높이 35px이며 전체 이름을 링크 레이블로 제공합니다.
- 실제 DB에서 조회한 12개 식물 각각의 링크를 눌러 올바른 상세 제목과 돌아오기를 확인했습니다. 키보드 Tab 포커스 표시와 물주기 버튼 44×44px도 확인했습니다.
- 모든 책장 이미지가 정상 로딩되었습니다. 기존 SVG·나무 질감 파일을 재사용하며 외부 에셋·의존성을 추가하지 않았습니다. 사진 Blob 미조회 정책도 유지합니다.

[0개](screenshots/phase-11-continuous/plants-0-390.jpg) · [1개](screenshots/phase-11-continuous/plants-1-390.jpg) · [2개](screenshots/phase-11-continuous/plants-2-390.jpg) · [3개](screenshots/phase-11-continuous/plants-3-390.jpg) · [12개](screenshots/phase-11-continuous/plants-12-390.jpg)

## 데이터·기능 보호

Phase 10 타이머, 데이터 모델·Dexie 스키마·Repository·사진 Blob·일기·백업 형식을 수정하지 않았습니다. 기존 등록·수정·삭제·관리 기록·성장 비교·캘린더·백업/복원·PWA 구현을 유지합니다. QA 진입 소스와 로컬 서버는 검증 후 정리하며 사용자 데이터는 초기화하지 않습니다.

## 최종 검사 결과

타입·린트·포맷·전체 38개 파일 / 366개 테스트·빌드·PWA 검증 통과. PWA precache는 기존 에셋을 포함한 48개입니다. `git diff --check`도 통과했습니다. 스테이징된 변경은 없으며 HEAD와 원격 테스트 브랜치 추적 참조는 선행 타이머 표시 커밋 `6dc70b0` 그대로입니다.

# Phase 11 책장 홈 보완

이전 Phase 11 미커밋 구현 위에서 홈 표시만 보완했습니다. 식물등 타이머·DB 모델·Repository·사진 Blob·기존 관리 기록은 변경하지 않습니다. 새 에셋이나 의존성 없이 기존 SVG를 재사용합니다.

## 변경 내용

- 처음 두 선반 사이에만 책/물뿌리개, 작은 액자/고양이 장식 구간을 배치합니다. 장식은 식물 슬롯을 차지하지 않으며 식물이 더 늘어나도 반복 구간은 두 개를 넘기지 않습니다. 2열·3열에서 각각 행이 끝난 뒤 표시합니다.
- 식물이 적을 때는 마지막 빈 칸과 하단의 기존 장식을 사용합니다. 중앙 액자 반복을 줄이고 빈 책장 중앙에는 물뿌리개를 배치합니다. 식물이 많을 때는 별도의 큰 하단 장식 선반을 생략합니다.
- 나무 배경의 어두운 가장자리 그림자를 완화하고 램프 주변에 따뜻한 빛을 더했습니다.
- 320px 2열, 390/402px 3열을 유지합니다. 화분 그림은 고정된 스테이지 바닥에 정렬하고 종류별 표시 높이만 112~143px로 조절합니다.
- 이름표는 최소 52px 높이, 12px Pretendard와 최대 2줄을 사용합니다. 긴 이름 전체는 링크의 접근 가능한 이름으로 유지합니다. 건강 수치처럼 보일 수 있는 정적 점 장식을 제거했습니다.
- 관리 표시는 한 줄 요약입니다. 물주기는 ‘오늘 / N일 전’, 오늘의 식물등 기록은 햇빛 아이콘과 ‘기록’으로 표시합니다. 둘 다 없으면 중립적인 ‘관리 기록 없음’ 한 문구만 보여줍니다. 건조·빛 부족·질병을 추정하지 않습니다.
- 상태 아이콘은 접근성 레이블과 title에 마지막 물주기 날짜 또는 오늘 식물등 분량을 제공합니다. 기존 상세 링크에서 전체 정보를 확인합니다. 중복 말풍선을 제거했으며 물방울 + 기록 버튼은 기존 동작과 44px 터치 영역을 유지합니다.
- 홈/기록/캘린더, 최근 기록, 식물 추가, 백업/설치 안내 진입을 유지합니다.

## 이번 보완 파일

- `src/components/bookshelf/Bookshelf.tsx`
- `src/pages/bookshelf-home.css`
- `src/pages/HomePage.tsx`의 설명 문구
- `src/components/bookshelf/Bookshelf.test.tsx`, `src/pages/HomePage.test.tsx`
- 본 문서와 `docs/screenshots/phase-11-refinement/`

## 실제 브라우저 확인

Chrome 연결이 지연되어 내장 브라우저에서 새 캡처를 완료했습니다. 사용자 데이터와 별개인 `leafory-refinement-qa-20261029-*` DB만 사용한 QA 화면입니다. 비교 전 캡처는 이전 Phase 11에서 보존한 Chrome 이미지이며, 보완 후는 동일한 9개 샘플 구성의 내장 브라우저 이미지입니다. iPhone 실기기 캡처는 아닙니다.

| 너비        | 이전                                                   | 보완                                                  |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------- |
| 320px / 2열 | [이전](screenshots/phase-11-refinement/before-320.jpg) | [보완](screenshots/phase-11-refinement/after-320.jpg) |
| 390px / 3열 | [이전](screenshots/phase-11-refinement/before-390.jpg) | [보완](screenshots/phase-11-refinement/after-390.jpg) |
| 402px / 3열 | [이전](screenshots/phase-11-refinement/before-402.jpg) | [보완](screenshots/phase-11-refinement/after-402.jpg) |

- [전체 책장 390px](screenshots/phase-11-refinement/after-full-390.jpg): 긴 페이지의 고정 메뉴가 중간에 보이는 것은 전체 캡처 특성입니다.
- [0개](screenshots/phase-11-refinement/plants-0-390.jpg) · [1개](screenshots/phase-11-refinement/plants-1-390.jpg) · [2개](screenshots/phase-11-refinement/plants-2-390.jpg) · [3개](screenshots/phase-11-refinement/plants-3-390.jpg) · [12개](screenshots/phase-11-refinement/plants-12-390.jpg)
- [페이지 끝 여백](screenshots/phase-11-refinement/bottom-390.jpg)

320/390/402px에서 가로 넘침 없음, 2/3열 확인. 320px 이름표 첫 행 두 개의 top/bottom은 동일하며 높이는 52px입니다. 긴 이름의 실제 CSS line-clamp=2, 표시 높이 35px / line-height 17.4px를 확인했습니다. 물주기 버튼은 44×44px입니다.

식물 0/1/2/3/12개 실제 조회, 12개에서 상세 ID 이동, 키보드 포커스와 장식 최대 두 구간을 확인했습니다. 모든 책장 이미지의 complete/naturalWidth가 정상입니다. 하단 footer 끝 743.9px, 고정 메뉴 시작 768px(390×844)로 약 24px 여유를 유지합니다.

홈의 사진 Blob 미조회 정책과 기존 15개 SVG(약 25KB)를 유지합니다. 추가 네트워크 에셋이나 외부 폰트를 도입하지 않았습니다. 새 장식들은 기존 파일 URL을 재사용하므로 동일한 에셋을 반복 다운로드하지 않습니다.

커밋·Push·배포를 하지 않으며 main·Production·사용자 기본 IndexedDB를 변경하지 않습니다. QA 진입 소스는 검증 후 제거합니다.

## 최종 검사

타입·린트·포맷·전체 38개 파일 / 365개 테스트·빌드·PWA 검증 통과. 기존 타이머·일기·백업·캘린더 회귀 테스트를 유지했습니다. `git diff --check`도 통과했으며 HEAD와 원격 테스트 브랜치 추적 참조는 `6dc70b0` 그대로입니다.

# Phase 9 성장 비교 UI 최종 보완

확인일: 2026-10-27. `test/iphone-pwa`에서 UI만 보완했습니다.
최종 승인된 기능·UI의 Git 반영 대상은 `test/iphone-pwa`이며 Production은 변경하지 않습니다.

## 변경

- `src/pages/growth-comparison.css`: 제목의 테두리처럼 보이던 것은 프로그램 방식으로
  제목에 포커스를 옮길 때의 outline입니다. 제목의 포커스 이동·접근성은 유지하면서
  제목에만 outline을 제거했습니다. 버튼·체크박스에는 기존 키보드 포커스 표시를 유지합니다.
  제목은 홈의 섹션 제목과 같은 Pretendard 21px / 700, 줄 높이 1.25, 색상·자간으로 맞췄습니다.
  선택 개수는 13px / 600, Forest 색상과 고정 폭 숫자로 강조합니다. 버튼 형태로 꾸미지 않았습니다.
- `src/components/growth/GrowthComparison.tsx`: 이미지 바깥에 전용 프레임을 추가했습니다.
  프레임의 4:5 비율이 표시 높이를 정하고 이미지는 그 안에서 `width/height: 100%`,
  `object-fit: contain`으로 원본 비율을 유지합니다. 이미지의 고유 크기나 HTML width/height가
  프레임 높이에 영향을 주지 않도록 분리했습니다. 빈 영역은 기존 `#E9EDE2` 배경입니다.
  날짜·설명 figcaption과 선택·해제·초기화·빠른 선택·재선택 로직은 변경하지 않았습니다.

원본 Blob, 날짜, 데이터 계층, DB 스키마, 기존 PWA 정책에는 변경이 없습니다.

## 검증

타입·린트·포맷·전체 **294개 테스트(31파일)**·빌드 통과.
기존 성장 비교의 선택·해제·재선택·사진 삭제 대응·Blob URL 해제 테스트를 유지했습니다.
PWA precache 32개 항목 검사도 통과했습니다.

실제 Chrome의 세 viewport에서 세로 360×540과 가로 720×360의 메모리 테스트 Blob을
비교했습니다. QA 화면은 실제 GrowthComparison 컴포넌트와 공통 CSS·로컬 폰트를 사용하며
Repository와 IndexedDB를 열거나 쓰지 않았습니다. 목업 cactus에서 만든 테스트 이미지이며
사용자의 개인 사진 또는 실제 성장 전후 기록은 아닙니다. QA 진입 파일은 확인 후 제거했습니다.

| viewport | 두 프레임 높이 | 두 이미지 영역 높이 | fit     | 가로 넘침 |
| -------- | -------------- | ------------------- | ------- | --------- |
| 320px    | 각 172.5px     | 각 172.5px          | contain | 없음      |
| 390px    | 각 216.25px    | 각 216.25px         | contain | 없음      |
| 402px    | 각 223.75px    | 각 223.75px         | contain | 없음      |

- 세 폭 모두 `0 / 2` → `1 / 2` → `2 / 2` → 해제 후 `1 / 2`를 확인했습니다.
- 비교 후 ‘사진 다시 선택’을 누르면 `2 / 2` 선택이 유지됩니다.
- 포커스된 제목의 outline은 none, border는 0px입니다.
- 키보드 Tab으로 ‘사진 다시 선택’ 버튼에 이동하면 2px solid outline이 표시됩니다.
- 비교 프레임 배경은 두 영역 모두 rgb(233, 237, 226)입니다.
- 날짜와 설명은 기존 순서·스타일로 표시하며 원본 비율에 따른 여백만 남깁니다.

이번 캡처는 브라우저 컴포넌트 검증이며 실제 iPhone PWA standalone 캡처는 아닙니다.
Safari의 최종 실기기 결과는 승인된 다음 Preview 배포에서 확인해야 합니다.

| 화면                | 320px                                              | 390px                                              | 402px                                              |
| ------------------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| 제목·선택 0장       | [캡처](screenshots/phase-9-ui/selection-0-320.jpg) | [캡처](screenshots/phase-9-ui/selection-0-390.jpg) | [캡처](screenshots/phase-9-ui/selection-0-402.jpg) |
| 선택 2장            | [캡처](screenshots/phase-9-ui/selection-2-320.jpg) | [캡처](screenshots/phase-9-ui/selection-2-390.jpg) | [캡처](screenshots/phase-9-ui/selection-2-402.jpg) |
| 세로·가로 사진 비교 | [캡처](screenshots/phase-9-ui/comparison-320.jpg)  | [캡처](screenshots/phase-9-ui/comparison-390.jpg)  | [캡처](screenshots/phase-9-ui/comparison-402.jpg)  |

[390px 선택 1장](screenshots/phase-9-ui/selection-1-390.jpg).

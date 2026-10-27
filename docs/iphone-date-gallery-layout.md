# iPhone 날짜 입력·기록 간격·사진 카드 보정

확인일: 2026-10-27. `test/iphone-pwa`에서 작업했습니다.
기준은 사용자가 제공한 iPhone PWA 캡처 3장입니다. 첨부한 개인 사진은 저장소에 복사하지 않았습니다.
레이아웃 검토 후 사용자 승인에 따라 `test/iphone-pwa`에만 커밋·push하는 변경입니다.
최신 커밋과 Preview Ready 여부는 완료 보고에서 확인합니다. Vercel 설정은 변경하지 않습니다.

## 변경 파일과 원인

- `src/pages/plant-management.css`: 데려온 날짜(`type=date`, `name=acquiredAt`)만
  `width: auto`, `min-width: 0`, `max-width: 100%`, `box-sizing: border-box`,
  `justify-self: stretch`, `appearance: none`을 적용했습니다.
  부모는 이미 `minmax(0, 1fr)` grid여서 이 콘텐츠 폭 안에서 늘어나도록 합니다.
  WebKit 내부 날짜 값에는 최소 높이·정렬을 지정합니다. 입력 종류·값·이벤트·선택·저장은 유지합니다.
  날짜 입력이나 부모에 overflow 숨김을 추가하지 않았습니다.
- `src/pages/plant-detail.css`: 상세 바로 아래의 `.detail-actions + .detail-records`에만
  위 여백 16px을 적용합니다. 두 기록 버튼 사이의 기존 9px 간격은 유지합니다.
  갤러리 카드는 같은 행에서 높이를 채우고 정보 영역에 최소 132px을 확보합니다.
  썸네일은 1:1, `object-fit: cover`를 유지합니다. 제목은 최대 두 줄로 말줄임합니다.
- `src/components/plant-detail/PlantRecordTabs.tsx`: 일기 링크를 공통 figcaption 안으로
  옮겨 날짜 → 제목/사진 종류 → 일기 보기의 순서를 통일했습니다. 링크가 없는 대표 사진에도
  같은 하단 공간이 남아 날짜와 설명 위치가 맞습니다. 링크 목적지와 탭 동작은 유지합니다.
  전체 제목은 DOM 텍스트와 title 속성에 남습니다.

기존에는 일기 링크가 이미지와 figcaption 사이에 따로 있었고, 대표 사진에는 없었습니다.
이에 따라 날짜 위치가 달라지고 카드 높이 차이가 발생했습니다. 긴 제목도 카드 높이를 늘렸습니다.

## Safari 날짜 입력 분석과 한계

기존 CSS에도 `width: 100%`, `min-width: 0`, `max-width: 100%`가 있었고
Tailwind 기본 border-box가 적용됩니다. 일반적인 부모 grid 최소 폭 문제만으로는 iOS에서의
오른쪽 침범을 설명하기 어렵습니다. iOS에서 날짜·시간 입력에 패딩과 100% 너비를 함께
적용하면 다른 필드와 폭 계산이 달라지는 [WebKit 버그 301648](https://bugs.webkit.org/show_bug.cgi?id=301648)이
보고되어 있으며 제공된 캡처와 일치하는 증상입니다. 해당 버그는 macOS에서 재현되지 않는다고
보고되어 있습니다. 이 보고와 캡처를 근거로 한 원인 판단이며 연결된 iPhone에서 내부 렌더링을
직접 검사한 결과는 아닙니다.

퍼센트 width 계산을 피하고 grid stretch로 크기를 정하도록 보정했습니다. 날짜 필드를 텍스트
입력으로 바꾸거나 선택기를 별도로 만들지 않았습니다. 실제 iPhone Safari/PWA에서 빈 값과
선택된 값, 선택기 열기·취소·저장을 다시 확인해야 합니다. Preview 배포 후에도 설치된
iPhone 앱에서 안전한 화면으로 나온 뒤 업데이트를 적용하고 확인합니다. 사이트 데이터는 삭제하지 않습니다.

## 브라우저 검증

실제 컴포넌트와 기존 폰트를 사용하는 임시 검증 화면에서 Chrome의 320/390/402px을
확인했습니다. 검증 화면은 Dexie를 import하거나 IndexedDB를 열지 않았습니다.
PNG Blob은 캔버스로 만든 가상 이미지이며 원본 크기는 가로 960×360, 세로 360×960,
정사각 480×480입니다. 원본 Blob을 리사이즈하거나 교체하지 않고 CSS로 썸네일만 표시했습니다.
검증용 코드와 기준 버전 임시 복사본은 검증 후 제거했습니다.

| viewport | 날짜/다른 필드 폭 | 오른쪽 여백 | 썸네일    | 카드 높이 | 정보 영역 |
| -------- | ----------------- | ----------- | --------- | --------- | --------- |
| 320px    | 266 / 266px       | 15px        | 143×143px | 275px     | 132px     |
| 390px    | 322 / 322px       | 18px        | 174×174px | 306px     | 132px     |
| 402px    | 334 / 334px       | 18px        | 180×180px | 312px     | 132px     |

- 날짜: 빈 값·과거 날짜 선택 값 모두 좌우 정렬 일치, 가로 넘침 없음.
- 사진: 1·2·3개를 각 폭에서 확인, 같은 행 카드 높이 일치, 사진 0개 빈 상태도 확인.
- 긴 제목: 두 줄(36px)로 표시하고 넘치는 내용 말줄임. 원래 문자열은 유지.
- 기록 버튼 → 탭: 세 폭 모두 16px.
- 일기 링크: 기존 `/plants/:id/diary/:entryId` 경로 유지.
- 하단: 390×844의 페이지 끝에서 메모 하단 약 744px, 네비게이션 상단 768px로
  약 24px 여백 유지. 전체 페이지 캡처에서 고정 네비게이션이 중간에 보이는 현상은
  [이전 검증 문서](iphone-pwa-layout.md)의 설명과 같습니다.

캡처는 브라우저 컴포넌트 검증 화면이며 iOS standalone 캡처가 아닙니다.
비교 캡처는 같은 가상 Blob·문구로 기준 버전과 변경 버전의 버튼·탭·갤러리만 따로 렌더링한
컴포넌트 화면입니다. 고정 네비게이션의 전체 캡처 영향을 피하기 위해 이 비교 화면에는
네비게이션을 포함하지 않았으며, 하단 여백은 위의 전체 화면 검증에서 별도로 확인했습니다.
사용자 사진을 편집하거나 실기기 캡처처럼 합성하지 않았습니다.

## 비교와 화면 캡처

| 비교                                             | 캡처                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 수정 전: 버튼/탭 간격 0px, 카드·날짜 위치 불일치 | [390px](screenshots/iphone-layout-fixes/gallery-before-comparison-390.jpg)                                                                                                                 |
| 수정 후: 16px 간격, 정사각 썸네일·정보 영역 정렬 | [390px](screenshots/iphone-layout-fixes/gallery-after-comparison-390.jpg)                                                                                                                  |
| 날짜 값 있음                                     | [320px](screenshots/iphone-layout-fixes/date-filled-320.jpg) · [390px](screenshots/iphone-layout-fixes/date-filled-390.jpg) · [402px](screenshots/iphone-layout-fixes/date-filled-402.jpg) |
| 날짜 값 없음                                     | [320px](screenshots/iphone-layout-fixes/date-empty-320.jpg) · [390px](screenshots/iphone-layout-fixes/date-empty-390.jpg) · [402px](screenshots/iphone-layout-fixes/date-empty-402.jpg)    |
| 사진 1개                                         | [320px](screenshots/iphone-layout-fixes/gallery-1-320.jpg) · [390px](screenshots/iphone-layout-fixes/gallery-1-390.jpg) · [402px](screenshots/iphone-layout-fixes/gallery-1-402.jpg)       |
| 사진 2개                                         | [320px](screenshots/iphone-layout-fixes/gallery-2-320.jpg) · [390px](screenshots/iphone-layout-fixes/gallery-2-390.jpg) · [402px](screenshots/iphone-layout-fixes/gallery-2-402.jpg)       |
| 사진 3개                                         | [320px](screenshots/iphone-layout-fixes/gallery-3-320.jpg) · [390px](screenshots/iphone-layout-fixes/gallery-3-390.jpg) · [402px](screenshots/iphone-layout-fixes/gallery-3-402.jpg)       |
| 사진 없음                                        | [402px](screenshots/iphone-layout-fixes/gallery-empty-402.jpg)                                                                                                                             |

## 보존 범위

최종 `npm run check`에서 타입·린트·포맷·전체 272개 테스트(28파일)·빌드가 통과했습니다.
PWA 셸·지연 청크·폰트·아이콘 30개 precache 검증도 통과했습니다.

데이터 계층·DB 스키마·사용자 데이터·사진 원본·백업·복원·PWA·서비스 워커는 변경하지 않았습니다.
`main`과 Production에도 변경하지 않았습니다. 검증 로그와 빌드 산출물은 커밋 대상이 아닙니다.

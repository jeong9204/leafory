# iPhone PWA 레이아웃 보정

작업일: 2026-10-27. 대상: iPhone 16 Pro(사용자 확인), iOS 버전 미확인.
앱 변경은 기능 추가 없는 CSS 3개 파일 보정입니다.
검토된 변경은 `test/iphone-pwa`에만 커밋·push하며 `main`과 Production 설정은 유지합니다.
배포 결과와 커밋 해시는 완료 보고에서 확인합니다.

## 변경 범위

- `src/pages/plant-detail.css`: 480px 미만은 사진 → 상태 설명 → 전체 폭 통계의 1열 배치.
  사진 높이는 180~220px 범위로 제한합니다. 480px 이상에서 사진·상태를 2열로 배치하고
  통계는 전체 폭을 사용합니다. 상태 배지는 13px, 통계 제목은 12px, 값은 15~16px로 표시합니다.
  통계 아이콘과 제목을 세로로 배치하고 값의 강제 한 줄을 해제해 긴 값도 겹치지 않게 했습니다.
  긴 식물 이름·설명도 줄바꿈합니다.
- `src/components/plants/scientific-name-suggestions.css`: 바깥 패딩 12→10px,
  후보 간격 8→6px, 후보 최소 높이 68→58px. 이름·학명·설명 펼치기 기능은 유지합니다.
  긴 이름은 고정 높이로 자르지 않고 늘어나며 설명 버튼은 최소 44px입니다.
- `src/pages/plant-management.css`: 추천 영역 다음 입력 라벨 여백 19→12px.
  상세와 편집·빠른 기록 페이지의 상단 패딩을 safe-area + 20px로 조정하고 좌우 inset도 고려했습니다.
  입력 글자 16px, 기존 하단 safe-area 여백과 폼 내 네비게이션 숨김은 유지했습니다.

React 동작·카탈로그·검색·Repository·Dexie·백업/복원·Manifest·서비스 워커는 변경하지 않았습니다.
기존 사용자의 기록·사진은 삭제하거나 초기화하지 않았습니다.

## 검은 원형 오버레이 원인

사용자가 알려준 [Preview](https://leafory-git-test-iphone-pwa-jeong9204s-projects.vercel.app/)를
Chrome에서 읽기 전용으로 확인했습니다. 실제 DOM에 다음 요소가 있으며 앱 소스에는 해당
라이브러리나 플로팅 버튼 구현이 없습니다.

- 외부 스크립트: `https://vercel.live/_next-live/feedback/feedback.js`
- 커스텀 요소: `VERCEL-LIVE-FEEDBACK`

검은 원형 메뉴 모양은 Vercel Toolbar의 기본 표시와 일치합니다. 앱 UI가 아닌 Vercel에서
주입하는 도구임을 확인했습니다. iPhone 화면 자체를 직접 검사한 것은 아니므로 기기에
별도 AssistiveTouch 등 다른 원형 버튼도 있다면 구분이 필요합니다.
[Preview에서 확인한 오버레이 캡처](screenshots/iphone-layout/vercel-toolbar-desktop.jpg).

앱 CSS로 외부 요소를 숨기거나 DOM을 제거하지 않았습니다. 테스트 환경에서 다음 방법을 사용하세요.

1. 해당 기기에서 Toolbar 메뉴를 열고 **Disable for Session**을 선택하면 현재 세션에서 숨길 수 있습니다.
   홈 화면 앱은 Safari 탭과 세션이 다를 수 있습니다.
2. 반복 테스트에는 Vercel 프로젝트의 Preview 환경 변수
   `VERCEL_PREVIEW_FEEDBACK_ENABLED=0`을 **`test/iphone-pwa` 브랜치에만** 설정하고
   그 설정이 적용된 Preview 배포를 사용합니다. 이번 확인에서 Config 값 `0`을 저장했고,
   저장 성공 화면에서 범위가 Preview의 `test/iphone-pwa`만인 것을 확인했습니다.
   Production·Development는 선택하지 않았습니다. 값 재조회는 추가 이메일 인증을 요구해
   진행하지 않았으며 새 배포에서 Toolbar 주입 여부를 별도로 확인합니다.
   [브랜치 설정 증빙](screenshots/iphone-layout/vercel-toolbar-branch-setting.jpg).
3. 대안은 Leafory 프로젝트 → Settings → General → Vercel Toolbar → Preview Off입니다.
   이는 다른 Preview에도 적용될 수 있으므로 브랜치 설정을 우선합니다. Production이나 팀 전체 설정은 바꾸지 않습니다.

이 설정은 Toolbar 표시 제어입니다. Deployment Protection/인증을 끄거나 보호 우회 토큰을
넣을 필요가 없습니다. 서비스 워커·사이트 데이터·IndexedDB를 삭제해 해결하지 않습니다.
근거: [Vercel Toolbar 표시 관리](https://vercel.com/docs/vercel-toolbar/managing-toolbar).

## 검증 결과와 한계

`npm run check`: 타입·린트·포맷·전체 272개 테스트(28파일)·빌드 통과.
PWA 빌드 검증의 precache 30개 항목도 통과했습니다.

브라우저 검증은 별도 `http://127.0.0.1:4186`에서 가상 식물 1개와 관리 기록 2개만 생성했습니다.
원래 localhost/Preview/iPhone 데이터에는 쓰거나 삭제하지 않았습니다. 검증용 데이터도 삭제하지 않았습니다.

| 화면/항목           | 확인 결과                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------- |
| 상세 320/390/402px  | 1열 배치, 가로 넘침 없음, 통계 값 넘침 없음                                              |
| 상세 512px          | 사진·상태 2열, 통계 전체 폭, 가로 넘침 없음                                              |
| 등록·수정 320/390px | 후보 2개와 직접 입력 표시 정상, 후보 높이 58px·설명 버튼 44px                            |
| 등록 402px          | 가로 넘침 없음                                                                           |
| 추천 동작           | 선택 시 입력, 설명 열기/닫기, 직접 수정 저장 확인. 미선택 저장은 기존 전체 테스트로 확인 |
| 빠른 기록 320/390px | 날짜·시간·식물등 시간/분·메모·저장 버튼 확인                                             |
| 데이터 표시         | 물주기 날짜·식물등 750분·총 2개 기록 표시, 가상 식물 수정 저장 확인                      |
| 하단 여백           | 상세 기본 100px(네비게이션 76px+24px), 폼 24px. 실제 inset은 여기에 추가                 |
| iPhone standalone   | **미검증**. 연결된 기기 제어가 없어 홈 화면 앱을 직접 실행/캡처하지 못함                 |

아래는 Chrome 실제 viewport 캡처이며 iOS/standalone 캡처가 아닙니다.
테스트 사진은 첨부하지 않아 대표 사진 플레이스홀더를 사용했습니다.
Chrome의 safe-area inset은 0으로, 실제 노치·상태바·홈 인디케이터·키보드 및 Safari 날짜
선택기 동작은 이 결과로 보장하지 않습니다.

| 화면      | 320px                                              | 390px                                              | 402px                                              |
| --------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| 상세      | [캡처](screenshots/iphone-layout/detail-320.jpg)   | [캡처](screenshots/iphone-layout/detail-390.jpg)   | [캡처](screenshots/iphone-layout/detail-402.jpg)   |
| 등록      | [캡처](screenshots/iphone-layout/register-320.jpg) | [캡처](screenshots/iphone-layout/register-390.jpg) | [캡처](screenshots/iphone-layout/register-402.jpg) |
| 수정      | [캡처](screenshots/iphone-layout/edit-320.jpg)     | [캡처](screenshots/iphone-layout/edit-390.jpg)     | —                                                  |
| 빠른 기록 | [캡처](screenshots/iphone-layout/care-320.jpg)     | [캡처](screenshots/iphone-layout/care-390.jpg)     | —                                                  |

## 하단 네비게이션 추가 검증

긴 화면에서 네비게이션이 타임라인 중간에 보인 것은 **전체 페이지 캡처의 표시 현상**입니다.
캡처는 문서 전체 높이를 이미지에 담지만 `position: fixed` 요소는 캡처 시점의 viewport
하단(390×844 기준 y=768~844)에 한 번 표시됩니다. 문서 끝으로 옮겨지는 요소가 아닙니다.
[동일 현상을 재현한 전체 캡처](screenshots/iphone-layout/nav-fullpage-390.jpg)와
실제 화면 크기의 [상단](screenshots/iphone-layout/nav-top-390.jpg)·
[중간](screenshots/iphone-layout/nav-middle-390.jpg)·
[끝](screenshots/iphone-layout/nav-bottom-390.jpg) 캡처를 구분해서 확인하세요.

별도 테스트 주소의 가상 메모만 길게 늘려 1,790px 문서를 만들었습니다.
390×844에서 스크롤 위치가 달라도 네비게이션은 `position: fixed`, 하단 y=844였습니다.
문서 끝에서 메모 하단은 약 y=744, 네비게이션 상단은 y=768로 약 24px 간격이 남습니다.
320×740에서도 메모 하단 약 y=640, 네비게이션 상단 y=664로 약 24px 간격을 확인했습니다.
마지막 기록은 스크롤로 네비게이션 위로 이동해 읽을 수 있으며 끝까지 접근할 수 없는 콘텐츠는 없습니다.
실제 레이아웃 결함이 확인되지 않아 하단 네비게이션 CSS는 추가 수정하지 않았습니다.

기존 앱 하단 여백은 `76px + env(safe-area-inset-bottom) + 24px`, 네비게이션 높이는
`76px + env(safe-area-inset-bottom)`입니다. 내부 하단 패딩에도 inset을 더하므로
홈 인디케이터 영역을 고려합니다. 다만 Chrome의 inset은 0이며 실제 iPhone의 홈 인디케이터,
OS 키보드·상태바 및 standalone 화면 검증은 계속 남아 있습니다. 기존 사용자 데이터는 초기화하지 않았습니다.

## iPhone 최종 재검증 순서

- [ ] iOS 버전, 정확한 Preview URL, 새 보정 빌드 커밋을 기록합니다.
- [ ] 사용자가 검토 후 승인한 보정이 같은 테스트 브랜치 Preview에 배포됐는지 확인합니다.
      현재 로컬 보정만으로 원격 iPhone 화면이 바뀌지는 않습니다.
- [ ] 온라인에서 기존 업데이트 안내를 통해 안전한 화면에서 새 버전을 적용합니다.
      작성 폼·백업 화면·다중 창 업데이트 보호를 우회하지 않습니다. 사이트 데이터 삭제는 하지 않습니다.
- [ ] Toolbar 숨김을 적용한 뒤 홈 화면에 설치된 Leafory 아이콘에서 실행합니다.
      Safari 탭 화면과 구분하고 필요시 iOS 멀티태스킹에서 종료 후 재실행합니다.
- [ ] 실제 대표 사진이 있는 상세에서 1열 배치·상태·설명·세 통계의 줄바꿈을 확인합니다.
      상태바 아래 20px 여백과 뒤로가기, 하단 네비게이션·홈 인디케이터 겹침을 확인합니다.
- [ ] 등록·수정의 복수 후보와 설명 펼치기, 직접 학명 입력 및 키보드가 열린 상태의
      저장 버튼 접근을 확인합니다. 사용자 기록 대신 가상 식물로 시험합니다.
- [ ] 빠른 기록의 날짜/시간·시간/분 입력을 네이티브 선택기에서 확인합니다.
- [ ] 상세·등록·수정·빠른 기록을 각각 홈 화면 앱에서 캡처하고 결과를 비교합니다.

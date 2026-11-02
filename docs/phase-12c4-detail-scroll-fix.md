# Phase 12C-4 — 식물 상세 POP 복귀와 레이아웃 준비

## 범위와 안전

- 브랜치 `test/iphone-pwa`, 기준/최종 HEAD `22db92669279934336cceb90d7fbc7c11bf6a8a4`.
- 시작 시 tracked/staged 변경 없음. 기존 미추적 검토 자료 보존.
- 로컬 구현·검사만 진행. 커밋·Push·배포·main·Production 변경 없음.
- Dexie/Repository/모델/사진 Blob/관리 기록/타이머 저장 정책/백업/PWA 정책 변경 없음.
- 실사용 브라우저 대신 새 localhost origin `127.0.0.1:4296`의 빈 DB를 확인한 뒤 합성 QA ZIP을 복원했다. 사진은 기존 공개 mock 에셋 `public/images/cactus.jpg`를 사용했다. 사용자 사진을 읽거나 변경하지 않았다.

## 확인된 원인과 확인하지 못한 부분

첨부 iPhone 캡처에는 큰 빈 영역이 있지만 scrollY·문서 높이·요소 rect 정보가 없다. 따라서 **그 캡처 자체가 잘못된 좌표인지, 정상 좌표에서 WebKit이 일부를 그리지 않은 것인지는 확정하지 못했다.** 데스크톱 Chromium에서는 동일한 큰 paint 공백을 재현하지 못했다.

반면 실제 BrowserRouter에서 다음 두 문제를 확인했다.

1. Phase 12C-3 전의 고정 식물 링크는 새 PUSH였지만 수정 후 정상 POP가 됐다. 식물 상세는 비동기 `loadPlant` 완료 전 짧은 `DataFeedback`을 반환하며, 자체 위치 복원이 없었다. 수정 전 390px에서 상세 약 2,243px 지점 → 일기 → 상단 버튼 복귀 결과 **0px**로 위치가 유실됐다. 당시 이미지들은 정상 디코딩됐고 대표 사진 높이도 약 202.8px로 정상이었다.
2. `loadPlant`가 끝나도 `LightTimerCard`는 별도 쿼리를 실행한다. 타이머 로딩 → 최종 카드 전환으로 실제 높이가 **143px** 증가했다. 이를 기다리지 않은 중간 구현에서는 타임라인이 143px 밀리거나, 사진 탭의 높이를 일찍 판단하여 669px를 526px로 잘못 보정했다. 최종 구현은 이 중첩 비동기 레이아웃까지 기다린다.

이는 확인된 스크롤/높이 복원 경합이며 iPhone의 paint 공백을 유발할 가능성이 있는 조건이다. **iOS 고유 paint 오류가 해결됐다고 아직 단정하지 않는다.** Blob 손상이나 이미지 오류를 원인으로 가정해 사진을 재생성하지 않았다.

## 수정 방식

- 식물 상세의 history entry에만 `scrollRestoration=manual`을 적용한다. 상세를 떠날 때 이동 대상의 기존 모드를 복원하여 기록/캘린더 등 다른 페이지의 기존 정책을 유지한다. 전역에서 모든 라우트를 manual로 바꾸지 않는다. 스크롤 복원 모드가 현재 history entry에 적용되는 근거는 [HTML History 표준](https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-history-scroll-restoration), auto/manual 의미는 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration)을 참고했다.
- 같은 history key와 내부 URL의 scrollY·선택 탭·원래 복원 모드만 메모리/sessionStorage에 저장한다. 최대 40개, 기록 본문/사진/Blob 없음. 저장소 제한 시 메모리로 동작한다.
- 내부 링크의 capture 단계에서 실제 이탈 직전 위치를 저장한다. unmount 시 이미 짧아진 DOM의 0px로 덮어쓰지 않는다. 네이티브 이탈에는 마지막으로 관측한 위치를 사용한다.
- POP/새로고침 복귀 시 부모 데이터 완료와 `data-layout-pending` 해제를 확인한다. 타이머 카드에 추가한 것은 로딩 여부를 알리는 data attribute 한 줄뿐이다. 타이머 로직·기록·버튼·외관은 그대로다.
- 준비되면 두 animation frame 뒤에 레이아웃을 측정하고 `min(savedY, scrollHeight - viewportHeight)`로 한 번 복원한다. 유효한 위치는 유지하고 짧아진 페이지의 범위 초과만 보정한다. 모든 복귀를 0으로 초기화하지 않는다.
- 사용자 touch/wheel/pointer/key 입력이 시작되면 예약 복원을 취소한다. 폴링/무한 재시도/transform·opacity·강제 1px 왕복 repaint 편법은 추가하지 않았다.
- `pagehide` 저장과 persisted `pageshow` 복원을 처리한다. 사진 탭도 복원해 다른 탭의 높이로 보정하지 않는다.
- 새 관리 hash 진입은 기존 앵커 포커스·scrollIntoView를 유지한다. 이미 저장한 상세 entry로 복귀할 때만 앵커 재스크롤과 좌표 복원이 경쟁하지 않도록 한다.
- 대표·일기 사진은 기존 고정 높이/aspect-ratio를 유지한다. 디코딩 전에 공간이 예약되므로 Blob decode를 기다리느라 화면을 막거나 원본을 변환하지 않는다. 이미지 load 후 같은 위치를 반복 강제하지 않는다.

## 변경 파일

| 파일                                              | 변경                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/hooks/usePlantDetailScroll.ts`               | 식물 상세 전용 위치 저장, native 복원 조율, 비동기 레이아웃 대기·범위 보정 |
| `src/lib/plant-detail-position.ts`                | bounded UI 위치 메타데이터 저장/검증                                       |
| `src/hooks/usePlantDetailScroll.test.tsx`         | 신규 회귀 시나리오 13개                                                    |
| `src/pages/PlantDetailPage.tsx`                   | hook·루트 capture 연결                                                     |
| `src/components/plant-detail/PlantRecordTabs.tsx` | 복귀 탭과 앵커 경쟁 방지                                                   |
| `src/components/timer/LightTimerCard.tsx`         | 초기 레이아웃 로딩 표식만 추가                                             |
| 이 문서 및 `docs/screenshots/phase-12c4/`         | 측정·캡처                                                                  |

CSS·색상·간격·에셋·하단 메뉴·Safe Area 계산식 변경 없음. 기존 Phase 12C-3 미추적 QA JSON 한 파일은 전체 포맷 검사 경고를 해결하기 위해 값은 그대로 두고 서식만 정리했다. 원본도 `/private/tmp/leafory-12c3-qa-original.json`에 보관했다.

## 수정 전후 측정

기본 390×844 viewport, 같은 합성 데이터에서 측정했다. `before-return-390.jpg`는 데스크톱에서 실제 재현한 **위치 유실**이며 사용자의 iPhone 공백 현상을 재현한 이미지가 아니다.

| 조건                                      | 출발 scrollY | 복귀 scrollY | 결과                                    |
| ----------------------------------------- | -----------: | -----------: | --------------------------------------- |
| 수정 전 사진 있는 상세 → 일기 → 화면 버튼 |     약 2,243 |            0 | 위치 유실                               |
| 최종 타임라인 → 일기 → 브라우저 back      |        2,243 |        2,243 | 유지                                    |
| 최종 일기 새로고침 → 화면 버튼            |        2,243 |        2,243 | 유지                                    |
| 최종 사진 탭 → 일기 → 화면 버튼           |          669 |          669 | 탭·위치 유지                            |
| 사진 없는 식물 하단 → 일기 → 복귀         |   약 3,325.5 |     약 3,325 | 반 픽셀 범위 반올림/문서 최대값 내 유지 |
| 320px 사진 탭 → 브라우저 back             |          592 |          592 | 유지                                    |
| 402px 사진 탭 → 화면 버튼                 |     약 652.5 |       약 652 | 문서 최대값 내 유지                     |
| 기록 36개 더 보기 → 일기 → 화면 버튼      |        2,054 |        2,054 | 기존 목록 복원 유지                     |

자동화의 locator.click은 먼저 링크를 화면 안으로 이동시키므로, 출발 좌표 비교에는 포커스 후 현재 요소에 native Return 키를 보내 불필요한 추가 스크롤을 피했다. 마우스/화면 버튼과 브라우저 back도 따로 확인했다.

390px에서 문서 높이 3,973px, 대표 이미지 약 202.8px, 사진 탭 문서 높이 1,513px가 복귀 전후 동일했다. 320px에서 메모 하단 744.2px, 고정 내비게이션 상단 768px로 약 24px 여유를 확인했다. 관측된 이미지 오류/앱 콘솔 error 0, 가로 overflow 없음.

`measurements.json`에는 중간 조사 단계도 포함한다. 최종 판정에는 `settled-*`, `320-return`, `402-return`을 사용한다. 중간 구현의 잘못된 clamp 측정치를 성공 결과로 포함하지 않았다.

## 자동 검사

Node 24.22.2 / npm 11.19.1에서 `npm run check` 통과: TypeScript, ESLint, Prettier, **45파일/486개 Vitest**(기존 473개 + 신규 13개), production build, PWA 검사 모두 통과. `git diff --check`도 통과했다. precache **72개/3,184,363B**, refined **21개**, painted WebP precache **0개**. CSS 산출물 해시는 기존과 같고 JS 코드/해시만 바뀌었다.

신규 테스트: 화면 화살표/Router POP, 지연 부모 조회, 지연 타이머 초기 높이, 상단0/중간900/하단2800, 콘텐츠 축소 시 clamp, 직접 접속 미초기화, 사진 탭·지연 image load, 사용자 스크롤 우선, pagehide/pageshow, 세션 메타데이터 복원, 스크롤 없는 페이지의 범위 처리.

기존 기록 페이지·관리 hash·식물/사진/타이머/백업 회귀 테스트는 삭제하지 않았다.

## iPhone에서 남은 검증

- 이번 환경에서는 실제 iPhone Safari/PWA compositor와 스와이프 제스처를 실행할 수 없다. 원본 캡처의 paint-only 공백 여부는 실기기 미확정이다.
- 320/390/402px는 실제 Chromium viewport 측정이다. iOS 상태바/홈 인디케이터의 실제 safe-area 값, 키보드, 탄성 스크롤은 별도 확인이 필요하다.
- 느린 데이터·타이머 완료·image load 순서는 단위 테스트로 검증했다. 큰 사진의 실제 iOS 지연 디코딩은 미검증이다.
- Preview 배포는 하지 않았다. 승인 후 같은 iPhone에서 일기 진입 전 위치를 기억하고 화면 버튼/스와이프 각각, 사진 탭/타임라인, 사진 유무, 일기 새로고침 후 복귀를 반복해야 한다.
- 같은 빈 영역이 남으면 당시 scrollY·document 높이·summary rect·visualViewport를 함께 기록해 유효 좌표에서의 paint 문제인지 구분해야 한다. 이번에는 사용자 화면에 디버그 UI를 추가하지 않았다.

# Phase 11 — PWA 정적 에셋 캐시 최적화

## 정책과 변경 파일

자체 Vite 플러그인 `leafory-pwa-shell`이 빌드 번들과 public 전체를 순회해 precache URL/내용 해시를 생성한다.
이 때문에 사용하지 않는 painted 원본도 자동 포함됐다. Workbox/vite-plugin-pwa는 사용하지 않는다.

public 상대 경로 `^pixel/painted/[^/]+\.webp$`만 precache와 버전 해시 입력에서 제외한다.
파일 삭제나 URL 제거는 아니다. 원본 20종은 public/dist에 남고 온라인 접근·롤백을 유지한다.
refined 21종, wood.svg, README, Manifest, 아이콘, JS/CSS/폰트, 다른 폴더/중첩 경로는 제외하지 않는다.

수정 파일은 `build/pwa-plugin.ts`, 신규 `build/pwa-plugin.test.ts`, `scripts/verify-pwa-build.mjs` 및 이 문서다.
앱 디자인·DB/Repository·백업 형식·서비스 워커 런타임·업데이트 UI는 변경하지 않았다.

## 기존 20종 참조 조사

정적 import/URL 검색 외에 동적 pixelAsset 매핑·CSS·fixture·Manifest/빌드·검토 페이지·ZIP 데이터 흐름을 조사했다.
현재 매핑은 refined 21종, unknown은 기존 SVG로 연결된다. 배포 JS/CSS와 실제 홈의 이미지 요청,
refined 21종 전체의 서비스 워커 오프라인 응답으로 확인했다. '없음'은 현재 앱 기준이며 역사적 사용까지 부정하지 않는다.

| 파일                        | 실제 앱 사용 | 테스트 사용      | 문서 사용      | 처리                          |
| --------------------------- | ------------ | ---------------- | -------------- | ----------------------------- |
| `painted/adenium.webp`      | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/books.webp`        | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/cactus.webp`       | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/can.webp`          | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/cat.webp`          | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/default.webp`      | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/evergreen.webp`    | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/frame.webp`        | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/globe.webp`        | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/house.webp`        | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/ivy.webp`          | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/lamp.webp`         | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/lantern.webp`      | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/monstera.webp`     | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/philodendron.webp` | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/rosemary.webp`     | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/snake.webp`        | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/spray.webp`        | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/succulent.webp`    | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |
| `painted/trailing.webp`     | 없음         | 보존 목록 검사만 | 로컬 비교 자료 | 원본·URL 유지 / precache 제외 |

검토용 design/review의 old/v1 모드는 원본을 동적으로 사용하므로 로컬 비교 자료와 public 원본을 보존한다.
이 페이지들은 배포 엔트리가 아니다. 새 보존 목록 테스트는 원본 파일 이름만 열거한다.
Manifest는 원본을 직접 참조하지 않으며 public 전체 순회만 자동 포함의 원인이었다.
ZIP v1은 사용자 모델과 사진 Blob을 저장하고 고정 픽셀 화분 파일에 의존하지 않는다.

## 원본 보존과 복구

[에셋 무결성 목록](phase-11-pwa-asset-optimization/asset-integrity.json)에 원본 20종 및 refined 21종의
경로·용량·SHA-256을 기록했다. 이미지 바이트는 변경하지 않았다. 원본 URL 20개는 격리 HTTP 서버에서
모두 200(총 3,900,178B)으로 제공됨을 확인했다.

다음 프로젝트 외부 ZIP도 실제로 열어 CRC와 원본 20개 전체 바이트 일치를 확인했다.

- `leafory-phase11-before-refinement.zip`: SHA-256 `ffef3d4abbe556690b9a6c22bad1e945aedcff5596e4e1fd84e8b4a1c92c7c52`.
- `leafory-pixel-assets-review.zip`: SHA-256 `e2c7dcdea526ea9cd869588368baca728ba5dfa6bf106fcbadd25c320d5ea786`.

ZIP과 로컬 절대 경로는 업로드하지 않는다. 원본은 public 경로로 버전 관리하므로 Git 또는 보관 ZIP에서
별도 임시 디렉터리로 꺼낸 뒤 SHA-256을 비교할 수 있다. 복구 시 현재 파일을 강제로 덮어쓰지 말고
검증과 별도 승인 후 필요한 파일만 복사한다. 현재 원본은 있으므로 복구 자체는 실행하지 않았다.

## 성능 수치

순수 캐시 최적화 단계의 동일 소스 빌드 비교:

| 항목                             |         변경 전 |      변경 후 |
| -------------------------------- | --------------: | -----------: |
| precache 항목 수                 |              90 |           70 |
| precache 본문 합계               |      7,059,103B |   3,158,925B |
| painted WebP precache            | 20 / 3,900,178B |            0 |
| refined WebP precache            |    21 / 22,220B | 21 / 22,220B |
| cold 홈 이미지 본문(파비콘 포함) |    17 / 16,619B | 17 / 16,619B |
| 그중 홈 pixel 자원               |    16 / 16,159B | 16 / 16,159B |

3,900,178B(55.25%) 절감이다. [비교 원자료](phase-11-pwa-asset-optimization/build-comparison.json)는 이 단계의 수치다.
최종 배포 자료 정리로 CSS 해시/용량이 달라질 수 있으므로 실제 배포의 총량은 최종 빌드 결과를 기준으로 한다.

최종 커밋 준비 빌드는 70개 / 3,156,994B이며 refined 21종 포함·painted WebP 20종 제외를 확인했다.
검토 폴더를 Git에서 제외하면서 Tailwind의 검토 페이지 전용 미사용 유틸리티가 빠져 순수 최적화 단계보다
1,931B 작아졌다. 앱의 CSS 소스와 승인된 레이아웃을 추가로 수정하지 않았다.

초기 이미지는 독립된 두 origin, 같은 엔진·390×844·식물 6종 합성 데이터·스크롤 없음 조건에서
서버 image 요청의 응답 본문을 측정했다. HTTP 헤더/TLS 비용은 제외한다. 경로/용량은 같았고 이미지 실패는 없었다.
홈은 최적화 전부터 refined를 사용했으므로 이번 절감은 PWA 설치/갱신 시 보관 원본 다운로드·저장 부담이다.
LCP는 실기기 조건에서 미측정이며 체감 속도 향상은 단정하지 않는다.

## 업데이트와 데이터 안전

기존 SW 동작을 유지한다.

- 새 버전 전용 셸 캐시에 설치하며 자동 skipWaiting하지 않는다.
- 설치 실패 시 새 버전만 정리하고 이전 활성 버전은 유지한다.
- 작성 중 업데이트 제한과 여러 창의 UPDATE_BLOCKED 정책을 유지한다.
- 명시적 활성화 후 이전 Leafory 셸 캐시만 정리한다. IndexedDB에는 접근하지 않는다.
- 정적 허용 경로의 같은 origin GET만 cache-first. API/Blob/ZIP/사용자 데이터 runtime cache는 없다.
- 중첩 navigation은 캐시된 index.html로 앱 셸을 제공한다.

기존 설치 앱은 이전 SW가 활성화된 동안 이전 캐시를 사용하고 새 버전은 별도 설치·대기한다.
Manifest id/start_url/scope를 유지해 재설치를 요구하지 않는다. 새 버전에서는 보관 원본의 오프라인 접근을
보장하지 않지만 현재 앱은 요청하지 않는다. 설치 중 old+new 본문 약 10.22MB가 잠시 공존할 수 있다.
실제 메타데이터·사용자 DB·HTTP 캐시는 별도다. unregister/clear site data/전체 스토리지 초기화는 사용하지 않았다.

## 검증

타입·린트·포맷·417개 테스트·Production build·PWA 검증이 모두 통과했다.
에셋 테스트는 승인 SHA-256 fixture를 사용하므로 제외한 design 폴더 없이 새 체크아웃에서도 실행된다.
빌드 검사는 원본 파일 보존/캐시 제외, refined 21종 포함, 배포 JS/CSS의 원본 경로 오사용,
중복 URL 및 필수 셸·지연 청크·폰트·아이콘을 검증한다.

실제 사용자/Preview 저장소와 분리된 localhost origin에서 기존 Repository로 합성 식물 6·일기 1·사진 1·
CareEvent 7·실행 중 타이머 1을 생성했다. 사진은 공개 아이콘이며 개인 사진은 사용하지 않았다.
시험한 이전 90항목 SW는 최적화 전 현재 Phase 11 빌드이고 과거 Vercel 배포본 자체는 아니다.

- 새 SW 다운로드/대기 → 다중 창 차단 → 단일 창 명시 활성화.
- 최종 캐시가 70항목 새 셸 하나임을 확인.
- 네트워크 503 조건에서 refined 21개 모두 200/22,220B.
- 홈 새로고침/재실행 및 미방문 상세·사진 일기·캘린더 lazy 경로 로딩.
- 전후 전체 snapshot 메타데이터, 사진 Blob SHA-256 및 타이머 세션 필드 동일.

503 시험은 실제 비행기 모드가 아니므로 navigator.onLine 안내·iOS standalone·기기 저장 공간은 별도 확인 대상이다.
합성 DB, raw QA 로그, 대용량 캡처, 임시 서버/빌드, 검토 ZIP/원화는 커밋하지 않는다.

## Preview 및 iPhone 순서

1. 테스트 브랜치 최종 커밋의 Preview Ready/Source와 고정 URL을 확인한다.
2. 배포 sw.js의 refined 포함/painted 제외와 이미지 21개 HTTP 200을 확인한다.
3. iPhone 기존 설치 앱을 온라인으로 열어 기록을 보존한 채 업데이트한다.
4. 앱 종료 → 비행기 모드 → 재실행 → 홈/상세/일기/캘린더 확인.
5. 기존 사진 Blob·실행 중 타이머 복구와 작성 중/다중 창 업데이트 제한 확인.
6. ZIP 백업은 권장하되 실제 데이터를 교체/삭제하는 테스트는 하지 않는다.

원본 삭제·구 SVG/샘플 JPG/README 추가 캐시 제외는 이번 범위가 아니다.
남은 최대 정적 항목은 Pretendard Variable 폰트 약 2.06MB이며 추가 최적화는 별도 승인 후 검토한다.

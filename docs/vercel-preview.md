# Leafory Vercel Preview 준비 및 실기기 검증

확인일: 2026-10-27. 대상 저장소: `jeong9204/leafory`.
이 문서는 배포 준비 결과입니다. Vercel 프로젝트 생성·Git 연결·배포·보호 설정 변경은 실행하지 않았습니다.
대시보드 접근은 로그인 화면으로 연결됐으며 인증을 진행하지 않았습니다.

## 현재 확인 상태

| 항목                              | 상태                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| Vite 빌드·PWA 산출물              | 로컬 검증 완료                                                      |
| Vercel 설정                       | `vercel.json` 작성, 공식 스키마의 사용 필드 범위 검증 완료          |
| SPA 라우팅·캐시 설정              | 설정 계약 테스트 완료. 실제 CDN 응답은 배포 후 확인 필요            |
| Manifest 인증 요청                | 같은 출처 인증 쿠키를 보내도록 `crossorigin="use-credentials"` 적용 |
| 실제 Vercel 프로젝트·팀·접근 보호 | 로그인 필요, 미확인                                                 |
| Preview URL·HTTPS·설치·오프라인   | 배포 및 실기기 확인 전                                              |

UI, Repository, DB 스키마 및 서비스 워커의 캐시·업데이트 보호 정책은 변경하지 않았습니다.
기존 IndexedDB를 읽거나 초기화하지 않았습니다.

## 사용자 설정과 Preview 생성 순서

1. 사용할 Vercel 계정·팀과 기존 Leafory 프로젝트 유무를 확인합니다. GitHub 권한은
   `jeong9204/leafory`에 필요한 범위만 승인합니다. 프로젝트 연결·외부 배포는 사용자 승인 후 진행합니다.
2. **처음 Import한 뒤 기본 `main`으로 Deploy를 누르면 Production 배포가 될 수 있습니다.**
   초기 연결 흐름이 자동 Production 배포를 요구하면 중단하고 Preview 대상으로 실행할 수 있는
   설정·절차를 먼저 확인합니다. 기존 프로젝트의 Production 브랜치나 자동 배포 정책도 임의로 바꾸지 않습니다.
3. 테스트 전용 브랜치는 `main`에서 생성한 `test/iphone-pwa`를 사용합니다.
   이 브랜치의 GitHub push는 사용자 승인 범위이며 Vercel 프로젝트 연결·배포는 별도 확인 대상입니다.
   기존 프로젝트라면 Production Branch가
   `main`인지 확인하고 전용 브랜치 배포의 Environment가 **Preview**인지 확인합니다.
   브랜치 push만으로도 자동 배포가 생길 수 있으므로 보호 설정과 승인 범위를 먼저 확인합니다.
4. Preview 대상 Deployment Protection과 허용된 테스트 계정을 확인합니다.
   보호가 켜졌는지 이름만 확인하지 말고 로그인하지 않은 별도 브라우저에서 앱 접근이 차단되는지 확인합니다.
   접근 보호 해제, 공개 링크 전환, 우회 토큰 생성은 이 준비 작업에 포함되지 않습니다.
5. 아래 빌드 설정으로 Preview를 생성합니다. `--prod`, Production 승격, 배포를 위한 `main` 병합은 하지 않습니다.
6. 배포 상세의 Environment가 Preview인지, HTTPS 인증서가 정상인지, 해당 브랜치 URL인지 다시 확인합니다.
   실제 URL은 배포 후 문서의 결과 표에 기록합니다. 아직 생성된 URL은 없습니다.

| 설정             | 값                                                |
| ---------------- | ------------------------------------------------- |
| Framework Preset | Vite                                              |
| Root Directory   | 저장소 루트 (`.`)                                 |
| Install Command  | `npm ci`                                          |
| Build Command    | `npm run build`                                   |
| Output Directory | `dist`                                            |
| 배포 경로        | 도메인 루트 `/` (하위 경로 배포 아님)             |
| 환경 변수        | 현재 불필요. 로컬 인증서·개인키를 업로드하지 않음 |

현재 `engines.node`는 `>=22.12.0`입니다. Vercel의 지원 버전 선택 규칙에 따라 24.x가
선택될 수 있으므로 대시보드 표시와 실제 빌드 로그를 함께 확인합니다. 로컬 Node 22.22.0과
24.22.1에서 빌드를 확인했습니다. Node 버전 범위나 의존성은 변경하지 않았습니다.
`LEAFORY_HTTPS_CERT/KEY`는 로컬 서버용이며 Vercel에는 설정하지 않습니다.
`VITE_` 값은 클라이언트에 공개되므로 인증 정보나 보호 우회 비밀값을 넣지 않습니다.

## 고정 Preview 주소와 데이터 분리

개별 배포 URL 대신 **브랜치 URL**을 즐겨찾기와 설치에 계속 사용합니다.
Vercel의 일반적인 형식은 `<project>-git-<branch>-<scope>.vercel.app`이며 실제 생성된 주소를
대시보드에서 복사합니다. 이 형식을 보고 주소를 추측해 사용하지 않습니다.
같은 브랜치 URL은 새 빌드를 가리킬 수 있지만 개별 배포 URL은 빌드마다 달라집니다.

IndexedDB는 origin(프로토콜·호스트·포트), 브라우저 프로필 및 기기에 묶입니다.
`localhost`, 브랜치 URL, 개별 배포 URL은 서로 다른 저장 공간입니다. 빈 목록은 기존 데이터
삭제를 의미하지 않습니다. iOS 홈 화면 앱도 Safari 탭과 저장 공간·인증 세션이 다를 수 있습니다.
테스트 기기마다 설치한 정확한 주소를 기록하세요.

- 기존 실제 기록은 원래 주소에서 ZIP으로 백업하고 파일 앱에서 보관을 확인합니다.
- Preview에는 가상 식물 이름과 합성 사진 등 테스트 데이터만 만듭니다. 실제 사용자 ZIP을
  편의상 가져오지 않습니다. 배포가 사진·기록의 클라우드 저장이나 기기 간 동기화를 제공하지는 않습니다.
- 전체 교체 복원은 테스트 origin과 교체 대상 건수를 확인한 뒤 그 환경에서만 시험합니다.
- 사이트 데이터 전체 삭제·IndexedDB 초기화로 테스트를 준비하지 않습니다. 테스트 종료 후에도
  기록은 자동 삭제하지 않으며, 보관과 정리는 사용자가 결정합니다.

## 라우팅·Manifest·서비스 워커 응답 확인

루트의 `vercel.json`은 `/plants/...`, `/calendar`, `/records`, `/backup`, `/install`만
SPA HTML로 연결합니다. `/plants/:id/diary/:entryId/edit` 등 중첩 경로의 직접 접근과
새로고침을 확인합니다. 모든 URL을 HTML로 바꾸는 catch-all을 쓰지 않으므로 누락된
`/assets/missing.js`, `/sw.js` 등의 요청을 HTML로 숨기지 않습니다.
목록 밖의 잘못된 URL은 호스팅 404가 될 수 있습니다.

최초 온라인 확인에는 캐시가 없는 별도 테스트 프로필을 사용해 기존 SW 응답이 인증 문제를
가리지 않도록 합니다. 기존 사용자 프로필의 저장소를 지우지 않습니다. 브라우저 Network 또는
원격 디버깅으로 다음을 확인하세요.

| 경로                                                     | 기대 결과                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/`, `/index.html`, 앱 중첩 경로                         | 앱 HTML, 로그인 HTML과 구분, HTML 재검증 헤더 확인                        |
| `/sw.js`                                                 | 200, JavaScript MIME, `Cache-Control: no-cache`, 로그인 리다이렉트 없음   |
| `/manifest.webmanifest`                                  | 200, Manifest JSON MIME, `no-cache`, Leafory 이름·`standalone`·루트 scope |
| `/icons/icon-192.png`, `/icons/icon-512.png`             | 실제 크기의 PNG                                                           |
| `/icons/maskable-512.png`, `/icons/apple-touch-icon.png` | maskable 512px / Apple 180px PNG                                          |
| `/assets/*`                                              | 실제 JS·CSS·로컬 폰트, 해시 파일 장기 immutable 캐시                      |
| 없는 정적 파일                                           | 404, SPA HTML로 대체되지 않음                                             |

현재 빌드 검증은 셸·지연 청크·폰트·아이콘 등 30개 precache 항목의 존재를 확인합니다.
서비스 워커는 앱에 포함된 파일만 캐시하며 사용자 사진 Blob·ZIP·IndexedDB를 SW 캐시로
옮기지 않습니다. 실제 CDN 헤더와 보호 로그인 응답은 로컬 테스트만으로 보장할 수 없습니다.

## 접근 보호와 PWA의 제약

인증이 필요한 Manifest는 같은 출처여도 `crossorigin="use-credentials"`가 필요합니다.
이번 변경은 현재 출처의 인증 세션을 사용하는 호환성 보완이며 인증 우회가 아닙니다.
그러나 이 속성만으로 모바일 설치 호환성이 보장되지는 않습니다.

- Safari/Chrome에서 로그인돼 있어도 홈 화면 앱이나 OS 설치 과정의 요청은 다른 세션일 수 있습니다.
  설치 과정의 아이콘·Manifest 요청과 `/sw.js`·precache 파일 요청이 로그인 페이지로
  리다이렉트되면 설치·초기 캐시·업데이트가 실패할 수 있습니다. 실제 기기에서 확인해야 합니다.
- 보호 페이지를 캐시에 넣거나 우회 토큰을 URL·Manifest·클라이언트 코드에 넣어 해결하지 않습니다.
  서비스 워커의 허용 경로·업데이트 보호도 완화하지 않습니다.
- 실패하면 해당 기기의 설치/오프라인 검증을 미통과로 기록합니다. 접근 보호를 끄지 말고
  인증 환경을 검토하거나 사용자 승인 아래 [LAN HTTPS 테스트](mobile-testing.md)를 사용합니다.
- **접근 보호는 서버 요청을 제한합니다. 이미 기기에 캐시된 앱 셸과 IndexedDB를
  원격으로 잠그거나 삭제하지 않습니다.** 로그아웃·권한 회수 후에도 저장된 앱과 기록이
  오프라인에서 보일 수 있습니다. 기기 잠금·로컬 데이터 보호를 대체하는 앱 로그인 기능이 아닙니다.

최초 온라인 접속과 필요한 파일 캐시가 필요합니다. OS의 저장 공간 회수, 캐시 미완료,
인증 만료 후 새 버전 다운로드 실패 등의 경우 오프라인 실행을 보장하지 않습니다.
새 버전과 외부 출처 확인은 네트워크가 필요합니다.

## 배포 후 실제 휴대폰 시험 순서

iPhone Safari와 Android Chrome에서 각각 수행하고 OS·브라우저 버전·날짜·정확한 URL을 기록합니다.

1. 사용자 승인으로 만든 보호된 Preview에 온라인 접속하고 인증합니다. 위 응답 표와 직접 경로
   새로고침을 확인합니다. 개인 기록이 없는 테스트 저장 공간인지 확인합니다.
2. iOS Safari 공유 메뉴에서 ‘홈 화면에 추가’와 ‘웹 앱으로 열기’(표시되는 경우)를 선택합니다.
   Android Chrome 메뉴에서 ‘앱 설치/홈 화면에 추가’를 사용합니다. 아이콘·앱 이름과
   standalone 실행을 확인합니다. 홈 화면 앱에 별도 인증이 필요하거나 설치가 막히면 결과를 기록합니다.
3. 홈 화면 앱에서 가상 식물·대표 사진·다중 사진 일기·물주기·식물등 기록을 만듭니다.
   사진 촬영/갤러리, 권한 취소, 키보드, 날짜 선택, 320px/390px 상당 폭을 확인합니다.
4. 온라인 캐시 준비 후 새로고침·앱 종료/재실행으로 데이터 유지를 확인합니다.
   비행기 모드로 전환하고 앱을 완전히 닫았다가 다시 엽니다. 처음 여는 편집·일기·캘린더·백업
   화면도 로드되는지 확인하고 오프라인에서 가상 기록을 저장합니다.
5. 오프라인에서도 ZIP 내보내기를 시도하고 iOS 파일 앱/Android 다운로드에서 실제 파일을 확인합니다.
   테스트 데이터만 있는 같은 환경에서 백업을 검증하고, 전체 교체 경고와 건수를 읽은 뒤 복원합니다.
   사진·연결 관계·통계를 확인하고 재실행합니다. 실패·취소 시 기존 테스트 기록 유지도 확인합니다.
6. 다시 온라인으로 전환합니다. 승인된 Preview 브랜치의 다음 빌드가 같은 브랜치 URL로 갱신됐을 때
   작성 폼·백업 화면·다중 창에서 업데이트가 차단되는지 확인합니다. 안전한 화면으로 나온 후
   다른 창을 닫고 업데이트를 적용해 기록 보존을 확인합니다. 테스트용 새 배포도 별도 승인 범위에서 진행합니다.

| 환경           | 고정 Preview URL | 보호/리소스 응답 | 설치/standalone | 오프라인/재실행 | 사진/ZIP/업데이트 |
| -------------- | ---------------- | ---------------- | --------------- | --------------- | ----------------- |
| iOS Safari     | 미생성           | 미확인           | 미실행          | 미실행          | 미실행            |
| Android Chrome | 미생성           | 미확인           | 미실행          | 미실행          | 미실행            |

## 로컬 검증과 근거

`npm run check`로 타입·린트·포맷·272개 테스트(28파일)·빌드가 통과했습니다.
추가된 설정 계약 테스트는 Vercel 실행 엔진을 흉내 내는 테스트가 아니며 실제 배포 검증을
대체하지 않습니다. Vercel CLI 설치·계정 인증·프로젝트 연결·배포는 수행하지 않았습니다.
배포 준비 변경사항은 사용자 요청에 따라 `test/iphone-pwa`에서 커밋·push 대상으로 정리합니다.
`main`에는 반영하지 않습니다.

- [Vercel Vite/SPA](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel 설정](https://vercel.com/docs/project-configuration/vercel-json)
- [Preview 환경](https://vercel.com/docs/deployments/environments)
- [브랜치·배포 URL](https://vercel.com/docs/deployments/generated-urls)
- [접근 보호](https://vercel.com/docs/deployment-protection)
- [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
- [Node 버전 선택](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [MDN 인증 Manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/index.html)
- [WebKit 홈 화면 앱과 저장 공간](https://webkit.org/tracking-prevention/)
- [Apple 홈 화면 설치](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)

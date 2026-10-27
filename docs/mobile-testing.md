# Leafory 모바일 실기기 테스트 준비

작성·자료 확인: 2026-10-27. 아래 실기기 항목은 아직 미실행이며 준비용 체크리스트입니다.
자동 테스트/데스크톱 viewport 검증과 실제 iPhone·Android 설치 결과를 구분해서 기록하세요.

## 같은 Wi-Fi에서 UI 확인

PC와 휴대폰을 같은 신뢰할 수 있는 Wi-Fi에 연결합니다. PC의 네트워크 설정에서 Wi-Fi의
IPv4 주소를 확인하세요. 예시 `192.168.0.10`은 실제 주소로 바꿉니다.

```sh
npm ci
npm run dev:lan -- --port 5173 --strictPort
```

휴대폰에서 `http://192.168.0.10:5173`으로 접속합니다. 방화벽은 이 테스트에 필요한
개발 서버의 로컬 네트워크 접근만 허용하고, 공유기의 기기 간 격리 설정을 확인합니다.
인터넷에 포트를 공개할 필요는 없습니다.

이 HTTP 주소는 UI·입력 테스트용입니다. 휴대폰에서 PC IP는 `localhost` 예외가 아니므로
서비스 워커/설치 오프라인 검증에는 적합하지 않습니다. 개발 모드에서는 서비스 워커를
등록하지 않습니다. PWA는 아래의 프로덕션 빌드와 HTTPS 환경에서 확인하세요.

## 프로덕션 PWA와 HTTPS

PC 내부 확인은 다음처럼 전용 포트에서 실행할 수 있습니다.

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
```

PC의 `http://127.0.0.1:4174`는 로컬 보안 컨텍스트 예외로 SW를 검증할 수 있지만,
휴대폰의 `http://192.168.0.10:4174`는 해당하지 않습니다.

휴대폰은 브라우저가 신뢰하는 인증서의 HTTPS가 필요합니다. 승인된 테스트용 HTTPS
호스팅에서 `dist/`를 제공하거나, 본인이 관리하는 로컬 CA로 아래처럼 실행할 수 있습니다.
테스트 배포·터널 생성·인증서 설치·기기 신뢰 설정은 이번 작업에서 실행하지 않았습니다.

로컬 CA 방식 예시(선택 사항): 공식 [mkcert](https://github.com/FiloSottile/mkcert)를 준비한 뒤
PC/휴대폰에서 해당 테스트 CA를 신뢰하도록 직접 설정합니다. 테스트 CA 신뢰는 기기의
보안 설정 변경이므로 본인이 만든 CA임을 확인하고 선택하세요. 브라우저 경고를 우회하지 않습니다.

```sh
mkdir -p "$HOME/.leafory-certs"
mkcert -install
mkcert -cert-file "$HOME/.leafory-certs/leafory.pem" -key-file "$HOME/.leafory-certs/leafory-key.pem" localhost 127.0.0.1 192.168.0.10
LEAFORY_HTTPS_CERT="$HOME/.leafory-certs/leafory.pem" LEAFORY_HTTPS_KEY="$HOME/.leafory-certs/leafory-key.pem" npm run preview:lan -- --port 4174 --strictPort
```

휴대폰에서 `https://192.168.0.10:4174`를 엽니다. CA의 **공개 인증서만** 기기로 옮기고
서버 개인키나 CA 개인키는 공유하지 마세요. iOS는 프로파일 설치만으로 TLS를 신뢰하지
않을 수 있으므로 [Apple의 인증서 신뢰 안내](https://support.apple.com/en-us/102390)를 따릅니다.
Android도 해당 기기·관리 정책에 맞게 테스트 CA를 신뢰해야 합니다.
인증서는 저장소 밖에 두고 경로만 셸 환경 변수로 전달합니다. `.pem`, `.key`, `.p12`,
`.pfx`, `.certs/`는 Git에서 제외합니다. `VITE_` 환경 변수로 키를 전달하지 마세요.

`LEAFORY_HTTPS_CERT/KEY`는 Node의 `process.env`에서 읽으므로 셸에서 지정합니다.
`.env.local`을 만들기만 해서는 HTTPS가 켜지지 않습니다.

호스트·포트·HTTP/HTTPS·브라우저·기기가 바뀌면 기록 저장 공간도 달라질 수 있습니다.
기존 기록을 옮길 때 원래 주소에서 먼저 ZIP 백업을 만들고 새 환경에서 복원하세요.
이번 작업은 기존 주소의 IndexedDB를 삭제하거나 자동 이동하지 않습니다.

## Vercel Preview와 로컬 HTTPS 터널 비교

추천: 여러 날 반복하는 설치·재실행·업데이트 검증에는 **접근 보호를 확인한 Vercel Preview의
고정 브랜치 URL**을 사용합니다. PC를 계속 켜둘 필요가 없고 같은 origin에서 검증을
이어가기 쉽습니다. 외부 서비스에 앱을 올리지 않는 것이 우선이면 앞의 **LAN + 신뢰된 로컬
HTTPS**를 선택합니다. 짧은 코드 확인만 필요할 때 인증된 HTTPS 터널을 대안으로 사용하세요.
이번 작업에서는 Vercel 프로젝트/배포 생성, 연결 설정, CLI 배포, 터널 실행을 하지 않았습니다.

| 항목             | Vercel Preview                                              | 로컬 HTTPS 터널                                                               |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| HTTPS            | 플랫폼이 제공                                               | 터널 제공자가 외부 HTTPS 주소 제공, 로컬 preview는 HTTP 가능                  |
| PC 실행          | 업로드 후 PC 서버 불필요                                    | PC preview 서버와 터널 프로세스가 모두 실행돼야 함                            |
| 같은 주소로 반복 | 고정 브랜치 URL 권장. 개별 빌드 URL은 origin이 바뀔 수 있음 | 임시 Quick Tunnel은 재실행 시 주소가 바뀌어 기록도 별도 공간으로 보일 수 있음 |
| 공개 범위        | Preview도 접근 보호 확인 전 비공개로 가정하지 않기          | 인증 없는 임시 URL은 주소를 아는 사람이 접근할 수 있음                        |
| 보호 방법        | Vercel Authentication 등 프로젝트 접근 보호 확인            | 지원 버전의 테스터 이메일 인증 또는 관리형 접근 제어 사용                     |
| 서비스 워커      | 보호 로그인 후 실제 JS/에셋 응답 확인                       | 인증 세션·URL 변경·PC 절전/종료에 따른 동작 확인                              |
| 적합한 경우      | 반복적인 설치/업데이트·여러 기기 테스트                     | 짧은 로컬 빌드 확인, 즉시 종료 가능한 임시 테스트                             |

### Vercel Preview 준비 순서 — 배포는 별도 승인 후

1. 프로젝트/팀의 Deployment Protection과 접근 가능한 테스트 계정을 먼저 확인합니다.
   프로젝트 생성·Git 연동·브랜치 push가 자동 배포를 만들 수 있으므로, 별도 배포 작업에서는
   자동 배포 범위를 확인하고 승인된 Preview만 만듭니다. Production 승격이나 `--prod`는 하지 않습니다.
2. 승인 후 Vite 프로젝트의 빌드 명령을 `npm run build`, 출력 폴더를 `dist`로 설정합니다.
   현재 앱에는 서버 키/클라우드 DB 환경 변수가 필요하지 않습니다. 로컬 HTTPS 개인키를 올리지 않습니다.
3. 앞의 배포 설정대로 `/sw.js`/정적 파일을 실제 MIME으로 제공하고 앱 경로만 SPA fallback을 적용합니다.
   보호가 없는 공개 배포나 인증 해제를 편의상 선택하지 않습니다.
4. 휴대폰에서 승인된 계정으로 로그인하고, 고정된 브랜치 Preview URL을 기록해 계속 사용합니다.
   고유 빌드 URL끼리 이동하면 IndexedDB가 새 공간으로 보일 수 있습니다.
5. Safari와 홈 화면 앱의 인증 세션이 다를 수 있습니다. 보호 로그인 페이지가 `/sw.js`나
   에셋 대신 반환되면 설치/캐시 준비가 실패할 수 있으므로 접근 권한과 응답을 확인합니다.
   이 경우 보호를 끄지 말고 승인된 인증 방식이나 LAN HTTPS로 검증합니다.
6. 테스트 종료 후 데이터 삭제는 자동 수행하지 않습니다. 테스트 기록 보관 여부와 접근 권한
   종료는 사용자가 관리합니다. 기존 사용자 주소의 기록/사진에는 손대지 않습니다.

### 인증된 로컬 터널 준비 예시 — 아직 실행하지 않은 명령

공식 `cloudflared`의 테스터 이메일 인증 지원 버전을 준비합니다. 승인받은 후에만 실행하며,
아래 `tester@example.com`은 허용할 실제 테스트 계정으로 직접 바꿉니다.

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
# 별도 터미널: 실행하면 외부 HTTPS 주소가 생성됩니다. 승인 전 실행하지 마세요.
cloudflared tunnel --url http://127.0.0.1:4174 --http-host-header localhost --allowed-mail tester@example.com
```

출력된 HTTPS URL에서 이메일 인증을 완료한 뒤 테스트합니다. `--http-host-header localhost`는
원본 Vite preview가 임의의 터널 호스트를 허용하도록 넓히지 않고 로컬 호스트로 요청을 받게
하기 위한 옵션입니다. `allowedHosts: true`로 모든 호스트를 허용하지 않습니다.
인증 옵션을 지원하지 않는 버전이면 비인증 URL로 낮추지 말고 업데이트/다른 방법을 선택합니다.
완료 후 두 프로세스를 `Ctrl+C`로 종료합니다. 임시 URL은 종료 후 사용할 수 없으며
다시 생성한 URL이 다르면 이전 테스트 기록이 자동으로 옮겨지지 않습니다.

터널도 로컬 서버를 외부 HTTPS URL로 중계하는 방식입니다. ‘로컬’이라는 이름만으로
비공개라고 가정하지 마세요. 개인정보·사용자 사진 대신 합성 테스트 데이터를 사용합니다.
현재 Leafory의 사진/기록 입력은 IndexedDB에 저장되며, Vercel/터널로 페이지를 제공한다고
클라우드 저장·동기화 기능이 생기는 것은 아닙니다.

근거: [Vercel 접근 보호](https://vercel.com/docs/deployment-protection),
[접근 보호 변경 공지](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan),
[고정 브랜치/빌드 URL](https://vercel.com/docs/deployments/generated-urls),
[Vite SPA 배포](https://vercel.com/docs/frameworks/frontend/vite),
[Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/),
[이메일 인증](https://developers.cloudflare.com/changelog/post/2026-10-02-protected-quick-tunnels/).

## 설치와 브라우저 차이

| 항목        | iOS Safari                                                              | Android Chrome                                                   |
| ----------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 설치        | 공유 → 홈 화면에 추가. ‘웹 앱으로 열기’가 있으면 켜기                   | 메뉴 → 앱 설치/홈 화면에 추가. 메뉴 표현은 버전·상태에 따라 다름 |
| 앱 모드     | 홈 화면 아이콘에서 실행, 브라우저 탭과 별도로 확인                      | 설치 아이콘에서 실행, standalone 여부 확인                       |
| 저장 공간   | Safari와 홈 화면 앱 저장 공간이 분리될 수 있어 설치 전후 백업·복원 확인 | 같은 주소라도 브라우저 프로필/기기별로 기록을 별도 확인          |
| 사진 선택   | 카메라/사진 보관함/파일 UI가 OS에 의해 표시될 수 있음                   | 카메라/갤러리/파일 UI가 기기·제조사에 따라 다름                  |
| 키보드·날짜 | 가상 키보드 및 Safari 기본 날짜·시간 선택기 확인                        | Chrome 기본 선택기·키보드 및 뒤로 가기 동작 확인                 |
| ZIP         | 파일 앱·미리보기·공유 또는 다운로드 UI에서 실제 저장 확인               | 다운로드 목록/파일 앱에서 저장 확인                              |

설치 메뉴가 표시되는지와 standalone 실행은 실기기에서 직접 확인해야 합니다.
PC에서 Manifest 파일이 정상이어도 모바일 설치 성공을 대신하지 않습니다.
`capture`는 OS에 대한 힌트이며 항상 같은 카메라 화면을 보장하지 않습니다.
현재 사진 지원은 JPEG/PNG/WebP입니다. HEIC 등 지원하지 않는 형식이 선택되면
검증 오류가 명확하고 작성 내용은 유지되는지 확인하세요.

## 실기기 체크리스트

실제 사용자 데이터 대신 별도 테스트 origin과 합성 테스트 데이터로 수행합니다. 실제 사용자
기록·사진이 있는 주소에서는 삭제/전체 교체 복원을 테스트하지 않습니다. 복원은 전체 교체이므로
검증용 기록을 먼저 ZIP으로 보관하고 테스트 origin의 확인 창에서 대상과 건수를 검토하세요.
백업 생성만으로 실제 다운로드가 끝났다고 가정하지 말고 파일 앱에서 확인합니다.

- [ ] 기기·OS·브라우저 버전·접속 주소·시험 날짜를 기록한다.
- [ ] Safari/Chrome 브라우저에서 Manifest 이름과 홈 화면 아이콘이 올바르게 보인다.
- [ ] 홈 화면에 설치하고 아이콘으로 실행했을 때 주소창 없는 앱 화면으로 열린다.
- [ ] 설치 전후 기록이 보이는지 확인하고, 별도 공간이면 백업·복원으로 이동한다.
- [ ] 온라인에서 필요한 앱 파일 저장을 기다린 뒤 비행기 모드로 다시 열어 실제 동작을 확인한다. 활성화 안내만으로 캐시 보존을 단정하지 않는다.
- [ ] 처음 방문하는 등록·일기·캘린더·백업 화면도 오프라인에서 열린다.
- [ ] 대표 사진 촬영/갤러리 선택, 권한 거부/취소, 사진 없는 등록이 정상이다.
- [ ] JPEG/PNG/WebP, 대용량 사진 리사이즈, 다중 첨부·순서 변경·삭제를 확인한다.
- [ ] 한글 입력·학명 직접 수정·후보 선택, 키보드가 버튼을 가리지 않는지 확인한다.
- [ ] 날짜·시간 선택기에서 과거 날짜와 자정 전후 기록을 저장한다.
- [ ] 캘린더의 점·식물 필터·오늘·월 이동 및 기록 수정/삭제 반영이 정상이다.
- [ ] 사진 일기·물주기·식물등 저장 후 새로고침, 앱 종료/재실행에도 유지된다.
- [ ] ZIP 생성 후 실제 다운로드 파일이 파일 앱에 있고 크기/확장자가 정상이다.
- [ ] ZIP을 선택해 검증·교체 확인을 거쳐 복원하고 사진·연결 관계·건수를 확인한다.
- [ ] 손상 ZIP·잘못된 형식·복원 취소 시 기존 데이터가 유지된다.
- [ ] 오프라인 안내에서 외부 출처·새 버전 다운로드의 제한을 이해할 수 있다.
- [ ] 새 배포 시 입력 화면/백업 화면에서는 업데이트 적용이 막힌다.
- [ ] 다른 Leafory 창이 열려 있으면 업데이트가 차단되고 닫은 뒤 적용된다.
- [ ] 업데이트 후에도 식물·사진·일기·관리 기록·백업이 유지된다.
- [ ] 320px/390px 또는 해당 기기에서 가로 스크롤, 노치/홈 표시줄, 고정 탐색 겹침이 없다.
- [ ] VoiceOver/TalkBack에서 날짜·유형·건수·선택 상태와 폼 라벨을 읽을 수 있다.

| 기기/OS/브라우저 | 접속 주소 | 설치 | 오프라인 | 사진/ZIP | 결과/메모   |
| ---------------- | --------- | ---- | -------- | -------- | ----------- |
| iPhone / 미실행  | —         | —    | —        | —        | 실기기 필요 |
| Android / 미실행 | —         | —    | —        | —        | 실기기 필요 |

## 테스트 배포 설정

현재 앱은 도메인의 루트 `/` 배포를 전제로 합니다. 프로젝트 하위 경로 배포는 별도 대응이 필요합니다.

- HTTPS 및 SPA fallback: `/plants/...`, `/calendar` 등 경로를 `index.html`로 제공합니다.
- `/sw.js`는 JavaScript MIME과 `Cache-Control: no-cache`로 제공합니다. 누락된 SW나
  정적 파일을 HTML fallback으로 반환하지 마세요.
- `index.html`, `manifest.webmanifest`는 재검증 가능한 캐시 정책을 적용합니다.
- 해시가 붙은 `/assets/*`는 장기 immutable 캐시가 가능합니다.
- 배포마다 `npm run build`가 SW 버전과 모든 셸/청크 목록을 재생성합니다.
  빌드된 `dist/` 전체를 원자적으로 배포하고 파일 일부만 바꾸지 않습니다.
- 개발 중 예전 프로덕션 SW가 개입하면 전용 origin/포트를 사용하세요. 해제할 경우 SW만
  unregister하고 Leafory 셸 캐시만 정리합니다. ‘사이트 데이터 전체 삭제’는 IndexedDB도
  지울 수 있으므로 기록 보존 방법으로 사용하지 않습니다.

참고: [MDN 설치 요건](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable),
[Service Worker 보안 컨텍스트](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API),
[Apple 홈 화면 설치](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios),
[WebKit 저장 공간 분리](https://webkit.org/tracking-prevention/),
[사진 capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture),
[다운로드 동작](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#download).

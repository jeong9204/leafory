# Phase 12A-2 — Node 24 개발·빌드 기준 고정

2026-11-01 · `test/iphone-pwa` · 커밋·Push·배포 없음.

## 적용한 설정

| 파일                           | 기존                | 변경                            |
| ------------------------------ | ------------------- | ------------------------------- |
| package.json engines.node      | `>=22.12.0`         | `24.x`                          |
| package.json engines.npm       | `>=10`              | `11.x`                          |
| .nvmrc                         | `22`                | `24.22.2`                       |
| package-lock.json 루트 engines | 기존 범위           | package.json과 동일             |
| README.md                      | Node 22/npm 10 안내 | Node 24/npm 11 및 nvm 사용 절차 |

검증 기준은 공식 배포 Node 24.22.2와 번들 npm 11.19.1이다.
`11.x`는 검증한 버전을 포함하면서 npm 12로 무제한 이동하지 않도록 호환 메이저를 명시한다.
정확한 npm 패치를 강제로 설치하는 packageManager/Corepack 설정이나 installCommand 변경은 추가하지 않았다.
engines는 기본적으로 호환성 선언이며 npm 자체를 교체하거나 강제 차단하는 장치는 아니다.

기존 [Phase 12A 분석](phase-12a-node-security.md)과 [증거 JSON](phase-12a-node-security-evidence.json)은
분석 당시의 기록으로 바이트 그대로 보존했다. 그 문서의 '미적용' 표시는 이전 분석 시점 상태이며,
현재 적용 상태와 이후 검증 결과는 이 문서를 기준으로 한다.

## 로컬 사용 방법

```sh
nvm install
nvm use
node --version
npm --version
npm ci
npm run check
npm run dev
```

`.nvmrc`를 읽으면 Node 24.22.2를 사용한다. Node 공식 배포에 포함된 npm 11.19.1로 검증했다.
다른 버전 관리자를 사용해도 Node 24.x/npm 11.x 기준을 맞춘다.
현재 터미널이 자동으로 전환되거나 시스템 전체의 Node 기본값이 바뀌는 것은 아니다.
이번 자동 검증은 공식 Node 24 바이너리를 각 명령 프로세스의 PATH에 지정해 실행했으며,
전역 nvm 기본 별칭이나 다른 프로젝트의 실행 환경은 수정하지 않았다.

## lockfile 및 의존성 보존

lockfileVersion 3을 유지했고 루트 `packages[""].engines`의 두 값만 맞췄다.
lockfile을 삭제·재생성하거나 의존성 재해석을 위한 npm install/update를 실행하지 않았다.

변경 전 lockfile을 파싱한 뒤 루트 engines만 새 값으로 치환한 객체와 전체 비교했고 일치했다.
**외부 패키지 303개 잠금 레코드의 버전·resolved·integrity·의존 관계는 모두 동일**하다.
Node 24에서 실제 프로젝트의 `npm ci`를 수행한 뒤에도 이 상태를 재확인했다.
직접/간접 패키지 업데이트, overrides, audit fix, 규칙·테스트 삭제는 없다.

## Vercel 설정 검증과 npm 차이

2026-11-01 Vercel 프로젝트 Build and Deployment 화면을 읽기 전용으로 확인했다.
Node.js Version은 **24.x 선택**, Save는 비활성 상태였다. 원격 설정은 바꾸지 않았다.
현재 `vercel.json`의 `npm ci` 설치 및 `npm run build` 명령도 유지한다.

새 package.json 범위는 Node 24.22.2를 허용하고 22.x/26.x를 허용하지 않는다.
Vercel은 package.json의 Node 범위를 프로젝트 설정보다 우선하므로, 이후 이 변경사항을 포함한
승인된 배포는 기존의 26 자동 선택 대신 24 계열을 사용하도록 구성됐다.
[공식 Node 버전 선택 규칙](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

| 구분                | Node    | npm                 | 확인 상태                                       |
| ------------------- | ------- | ------------------- | ----------------------------------------------- |
| 이번 로컬 검증      | 24.22.2 | 11.19.1             | 실제 실행 확인                                  |
| 기존 배포           | 26.x    | 정확한 버전 미확인  | Phase 11 빌드 로그 기준, 이번에 재배포하지 않음 |
| 이후 승인할 Preview | 24.x    | 배포 로그 확인 필요 | 설정 규칙만 검증, 실행은 미검증                 |

Vercel은 같은 Node 메이저의 minor/patch를 자동 갱신한다. 따라서 .nvmrc의 정확한 패치와
Vercel의 패치를 영구히 동일하게 고정했다고 주장하지 않는다.
npm 선택도 패키지 관리자/빌드 환경의 영향을 받으며 `engines.npm: 11.x` 자체가 npm 11.19.1을 설치하지 않는다.
현재 원격 npm 패치를 추정하거나 Corepack/전역 npm 설치로 바꾸지 않았다.
[공식 패키지 관리자 선택 설명](https://vercel.com/docs/package-managers)

후속 Preview 승인 시 실제 `node --version`·`npm --version`을 배포 로그에서 확인해야 한다.
만약 원격 npm이 선언한 11 계열과 다르면 원인 확인 및 별도 승인 후 설치 정책을 조정한다.
이 단계에서는 로그 출력용 원격 명령/설정도 변경하지 않았다.

## Node 24 로컬 검증

Node 24.22.2/npm 11.19.1에서 실제 작업 디렉터리에 `npm ci` 후 `npm run check`를 실행했다.

| 검사             | 결과                          |
| ---------------- | ----------------------------- |
| npm ci           | 통과, 의존성 잠금 레코드 유지 |
| TypeScript       | 통과                          |
| ESLint           | 통과 (max-warnings 0)         |
| Prettier         | 통과                          |
| Vitest           | 40개 파일·417개 테스트 통과   |
| Production build | 통과                          |
| PWA build 검사   | 통과                          |
| git diff --check | 통과                          |

npm 11은 optional macOS watcher인 fsevents@2.3.3의 install-script 승인 미설정 경고를 표시했다.
스크립트를 자동 승인하거나 정책을 완화하지 않았고 검사/빌드는 통과했다.
한 차례 빌드에서는 플러그인 callback 소요 시간 진단도 출력됐으나 빌드 오류는 없었으며 산출물은 동일했다.
이 macOS arm64 검증을 Linux Vercel의 새 배포 실행 결과로 확대하지 않는다.

## npm audit 및 보안 추적

동일한 Node 24/npm 11 환경에서 공식 레지스트리에 다음을 요청했다.

```sh
npm audit --json
npm audit --omit=dev --json
```

| 항목                 | Phase 12A 분석 | Node 24 적용 후 |
| -------------------- | -------------: | --------------: |
| 전체 moderate        |             13 |              13 |
| 전체 high / critical |          0 / 0 |           0 / 0 |
| production-only 전체 |              0 |               0 |

전체 audit의 종료 코드 1은 발견 사항이 있음을 뜻하며 명령 자체의 네트워크 실패가 아니다.
13건은 minimatch 10.2.6의 GHSA-g3hv-75wg-m249가 ESLint 계열로 전파된 집계다.
현재 수정판 11.0.1은 소비자의 10.x 범위를 벗어나므로 이번 환경 고정과 분리한다.
production-only 0건도 제품 전체에 취약점이 없다는 보장은 아니다.

기존 분석의 의존 경로·발동 조건·CI 신뢰 경계 및 상위 패키지 수정판 추적 방안을 유지한다.
지원 상위 릴리스/10.x 백포트를 주기적으로 확인하고, 필요하면 별도 승인한 메이저 전환 작업에서
glob/ignore/peer 호환성을 검증한다. minimatch 강제 override와 `npm audit fix --force`는 실행하지 않았다.
[보안 권고](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## 이전 빌드와 PWA 영향

기존 Phase 12A 기준 빌드와 파일 이름·추가/누락 여부·내용을 비교했다.
새 빌드의 배포 파일 전체가 바이트 단위로 동일했다.

| 항목                  | 기존                                                             | 적용 후    |
| --------------------- | ---------------------------------------------------------------- | ---------- |
| precache 항목         | 70개                                                             | 70개       |
| precache 본문 합계    | 3,156,994B                                                       | 3,156,994B |
| refined WebP          | 21개 / 22,220B                                                   | 동일       |
| painted WebP precache | 0개, 원본 파일 유지                                              | 동일       |
| SW 캐시 버전          | 81dd2c55e4a9b1f9                                                 | 동일       |
| sw.js SHA-256         | 5d2e1c088ac88606f8f2c9e5462c94b402612803b0c4a584e81afd7c4c68ec7c | 동일       |

앱 셸·이미지·폰트·지연 청크와 업데이트 정책이 달라지지 않아 별도 데이터 마이그레이션이나
캐시 초기화가 필요하지 않다. 417개 회귀에는 CRUD·일기/Blob·성장 비교·타이머·캘린더·ZIP 및
오프라인 서비스 워커 응답/업데이트 검증이 포함된다.
이번에는 사용자 브라우저를 열거나 실제 IndexedDB/사진/Cache Storage를 조작하지 않았다.

## 변경 및 보존 범위

이번 변경은 .nvmrc, package.json, lockfile 루트 engines, README와 이 문서에 한정한다.
기존 Phase 12A 미커밋 문서 2개는 그대로 보존한다.
홈/CSS/픽셀 에셋·앱 기능·Dexie/Repository·SW 정책·Vercel 설정은 변경하지 않는다.
브랜치와 기존 HEAD를 유지했으며 main·Production 변경, 커밋·Push·배포는 하지 않았다.

## 커밋 및 Preview 배포 준비 (2026-11-01)

로컬 검증 보고 승인 후 이 설정과 Phase 12A 분석 자료를 테스트 브랜치에 함께 커밋하는 단계다.
실제 원격 버전을 추정하지 않도록 package.json의 기존 build 명령 앞에
`node --version && npm --version`만 추가한다. vercel.json의 설치/빌드 명령은 그대로다.
이 로그 출력은 의존성 설치 방식, 앱 동작이나 서비스 워커 정책을 변경하지 않는다.
새 Preview의 Ready·Source 및 실제 버전은 배포 후 별도로 확인한다.
위 '커밋·Push·배포 없음'은 최초 로컬 검증 보고 시점의 기록이다.

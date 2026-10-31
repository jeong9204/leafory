# Phase 12A — Node.js 환경 및 npm 보안 분석

2026-10-31 · `test/iphone-pwa` · HEAD `e1c69c7a303953b1bcb2b8241f75970f8de1755f`.

## 결론 및 이번에 적용한 범위

**추천은 Node 24.x LTS로 명시적 통일하는 방안이다. 아직 적용하지 않았다.**
현재 Node 22/24/26에서 모두 전체 검사 417개와 동일한 배포 산출물을 확인했다.
24는 현재 Vercel 프로젝트 설정 및 @types/node 24와 맞으며, 22보다 지원 기간이 길고
LTS 전환 직후인 26을 즉시 채택할 필요가 없는 보수적 운영 선택이다. 26의 비호환 문제가 발견됐다는 뜻은 아니다.

npm audit 중간 위험 13건은 재현됐다. **독립된 CVE 13개가 아니라 minimatch 한 건의 의존 경로 전파 집계**다.
Production-only는 0건이다. 현재 수정판은 minimatch 11.0.1이며 10 계열의 수정 패치는 조회되지 않았다.
호환 가능한 작은 업데이트로 이 취약점을 해소할 수 없어 강제 override/다운그레이드/메이저 변경을 적용하지 않았다.

이번 실제 프로젝트 변경은 이 문서와 [분석 증거 JSON](phase-12a-node-security-evidence.json)뿐이다.
package.json, lockfile, .nvmrc, 전역 Node/npm, Vercel 설정, 앱 코드/디자인, 에셋, DB 및 SW 정책은 그대로다.
커밋·Push·배포·스토리지 초기화도 하지 않았다. 임시 다운로드/새 설치는 저장소 밖에서만 수행했다.

## Git 및 조사 방법

작업 시작 시 tracked/untracked 변경사항과 staged diff는 없었다. Phase 11 두 커밋과
local/origin test 브랜치 HEAD는 일치했다. main/origin main은 기존
`d7165a69085a5a8c01e078f04589cb6d1d49106f`를 유지했다.
보존 중인 ignored 디자인/QA 파일도 변경하지 않았다.

실행한 조사 명령은 `npm audit --json`, `npm audit --omit=dev --json`, `npm outdated --json`,
`npm ls --depth=0`, `npm explain minimatch`, 상위 패키지의 `npm view … dependencies engines --json`다.
최초 샌드박스 DNS 실패 결과를 취약점 0건으로 취급하지 않았고, 네트워크 허용 후 공식 레지스트리에서 다시 조회했다.
전체 audit의 종료 코드 1과 outdated의 종료 코드 1은 보고할 항목이 있다는 정상적인 결과다.

## 현재 Node/npm 환경

| 항목                             | 관찰값                                   |
| -------------------------------- | ---------------------------------------- |
| 현재 로컬 Node                   | 22.22.0                                  |
| 현재 로컬 npm                    | 10.9.4                                   |
| package.json engines.node        | `>=22.12.0`                              |
| package.json engines.npm         | `>=10`                                   |
| .nvmrc                           | `22`                                     |
| .node-version                    | 없음                                     |
| Vercel 프로젝트 설정             | 24.x (설정 화면에서 읽기 전용 확인)      |
| 기존 최종 Preview 실제 빌드      | 26.x (배포 override 및 빌드 로그로 확인) |
| Vercel 정확한 Node 패치/npm 버전 | 기존 로그에 출력되지 않아 미확인         |

24.x 프로젝트 설정과 `engines.node >=22.12.0`이 충돌할 때 Vercel은 package.json 범위를 우선한다.
이 범위에는 26.x도 포함되므로 당시 최신 지원 메이저 26.x가 선택됐다.
`.nvmrc`는 로컬 nvm용이며 Vercel의 해당 engines override를 막지 못한다.
명시적 범위가 없으므로 향후 새 메이저가 지원될 때 다시 자동 이동할 수 있다.
이 동작과 지원 버전/패치 자동 갱신은 [Vercel 공식 설명](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)에 근거한다.

Node는 이 앱에서 개발/검사/빌드 도구를 실행한다. 현재 배포는 정적 Vite 앱이며 Node 서버/Function을 추가하지 않았다.
iPhone/PWA 안에서 이 Node 런타임이 실행되는 것은 아니다.

## Node 22·24·26 비교 및 권장안

[Node 공식 일정](https://github.com/nodejs/Release/blob/main/schedule.json)의 2026-10-31 기준 판정:

| 계열 | 지원 단계                    | 지원 종료  | 판단                                                                        |
| ---- | ---------------------------- | ---------- | --------------------------------------------------------------------------- |
| 22   | Maintenance LTS              | 2027-04-30 | 현재 로컬 검사 통과. 신규 출시 준비의 장기 기준으로는 지원 잔여 기간이 짧음 |
| 24   | Maintenance LTS              | 2028-04-30 | 기존 설정·타입 정의와 일치, clean 설치와 전체 검사 통과. 우선 권장          |
| 26   | Active LTS (2026-10-28 전환) | 2029-04-30 | 현재 Preview 빌드 성공 및 격리 전체 검사 통과. 별도 계획으로 채택 가능      |

24를 아직 Active LTS라고 부르거나 26을 Current라고 부르지 않는다.
[24.22.2](https://nodejs.org/en/blog/release/v24.22.2), [26.13.0](https://nodejs.org/en/blog/release/v26.13.0)은
공식 배포 바이너리를 다운로드해 공식 SHA-256과 대조했다. 시스템/프로젝트 기본 실행 파일은 바꾸지 않았다.
조회 당시 22 최신 패치는 22.23.4이므로, 22를 당분간 유지하더라도 22.22.0이 최신 패치는 아니라는 점은 유의한다.

### 승인 후 적용할 제안 — 이번에는 미적용

- `engines.node`를 `24.x`로 한정해 다음 배포의 실제 빌드를 24 계열로 맞춘다.
- `.nvmrc`를 검증한 `24.22.2`로 맞춘다. 중복 관리할 .node-version을 추가할 필요는 없다.
- Vercel 프로젝트 설정 24.x는 이미 맞으므로 별도 변경이 필요 없다. 기존 배포를 교체하려면 별도 승인 후 Preview 배포한다.
- 로컬은 검증한 npm 11.19.1을 기준으로 하고, npm 메이저도 바뀐다는 점을 함께 승인·관리한다.
- Vercel은 메이저 안의 minor/patch를 자동 갱신하므로 로컬의 정확한 패치와 영구 동일하다고 보장하지 않는다.
  승인된 후속 빌드에서 `node --version`과 `npm --version`을 기록해 실제 버전을 확인한다.
- 최신 메이저를 설치하는 방식 대신 LTS 패치 업데이트 후 lockfile 기반 clean 검사/Preview를 수행한다.

`engines.node 24.x` 수정은 향후 Vercel의 실제 메이저를 26→24로 바꾸고 로컬 nvm은 22→24로 바꾼다.
사용자의 사전 보고/승인 조건에 따라 파일·원격 설정은 변경하지 않았다.
@types/node 26, TypeScript 7, npm 12도 승인 없이 올리지 않는다.
향후 Capacitor 등 네이티브 도구를 도입하면 그 도구의 Node 요구사항을 추가 검증해야 한다.

## 설치된 주요 도구의 지원 범위

웹 문서의 최신 설명을 설치 버전과 혼동하지 않도록 실제 node_modules의 package.json을 읽었다.

| `vite` | 8.3.5 | `^20.19.0 || >=22.12.0` |
| `@vitejs/plugin-react` | 6.1.2 | `^20.19.0 || >=22.12.0` |
| `@tailwindcss/vite` | 4.3.3 | `직접 engines.node 없음` |
| `vitest` | 5.0.5 | `^22.12.0 || ^24.0.0 || >=26.0.0` |
| `typescript` | 6.0.3 | `>=14.17` |
| `eslint` | 10.13.0 | `^20.19.0 || ^22.13.0 || >=24` |
| `typescript-eslint` | 8.72.0 | `^18.18.0 || ^20.9.0 || >=21.1.0` |
| `jsdom` | 29.1.1 | `^20.19.0 || ^22.13.0 || >=24.0.0` |
| `react-router` | 8.5.0 | `>=22.22.0` |

@tailwindcss/vite는 직접 Node 엔진 범위를 명시하지 않지만 현재 Vite 8 peer를 지원한다.
typescript-eslint 8.72.0은 ESLint 10 및 TypeScript `>=4.8.4 <6.1.0`을 지원해 현재 TS 6.0.3과 맞는다.
React Router의 현재 엔진 하한은 22.22.0이므로 프로젝트의 단순 engines 하한 22.12.0만으로는 충분하지 않다.
선언된 범위는 호환성의 필요조건이며 아래 실제 검사를 함께 근거로 삼았다.

## 취약점 전체 분석표

아래 13행은 **모두 moderate·개발 의존성**이다. 각 행의 버전 범위는 npm audit 원문이며
`*` 등 전파된 메타 취약점 범위를 독립적인 모든 버전의 코드 취약점으로 해석하지 않는다.
앱 런타임 직접 의존성에서 보고된 취약점은 없다.

| 패키지                                 | 현재 설치 | audit 영향 범위     | 직접/간접 · 용도 | 상위/전파 경로                                        |
| -------------------------------------- | --------- | ------------------- | ---------------- | ----------------------------------------------------- |
| `@eslint-community/eslint-utils`       | 4.10.1    | `*`                 | 간접 / 개발      | eslint / typescript-eslint → utils                    |
| `@eslint/config-array`                 | 0.23.5    | `*`                 | 간접 / 개발      | eslint → config-array                                 |
| `@eslint/js`                           | 10.0.1    | `>=10.0.1`          | 직접 / 개발      | 직접 선언, eslint peer 경로                           |
| `@typescript-eslint/eslint-plugin`     | 8.72.0    | `*`                 | 간접 / 개발      | typescript-eslint → eslint-plugin                     |
| `@typescript-eslint/parser`            | 8.72.0    | `*`                 | 간접 / 개발      | typescript-eslint → parser                            |
| `@typescript-eslint/type-utils`        | 8.72.0    | `>=5.9.2-alpha.0`   | 간접 / 개발      | typescript-eslint → eslint-plugin → type-utils        |
| `@typescript-eslint/typescript-estree` | 8.72.0    | `>=6.16.0`          | 간접 / 개발      | typescript-eslint → typescript-estree                 |
| `@typescript-eslint/utils`             | 8.72.0    | `*`                 | 간접 / 개발      | typescript-eslint → utils                             |
| `eslint`                               | 10.13.0   | `0.7.1 - 2.0.0-rc.1 |                  | >=4.1.0`                                              | 직접 / 개발 | 직접 선언 → minimatch / config-array |
| `eslint-config-prettier`               | 10.1.8    | `>=7.0.0`           | 직접 / 개발      | 직접 선언, eslint peer 경로                           |
| `eslint-plugin-react-refresh`          | 0.5.7     | `*`                 | 직접 / 개발      | 직접 선언, eslint peer 경로                           |
| `minimatch`                            | 10.2.6    | `<11.0.1`           | 간접 / 개발      | eslint / config-array / typescript-estree → minimatch |
| `typescript-eslint`                    | 8.72.0    | `*`                 | 직접 / 개발      | 직접 선언 → parser / utils / eslint-plugin            |

실제 원인은 [GHSA-g3hv-75wg-m249 / CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249)다.
권고상 minimatch `<11.0.1`이 영향 범위, 11.0.1이 수정판이다.
공격자가 제공한 glob 패턴을 optimizationLevel 2 이상으로 전처리하면 패턴 수 증가와 쌍별 비교로
CPU/메모리를 과도하게 사용할 수 있다. 기밀성 유출이나 브라우저의 식물 데이터 변조로 분석하지 않는다.

### Leafory에서의 실제 도달 가능성

- minimatch는 ESLint의 파일 매칭과 config-array, TypeScript ESLint project-service 경로로 들어온다.
- 설치된 ESLint helpers/config-array의 매칭 옵션은 dot이며, minimatch의 기본 optimizationLevel은 1이다.
- typescript-estree의 allowDefaultProject 매칭도 dot 옵션을 사용하고, 현재 설정은 typed project-service를 켜지 않는다.
- Leafory의 lint 파일 패턴은 저장소 설정으로 고정되어 있다. 식물 이름·일기·사진·백업 ZIP이 이 패턴으로 전달되지 않는다.
- 현재 앱은 정적 클라이언트이며 Node/ESLint를 원격 요청에 실행하는 API가 없다.
- 신뢰하지 않는 glob/외부 설정을 개발 자동화에서 받아들이거나, 향후 최적화 수준을 변경하면 위험이 달라질 수 있다.
  현재 도달 가능성이 낮다는 판단으로 경고를 삭제하거나 안전하다고 단정하지 않는다.

13건은 audit 경고로 재현했고, 자원 고갈을 유발하는 큰 공격 패턴을 실행하는 실험은 하지 않았다.
Vercel의 현재 build 명령은 타입 검사/Vite/PWA 검사이며 lint는 별도 check 명령에서 실행된다.
개발/CI 입력의 신뢰 경계를 관리하고 개발 의존성도 후속 보안 업데이트 대상으로 추적해야 한다.

## 수정 가능 버전과 호환성 위험

현재 minimatch 10의 공식 npm 버전 목록은 10.2.6까지이며 수정된 10.x 패치를 찾지 못했다.
11.0.1은 Node 22/24/26 엔진을 지원하지만 현재 세 소비자의 `^10.x` 범위를 벗어난다.
새 matcher 간접 의존성도 추가하므로 Node 호환만으로 상위 패키지 API/매칭 의미의 호환성을 보장하지 않는다.

| 조사한 작은 업데이트                                 | 실제 minimatch 요구 범위 | 결정                                               |
| ---------------------------------------------------- | ------------------------ | -------------------------------------------------- |
| ESLint 10.13.0 → 10.14.0                             | `^10.2.6`                | 취약점 해결 안 됨. 불필요한 변경으로 판단해 미적용 |
| typescript-eslint/estree 8.72.0 → 8.72.1             | `^10.2.2`                | 취약점 해결 안 됨. 미적용                          |
| React Router 8.5.0 → 8.5.1                           | 현재 production audit 0  | 이번 dev 취약점과 무관하여 미적용                  |
| Lucide 1.61.0 → 1.66.0, fake-indexeddb 6.2.6 → 6.2.7 | 이번 취약점과 무관       | 디자인/도구 변경을 넓히지 않음                     |

13개 행 모두의 실질 해결은 현재 경로의 minimatch를 수정판으로 바꾸는 것이며,
상위 패키지의 공식 지원 또는 별도로 승인한 메이저/스코프 override 검토가 필요하다.
ESLint CLI·ignore/files·project glob 의미와 peer 관계, 전체 lint/test를 검증하기 전 강제 교체하지 않는다.

### npm의 fixAvailable을 그대로 적용하지 않은 이유

| 패키지                                 | npm 출력                                       |
| -------------------------------------- | ---------------------------------------------- |
| `@eslint-community/eslint-utils`       | `typescript-eslint@8.14.0` (승인 범위 밖)      |
| `@eslint/config-array`                 | `typescript-eslint@8.14.0` (승인 범위 밖)      |
| `@eslint/js`                           | `@eslint/js@9.39.5` (승인 범위 밖)             |
| `@typescript-eslint/eslint-plugin`     | 버전 미지정 수정 가능 표시                     |
| `@typescript-eslint/parser`            | `typescript-eslint@8.14.0` (승인 범위 밖)      |
| `@typescript-eslint/type-utils`        | 버전 미지정 수정 가능 표시                     |
| `@typescript-eslint/typescript-estree` | `typescript-eslint@8.14.0` (승인 범위 밖)      |
| `@typescript-eslint/utils`             | `typescript-eslint@8.14.0` (승인 범위 밖)      |
| `eslint`                               | `typescript-eslint@8.14.0` (승인 범위 밖)      |
| `eslint-config-prettier`               | `eslint-config-prettier@6.15.0` (승인 범위 밖) |
| `eslint-plugin-react-refresh`          | 없음                                           |
| `minimatch`                            | `typescript-eslint@8.14.0` (승인 범위 밖)      |
| `typescript-eslint`                    | `typescript-eslint@8.14.0` (승인 범위 밖)      |

예를 들어 typescript-eslint 8.14.0은 현재 8.72.0보다 오래된 버전이며 현재 TS 6/ESLint 10과의 지원 관계를
고려해야 한다. @eslint/js 9나 eslint-config-prettier 6으로의 다운그레이드도 승인된 작은 수정이 아니다.
버전 미지정 fixAvailable=true도 전체 peer 그래프의 안전한 해결을 보증하지 않는다.
`npm audit fix --force`, 무조건적인 전체 update, 테스트/규칙 삭제, lockfile 재생성을 사용하지 않았다.

## 변경 전후 audit 및 의존성

| 항목                             |          변경 전 | 분석 후 |
| -------------------------------- | ---------------: | ------: |
| 전체 moderate                    |               13 |      13 |
| 전체 high / critical             |            0 / 0 |   0 / 0 |
| production-only 전체             |                0 |       0 |
| 직접 의존성 버전 변경            |                — |       0 |
| 간접 의존성 버전 변경            |                — |       0 |
| package.json / lockfile 변경     |             없음 |    없음 |
| 로컬 기본 Node/npm               | 22.22.0 / 10.9.4 |    동일 |
| Vercel 프로젝트 설정 / 기존 배포 |      24.x / 26.x |    동일 |

경고 감소를 꾸미기 위한 변경은 하지 않았다. 수정한 것은 원인·영향·승인 필요 항목을 기록하는 문서/증거 파일이다.
production audit 0은 알려진 npm 권고에서 보고가 없다는 의미이며 전체 제품에 취약점이 없다는 보장은 아니다.

## 전체 검사 및 재현성

| 시험                                        | Node / npm        | 타입·린트·포맷 | Vitest | 빌드·PWA |
| ------------------------------------------- | ----------------- | -------------- | -----: | -------- |
| 기존 로컬                                   | 22.22.0 / 10.9.4  | 통과           |    417 | 통과     |
| 임시 공식 바이너리                          | 24.22.2 / 11.19.1 | 통과           |    417 | 통과     |
| 임시 공식 바이너리                          | 26.13.0 / 11.20.0 | 통과           |    417 | 통과     |
| 저장소 밖 clean 복사본·기존 lockfile npm ci | 24.22.2 / 11.19.1 | 통과           |    417 | 통과     |

임시 바이너리는 각 시험 프로세스의 PATH에만 적용했다. 기본 shell·프로젝트·전역 npm 설치는 바꾸지 않았다.
처음 두 격리 시험은 기존 node_modules를 재사용했으며 추가 clean 시험은 설치부터 재현했다.
clean npm ci 후에도 lockfile은 원래 파일과 같았다. 이 macOS arm64 시험을 Linux 전체 플랫폼 검증으로 확대하지 않는다.

clean npm 11에서는 optional macOS watcher인 fsevents@2.3.3의 install-script 승인 미설정 경고가 있었다.
검사와 빌드는 통과했지만 스크립트를 자동 승인하거나 보안 정책을 완화하지 않았다.
npm 메이저 채택 시 설치 스크립트 정책도 검토해야 한다.
Vercel 기존 로그의 Unknown env config cache-dir는 npm이 모르는 환경 설정 경고다.
저장소 .npmrc는 없으며 주입 경로/정확한 npm 버전은 확정하지 못해 원격 환경변수를 변경하지 않았다.

## PWA 및 기존 기능 영향

모든 Node 시험과 clean 설치의 배포 파일은 기준 빌드와 **전체 파일·이름·내용이 동일**했다.

| 항목                  | 기존                                                             | 검증 빌드 |
| --------------------- | ---------------------------------------------------------------- | --------- |
| precache              | 70개 / 3,156,994B                                                | 동일      |
| refined WebP          | 21개 / 22,220B                                                   | 동일      |
| painted WebP precache | 0개 (원본 파일 유지)                                             | 동일      |
| SW 캐시 버전          | 81dd2c55e4a9b1f9                                                 | 동일      |
| sw.js SHA-256         | 5d2e1c088ac88606f8f2c9e5462c94b402612803b0c4a584e81afd7c4c68ec7c | 동일      |

따라서 새로운 앱 셸/캐시 갱신이나 마이그레이션을 유발하는 배포 변경은 없다.
417개에는 식물·관리 기록·타이머·사진 일기·성장 비교·캘린더·ZIP 및 오프라인 SW 응답/업데이트 회귀가 포함된다.
오프라인 자산 동일성과 기존 SW 격리 테스트를 확인했으며, 이번에는 실제 브라우저 비행기 모드 시험을 추가로 반복하지 않았다.
사용자가 완료한 Phase 11 iPhone 테스트와 별개로, 향후 Node 고정 후 승인된 Preview에서 다시 확인하는 것이 필요하다.

Leafory 실사용자의 IndexedDB·사진 Blob·타이머·Cache Storage에는 접근하거나 초기화하지 않았다.
서비스 워커 정책과 Dexie 스키마/Repository는 변경하지 않았다.

## 다음 승인 항목

1. Node 24.x 및 npm 11 기준 채택: engines/.nvmrc와 버전 기록 절차를 적용하고 Preview에서 재확인.
2. minimatch 11 지원 상위 릴리스 확인 또는 승인된 메이저 전환 검토: glob/ignore/project-service 의미와 peer 관계를 회귀 검증.
3. production audit와 dev audit을 분리해 추적하고, 신뢰하지 않는 외부 glob/설정이 CI에 들어오지 않도록 운영.
4. App Store/Google Play용 네이티브 의존성 도입 시 별도 환경·보안 검증. 이번에 해당 도구는 추가하지 않음.

## 확인한 자료

- [Node 공식 배포 인덱스](https://nodejs.org/dist/index.json)
- [Node 릴리스 일정](https://github.com/nodejs/Release/blob/main/schedule.json)
- [Node 24.22.2 LTS](https://nodejs.org/en/blog/release/v24.22.2), [Node 26.13.0 LTS](https://nodejs.org/en/blog/release/v26.13.0)
- [Vercel 지원 버전 및 engines 우선순위](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [minimatch 보안 권고](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- 설치 버전의 package.json/ESLint 및 minimatch 코드, 공식 npm audit/view 결과. 구조화한 값은 증거 JSON에 포함.

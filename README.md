# Leafory

식물의 성장과 관리 기록을 사진 일기로 남기는 모바일 우선 웹앱입니다.
현재는 프론트엔드 초기 설정 단계이며, 모든 경로는 개발용 자리표시자 화면입니다.
첨부 디자인의 실제 홈 화면, 식물 관리, 사진 업로드 등은 구현하지 않았습니다.

## 시작하기

Node.js 22.12 이상과 npm 10 이상이 필요합니다. `.nvmrc`는 Node.js 22를 사용합니다.

```sh
npm ci
npm run dev
```

터미널에 표시되는 개발 서버 주소를 엽니다. 휴대폰에서 확인하려면 같은 네트워크에서
`npm run dev -- --host 0.0.0.0`을 실행한 뒤 컴퓨터의 LAN 주소로 접속합니다.
현재 환경변수는 필요하지 않습니다. 필요해지면 `.env.example`을 `.env.local`로 복사합니다.
`VITE_` 환경변수는 빌드 결과에 공개되므로 비밀 키를 넣지 않습니다.

## 명령어

| 명령                   | 용도                                              |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | 개발 서버                                         |
| `npm run typecheck`    | 애플리케이션과 Vite 설정의 strict TypeScript 검사 |
| `npm run lint`         | ESLint 검사, 경고도 실패 처리                     |
| `npm run format`       | Prettier 포맷 적용                                |
| `npm run format:check` | 포맷 검사                                         |
| `npm test`             | Vitest + React Testing Library 단일 실행          |
| `npm run test:watch`   | 테스트 감시 실행                                  |
| `npm run build`        | 타입 검사 후 프로덕션 빌드, 결과는 `dist/`        |
| `npm run preview`      | 빌드 결과 로컬 미리보기                           |
| `npm run check`        | 타입·린트·포맷·테스트·빌드 일괄 검사              |

## 구조

```text
src/
├── app/
│   ├── AppLayout.tsx       # 모바일 기본 셸과 개발용 탐색 링크
│   ├── routes.tsx          # 라우트 정의
│   └── routes.test.tsx     # 경로 매칭, 미지정 URL, 화면 이동 검증
├── pages/
│   └── SetupPage.tsx       # 공통 자리표시자, 추후 실제 페이지로 교체
├── domain/                # 향후 순수 도메인 타입과 저장소 계약
├── data/
│   ├── local/             # 향후 Dexie 스키마와 로컬 저장소 구현
│   └── remote/            # 향후 서버 저장소 구현
├── stores/                # 향후 Zustand 공유 UI 상태
├── test/setup.ts          # DOM 매처와 테스트 정리
├── App.tsx
├── main.tsx
└── index.css              # Tailwind 테마와 공통 스타일
```

저장소 관련 디렉터리는 역할을 설명하는 README만 포함합니다. 실제 도메인 모델,
저장소 인터페이스, DB 인스턴스, Zustand store는 필요가 확정될 때 만듭니다.
화면은 향후 도메인의 저장소 계약을 사용하고, 로컬/서버 구현 연결은 `app/`에서 담당합니다.
Dexie와 서버 SDK를 화면에 직접 연결하지 않는 방향으로 확장합니다.

## 라우트

| 경로                    | 화면        |
| ----------------------- | ----------- |
| `/`                     | 홈          |
| `/plants/new`           | 식물 등록   |
| `/plants/:id`           | 식물 상세   |
| `/plants/:id/diary/new` | 일기 작성   |
| `/records`              | 기록 목록   |
| 그 외                   | 페이지 없음 |

`BrowserRouter`를 사용합니다. 배포 시 `/plants/…` 같은 직접 접근도 `index.html`을
반환하도록 호스팅의 SPA fallback 설정이 필요합니다.

## 테마와 모바일 기본값

Tailwind CSS의 Vite 플러그인과 CSS `@theme`으로 토큰을 정의합니다.

| 토큰   | 색상      | 사용 예       |
| ------ | --------- | ------------- |
| Cream  | `#F7F4EB` | `bg-cream`    |
| Sage   | `#9DAF91` | `bg-sage`     |
| Forest | `#516B50` | `text-forest` |
| Peach  | `#CDAA91` | `bg-peach`    |
| Brown  | `#756655` | `text-brown`  |

기본 UI 폰트는 로컬 npm 패키지의 Pretendard Variable입니다. 폰트 파일은 Vite가
빌드에 포함하며 CDN 요청 없이 제공됩니다. viewport는 확대를 허용하며,
`viewport-fit=cover`, safe area 여백과 `100dvh`를 적용했습니다.

## 설치된 주요 버전

| 라이브러리                   | 버전    |
| ---------------------------- | ------- |
| Vite                         | 8.3.5   |
| React / React DOM            | 19.3.1  |
| TypeScript                   | 6.0.3   |
| Tailwind CSS / Vite 플러그인 | 4.3.3   |
| React Router                 | 8.5.0   |
| Zustand                      | 5.0.16  |
| Dexie                        | 4.4.7   |
| Lucide React                 | 1.61.0  |
| Pretendard                   | 1.3.9   |
| ESLint                       | 10.13.0 |
| Prettier                     | 3.9.10  |
| Vitest                       | 5.0.5   |
| React Testing Library        | 16.3.3  |

정확한 의존성 트리는 `package-lock.json`으로 고정합니다. `npm ci`로 재현할 수 있습니다.

## 현재 범위와 다음 단계

이번 단계에는 서버 API, Supabase, 로그인, Capacitor, PWA 서비스 워커·설치용 manifest를
추가하지 않았습니다. 현재 앱은 설치형 또는 오프라인 PWA가 아닙니다.
GitHub 원격 저장소 생성과 push도 별도 확인 이후에 진행합니다.

추천 순서:

1. Plant·Diary 필수 필드와 사진 보관·백업 정책 결정
2. Dexie 스키마와 저장소 계약, 로컬 CRUD 테스트 구성
3. 식물 등록 → 상세 → 일기 작성 흐름 구현 후 홈 디자인 적용
4. PWA manifest·아이콘·서비스 워커와 오프라인 업데이트 정책 추가
5. 공개 서비스 전 서버 저장소·인증을 설계하고, 이후 Capacitor 도입 검토

설정 참고: [Vite](https://vite.dev/guide/),
[Tailwind CSS Vite 통합](https://tailwindcss.com/docs/installation/using-vite),
[Vitest](https://vitest.dev/guide/).

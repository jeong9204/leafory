# Leafory

식물의 성장과 관리 기록을 사진 일기로 남기는 모바일 우선 웹앱입니다.
현재는 Phase 10 식물등 타이머 단계입니다. 수동 식물등 기록과 함께 시작·일시정지·재개·종료 및 앱 재실행 복구를 지원합니다.
[타이머 저장·호환성·예외 처리·검증](docs/phase-10.md)을 참고하세요.
홈과 상세에서 실제 로컬 식물을 조회하며 등록·정보 수정·삭제·대표 사진 저장을 지원합니다.
홈 물주기·빠른 관리 기록과 사진 일기의 생성·수정·삭제를 지원합니다. 사진은 최대 10장 첨부하고 순서를 바꿀 수 있습니다. 홈의 데이터 백업·복원에서 ZIP 내보내기와 전체 교체 복원을 지원합니다. DB에 목업 식물을 자동 추가하지 않습니다.

[홈 UI](docs/phase-1-refinement.md) · [상세 UI](docs/phase-2.md) · [데이터 모델과 Repository](docs/phase-3.md) · [실제 식물 관리·사진 정책·검증](docs/phase-4a.md) · [빠른 관리 기록·검증·캡처](docs/phase-4b1.md) · [사진 일기·저장 정책·검증](docs/phase-4b2.md) · [백업 형식·복원 정책·검증](docs/phase-5.md)

## 시작하기

Node.js 24.x LTS와 npm 11.x를 사용합니다. 검증 기준은 Node.js 24.22.2 / npm 11.19.1이며,
`.nvmrc`는 24.22.2로 고정합니다. nvm을 사용한다면 프로젝트에서 다음과 같이 실행합니다.

```sh
nvm install
nvm use
node --version
npm --version
npm ci
npm run dev
```

nvm 이외의 도구를 사용해도 같은 Node 메이저와 npm 메이저를 맞춥니다. `engines.npm`은
npm을 자동 교체하거나 정확한 패치를 설치하는 설정이 아닙니다. Vercel은 Node 24 계열의 패치를
자동 갱신하므로 정확한 Node/npm 패치는 배포 로그에서 확인해야 합니다.
[Node 24 고정 및 검증 결과](docs/phase-12a2-node24.md)를 참고하세요.

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
├── components/            # 하단 내비게이션과 재사용 PlantCard
├── pages/
│   ├── HomePage.tsx        # 실제 식물 목록과 물주기
│   ├── PlantDetailPage.tsx # 실제 식물 상세와 관리 타임라인
│   ├── plant-detail.css   # 상세 화면 전용 스타일
│   ├── PlantEditorPage.tsx # 실제 식물 등록·수정
│   ├── CareEditorPage.tsx  # 빠른 관리 기록 생성·수정
│   ├── DiaryEditorPage.tsx # 사진 일기 작성·수정
│   ├── DiaryDetailPage.tsx # 사진 일기 보기·삭제
│   ├── BackupPage.tsx      # ZIP 백업·전체 교체 복원
│   ├── CalendarPage.tsx    # 월별 관리 캘린더와 식물 필터
│   └── SetupPage.tsx       # 후속 단계 자리표시자
├── lib/                   # 한국 시간 날짜 계산과 테스트
├── domain/                # 도메인 타입·계약·검증·로컬 날짜
├── data/
│   ├── mock/              # 이전 시안 자료 (실행 화면에서 미사용)
│   ├── local/             # Dexie v1·Repository·독립 DB 테스트
│   └── remote/            # 향후 서버 저장소 구현
├── stores/                # 향후 Zustand 공유 UI 상태
├── test/setup.ts          # DOM 매처와 테스트 정리
├── App.tsx
├── main.tsx
└── index.css              # Tailwind 테마와 공통 스타일
```

도메인 모델과 저장소 계약은 `domain/`, Dexie 구현은 `data/local/`에 있습니다.
DB는 `main.tsx`에서 생성하고 Provider로 Repository 계약을 주입합니다.
화면은 Dexie를 직접 호출하지 않으며 사진·식물 저장의 트랜잭션은 `app/plant-service.ts`가 담당합니다.
서버 저장소와 Zustand store는 아직 구현하지 않았습니다.

## 라우트

| 경로                              | 화면             |
| --------------------------------- | ---------------- |
| `/`                               | 홈               |
| `/plants/new`                     | 식물 등록        |
| `/plants/:id`                     | 식물 상세        |
| `/plants/:id/compare`             | 성장 사진 비교   |
| `/plants/:id/edit`                | 식물 수정        |
| `/plants/:id/care/new`            | 빠른 관리 기록   |
| `/plants/:id/care/:eventId/edit`  | 관리 기록 수정   |
| `/plants/:id/diary/new`           | 일기 작성        |
| `/plants/:id/diary/:entryId`      | 일기 상세        |
| `/plants/:id/diary/:entryId/edit` | 일기 수정        |
| `/records`                        | 기록 목록        |
| `/backup`                         | 데이터 백업·복원 |
| `/calendar`                       | 월별 관리 캘린더 |
| 그 외                             | 페이지 없음      |

`createBrowserRouter`와 `RouterProvider`를 사용합니다. 작성 중인 폼은 `useBlocker`로 화면 이탈을 확인합니다. 배포 시 `/plants/…` 같은 직접 접근도 `index.html`을
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
빌드에 포함하며 CDN 요청 없이 제공됩니다. 제목·식물 이름·학명·본문·폼·네비게이션 모두 같은 폰트를 사용하고 학명의 Italic은 유지합니다.
본문은 400, 보조 라벨은 500, 버튼·소제목은 600, 주요 제목·강조 숫자는 700을 사용합니다.
Pretendard 1.3.9의 저작권 고지와 SIL OFL 1.1 원문은 [`public/licenses/Pretendard-OFL.txt`](public/licenses/Pretendard-OFL.txt)에 포함하며 빌드 시 `/licenses/Pretendard-OFL.txt`로 배포됩니다.
[폰트 변경 검증 및 캡처](docs/pretendard-ui.md)를 참고하세요. viewport는 확대를 허용하며,
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
| fflate                       | 0.8.3   |
| fake-indexeddb (테스트 전용) | 6.2.6   |
| Lucide React                 | 1.61.0  |
| Pretendard                   | 1.3.9   |
| ESLint                       | 10.13.0 |
| Prettier                     | 3.9.10  |
| Vitest                       | 5.0.5   |
| React Testing Library        | 16.3.3  |

정확한 의존성 트리는 `package-lock.json`으로 고정합니다. `npm ci`로 재현할 수 있습니다.

## 현재 범위와 다음 단계

서버 API, Supabase, 로그인, Capacitor는 추가하지 않았습니다.
Phase 8에서 설치용 manifest·아이콘·앱 셸 서비스 워커를 추가했습니다.
GitHub 원격 저장소 생성과 push도 별도 확인 이후에 진행합니다.

추천 순서:

1. 실제 기기에서 백업 파일 보관·복원과 저장 공간 정책 확인
2. 전체 기록 목록을 Repository에 연결
3. 연결 후 로딩·오류·빈 상태와 모바일 실사용 검증
4. 모바일 실기기 설치·오프라인·업데이트 및 파일 앱 검증
5. 공개 서비스 전 서버 저장소·인증을 설계하고, 이후 Capacitor 도입 검토

설정 참고: [Vite](https://vite.dev/guide/),
[Tailwind CSS Vite 통합](https://tailwindcss.com/docs/installation/using-vite),
[Vitest](https://vitest.dev/guide/).

## 식물 이름으로 학명 찾기 (Phase 6)

식물 등록·수정 폼에서 한국어 이름·별칭·학명을 입력하면 32종 로컬 카탈로그의 후보를
표시합니다. 선택 버튼을 누를 때만 학명을 채우고 직접 입력·미선택 저장도 지원합니다.
같은 유통명에 여러 종이 있을 수 있으며 기존 저장 학명은 자동 수정하지 않습니다.
분류별 출처·확인 날짜와 데이터 정책은 [Phase 6 문서](docs/phase-6.md)를 참고하세요.

## 식물 관리 캘린더 (Phase 7)

하단 캘린더 탭에서 월별 기록, 날짜별 목록, 전체/특정 식물 필터를 사용할 수 있습니다.
관리 이벤트는 기기의 로컬 날짜, 일기는 저장된 일기 날짜 기준으로 표시합니다.
캘린더용 중복 데이터나 DB 스키마 변경 없이 기존 Repository를 조회합니다.
[Phase 7 구현·검증·모바일 캡처](docs/phase-7.md)를 참고하세요.

## 설치형 PWA와 모바일 테스트 (Phase 8)

홈의 ‘홈 화면 설치·오프라인 안내’에서 설치 방법과 준비 상태를 확인합니다.
프로덕션 빌드에서 앱 셸·지연 청크·로컬 폰트를 캐시하고, 새 버전은 작성 화면을 나온 뒤
적용합니다. 사진·일기·관리 기록은 기존 IndexedDB에 유지하며 SW 캐시와 분리합니다.

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
# 같은 Wi-Fi에서 UI 확인 (HTTP는 휴대폰 PWA 검증용이 아님)
npm run dev:lan -- --port 5173 --strictPort
```

휴대폰의 설치/SW 테스트에는 신뢰할 수 있는 HTTPS가 필요합니다.
[Vercel Preview 설정·접근 보호·실기기 검증 순서](docs/vercel-preview.md),
[모바일 LAN·HTTPS·Safari/Chrome 체크리스트](docs/mobile-testing.md),
[Phase 8 구현·업데이트 정책·번들 비교·검증/캡처](docs/phase-8.md)를 참고하세요.

## 성장 사진 비교 (Phase 9)

식물 상세의 ‘성장 비교’에서 일기 사진 두 장을 선택하거나 처음·최근 사진을 빠르게 선택합니다.
일기 날짜와 원본 비율을 유지한 사진을 나란히 비교하며 기존 사진·기록은 수정하지 않습니다.
일기에 연결되지 않은 대표 사진은 비교 목록에서 제외합니다.
[정렬·사진 정책·검증·모바일 캡처](docs/phase-9.md)를 참고하세요.

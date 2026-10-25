# Phase 4A — 실제 식물 관리와 Dexie 연결

Phase 1·2의 크림·세이지 테마, 카드와 상세 요약·탭·하단 내비게이션을 유지하면서
식물 CRUD와 대표 사진만 실제 로컬 저장소에 연결했습니다. 물주기·일기 작성은 계속 비활성 상태입니다.

## 주요 동작

- `/plants/new`: 이름(필수), 대표 사진·학명/품종·데려온 날짜·상태·메모 입력
- `/plants/:id/edit`: 저장된 정보와 대표 사진을 복원하여 수정
- 홈: 실제 식물 목록, 식물 추가, 실제 개수, 로딩·오류·빈 상태, 사진 없는 식물 플레이스홀더
- 상세: 실제 UUID 조회, 실제 사진·학명·상태·메모, 관리 메뉴에서 수정·삭제
- 식물 삭제: native dialog로 확인. 취소하면 그대로 유지, 확정하면 연결 데이터 삭제 후 홈 이동
- 관리 이벤트가 없으면 물주기·오늘의 식물등에 “기록 없음”, 기록 수는 0으로 표시
- 기존 기록이 있는 DB는 Repository로 실제 기록을 조회하며 사진 탭에는 실제 저장 사진을 표시
- 저장 성공 후 Provider의 갱신 신호와 경로 이동으로 홈·상세를 다시 조회
- 창 포커스 복귀/문서 표시 시 홈·상세 재조회. 편집 화면은 파일 선택 후 포커스 복귀 시 입력을 초기화하지 않음
- 저장/삭제 중 ref 잠금과 비활성 버튼으로 중복 요청 차단. 실패하면 입력·사진 선택을 유지하고 재시도 안내

목업 3개는 DB에 자동 추가하지 않습니다. `src/data/mock/`은 이전 시안 참고 자료로만 남아 있고
실행 화면의 import 경로에는 포함되지 않습니다. 기존 DB v1과 모델은 변경하지 않았습니다.

## 구조와 변경 파일

| 파일/위치                                                                                  | 역할                                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `src/main.tsx`                                                                             | 실제 DB와 Repository 생성 및 Provider 주입, 개발 HMR 시 DB 종료 |
| `src/app/RepositoryProvider.tsx`, `repository-context.ts`                                  | Repository 계약 주입과 저장 후 갱신 신호                        |
| `src/app/plant-service.ts`                                                                 | 실제 조회 데이터 조합, 식물·대표 사진 원자적 저장/교체          |
| `src/hooks/useRepositoryQuery.ts`                                                          | 로딩·오류·성공, 재시도, 오래된 응답 무시, 포커스 재조회         |
| `src/app/routes.tsx`, `AppLayout.tsx`                                                      | 등록·수정 경로 및 자체 헤더 연결                                |
| `src/pages/PlantEditorPage.tsx`                                                            | 등록·수정 화면과 잘못된 ID/조회 오류 처리                       |
| `src/components/plants/PlantForm.tsx`                                                      | 입력 검증, 사진 처리, 중복 제출 차단, 오류 시 입력 보존         |
| `src/components/plants/PlantPhoto.tsx`                                                     | Blob URL 생성·교체·해제와 기본 플레이스홀더                     |
| `src/components/plants/DeletePlantDialog.tsx`                                              | 삭제 확인, 취소·오류·재시도와 중복 삭제 차단                    |
| `src/components/plants/DataFeedback.tsx`                                                   | 조회 로딩·오류 안내                                             |
| `src/lib/plant-photo.ts`                                                                   | MIME·시그니처·용량 검증, 디코딩, 축소·압축, 자원 해제           |
| `src/pages/HomePage.tsx`, `PlantDetailPage.tsx`                                            | 목업 대신 실제 조회 결과 사용, 빈 상태 및 관리 메뉴             |
| `src/components/home/PlantCard.tsx`                                                        | 실제 Plant/사진·관리 기록 표시                                  |
| `src/components/plant-detail/PlantSummary.tsx`, `PlantTimeline.tsx`, `PlantRecordTabs.tsx` | 실제 데이터·Blob 사진·빈 상태 표시                              |
| `src/pages/plant-management.css`                                                           | 등록·수정·빈 상태·확인창 스타일, 키보드 입력 공간 처리          |
| `src/test/render-app.tsx`, `setup.ts`                                                      | 테스트용 Repository 주입·독립 DB, jsdom dialog/URL shim         |
| `src/app/plant-service.test.ts`, `src/lib/plant-photo.test.ts`                             | 원자적 사진 저장·교체·롤백, 파일 검증·압축 테스트               |
| `src/pages/PlantEditorPage.test.tsx`, `src/components/plants/PlantPhoto.test.tsx`          | CRUD 폼·중복 제출·오류 보존·URL 해제                            |
| 기존 홈·상세·라우트 테스트                                                                 | 실제 저장소 fixture로 회귀 검증 전환                            |
| `README.md`, `docs/phase-4a.md`, `docs/screenshots/phase4a-*.jpg`                          | 실행 상태·정책·검증·실제 화면 기록                              |

새 런타임 라이브러리나 DB 스키마 버전 변경은 없습니다.
React 컴포넌트는 도메인의 Repository 계약만 사용하고 Dexie 테이블에 직접 접근하지 않습니다.
DB 생성만 `main.tsx` 조립 지점에서 수행합니다.

## 사진 정책

| 항목        | 정책                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| 선택 경로   | `accept` 지정 갤러리 input과 `capture="environment"` 카메라 input 별도 제공 |
| 지원 형식   | image/jpeg, image/png, image/webp                                           |
| 입력 용량   | 15MiB 이하, 빈 파일 거부                                                    |
| 내용 검증   | MIME과 JPEG/PNG/WebP 헤더 시그니처 대조 후 실제 이미지 디코딩               |
| 입력 해상도 | 디코딩 결과 4,000만 화소 이하. 초과/0 해상도 거부                           |
| 저장 크기   | 비율 유지, 긴 변 최대 1600px, 작은 이미지는 확대하지 않음                   |
| 저장 형식   | JPEG. 투명 PNG/WebP는 크림 배경으로 합성                                    |
| 압축        | 품질 0.82 → 결과가 크면 0.72 → 0.62                                         |
| 출력 상한   | 2MiB 이하. 상한을 충족하지 못하면 저장하지 않고 다른 사진 선택 안내         |
| 촬영 시각   | 현재는 선택/처리 시각을 capturedAt에 사용. EXIF 촬영 시각 추출은 후속 단계  |
| 메타데이터  | Canvas 재인코딩. 원본 파일 자체와 EXIF는 저장하지 않음                      |
| 자원 정리   | 비트맵 close, 임시/표시 Blob URL revoke, 처리 후 canvas 크기 해제           |

디코딩은 createImageBitmap의 EXIF 방향 처리를 사용하고 실패하면 HTMLImageElement로 대체합니다.
HEIC/HEIF는 현재 지원하지 않으며 JPEG 변환을 안내합니다. MIME/시그니처가 맞아도 실제로
디코딩할 수 없는 파일은 거부합니다. 처리 완료 전에 저장 버튼을 활성화하지 않습니다.

## 데이터 일관성

사진 디코딩·리사이징은 DB 트랜잭션 **밖에서** 완료합니다. 이후 다음 작업을 Repository의
`runInTransaction` 하나로 묶습니다.

1. 식물 생성/수정
2. 새 대표 사진 Blob 저장
3. Plant.coverPhotoId 연결/해제
4. 이전 대표 사진 정리

어느 단계에서든 실패하면 이름·사진·참조 모두 롤백합니다. 사진 교체 시 기존 대표 사진이
독립 사진이면 삭제하고, 일기에 첨부된 사진이면 기록 보존을 위해 대표 참조만 해제합니다.
식물 자체 삭제는 기존 Repository의 일기·사진·관리 이벤트 연쇄 삭제를 그대로 사용합니다.

## 검증

자동 검사는 `npm run check`로 타입·린트·포맷·테스트·빌드를 실행합니다.
최종 결과는 10개 테스트 파일·118개 테스트와 타입·린트·포맷·프로덕션 빌드 모두 통과입니다.
기존 Phase 3 Repository 테스트는 유지하며 UI 테스트의 기존 목업 전용 기대값은
실제 저장소 주입/빈 상태/실제 UUID 기준으로 전환했습니다.

검증 범위:

- 실제 식물 등록·수정·삭제, 빈 DB에 자동 목업이 생기지 않음
- 사진 등록·유지·교체·삭제와 대표 사진 참조, 재개방 후 Blob 복원
- 사진 저장·이전 사진 삭제 실패 시 원자적 롤백
- MIME/시그니처·용량·해상도 검증, 압축 재시도와 비트맵/URL 해제
- 이름·날짜 검증, 저장 실패 후 입력·사진 유지, 저장 중 중복 제출 방지
- 삭제 취소, 삭제 실패 후 재시도, 없는 식물 ID와 사진/기록 없는 식물
- 기존 홈·상세 탐색, 탭 접근성, 날짜/물주기/식물등 집계 회귀

### 실제 브라우저 (가상 IndexedDB 대체 없이 실행)

UI를 통해 검증용 식물을 직접 등록했습니다. 자동 seed나 테스트 전용 데이터 삽입 경로는 없습니다.
검증 시작 때 DB는 비어 있었으며, 검증 완료 후 해당 식물은 UI의 확인창을 통해 삭제했습니다.

- 2400×1800 JPEG 선택 → 실제 미리보기와 저장 후 사진 naturalWidth/Height가 1600×1200
- 실제 저장 후 새로고침 → 같은 UUID, 이름, 사진 Blob URL과 이미지 복원
- 홈 식물 수 1 및 실제 ID 상세 이동 확인
- PNG 교체 → 저장 후 이미지가 480px로 변경되고 새로고침에도 유지
- 이름·데려온 날짜 수정 → 재개방한 편집 폼에서 저장 값 복원
- 대표 사진 삭제 → 새로고침 후 플레이스홀더 유지
- 삭제 취소 시 데이터 유지, 삭제 확정 → 홈 개수 0, 새로고침 후에도 빈 목록
- 삭제된 상세 주소 → 찾을 수 없음 안내
- 320·390px에서 문서 너비가 뷰포트와 같음, 식물 카드와 폼 입력 가로 넘침 없음
- 320×460·390×500의 축소 뷰포트와 입력 포커스로 키보드 공간을 모사하여 레이아웃 검증

| 화면             | 320px                                           | 390px                                           |
| ---------------- | ----------------------------------------------- | ----------------------------------------------- |
| 실제 식물 목록   | [홈](screenshots/phase4a-home-320.jpg)          | [홈](screenshots/phase4a-home-390.jpg)          |
| 실제 식물 상세   | [상세](screenshots/phase4a-detail-320.jpg)      | [상세](screenshots/phase4a-detail-390.jpg)      |
| 편집 폼          | [편집](screenshots/phase4a-editor-320.jpg)      | [편집](screenshots/phase4a-editor-390.jpg)      |
| 키보드 공간 모사 | [입력 중](screenshots/phase4a-keyboard-320.jpg) | [입력 중](screenshots/phase4a-keyboard-390.jpg) |
| 빈 목록          | [빈 홈](screenshots/phase4a-empty-320.jpg)      | [빈 홈](screenshots/phase4a-empty-390.jpg)      |

[삭제 확인창](screenshots/phase4a-delete-320.jpg) · [사진 없는 상세](screenshots/phase4a-no-photo-320.jpg) · [삭제된 주소](screenshots/phase4a-missing-320.jpg)

신규 등록 화면: [320px](screenshots/phase4a-register-320.jpg) · [390px](screenshots/phase4a-register-390.jpg)

저장 버튼과 고정 메뉴 여백: [320px](screenshots/phase4a-register-bottom-320.jpg) · [390px](screenshots/phase4a-register-bottom-390.jpg)

## 남은 위험과 범위

- 실제 iOS/Android 카메라·사진 권한·네이티브 소프트 키보드는 물리 기기 검증이 필요합니다.
  데스크톱 실제 브라우저 파일 선택과 모바일 뷰포트/포커스 검증을 네이티브 기기 테스트로 간주하지 않습니다.
- IndexedDB는 기기·브라우저별 로컬 데이터입니다. 브라우저 데이터 삭제·저장 공간 부족에 대비한
  내보내기·백업·서버 동기화는 아직 없습니다. 실패 시 입력을 유지하고 오류를 안내합니다.
- 여러 탭에서 같은 식물을 동시에 수정하는 충돌 감지는 아직 없으며 마지막 저장이 반영됩니다.
  포커스 복귀 시 재조회하지만 실시간 탭 간 동기화는 아닙니다.
- 파일 크기는 디코딩 전에 제한하지만 해상도는 디코딩 후 검사합니다. 저메모리 기기의 매우 큰
  원본 사진 처리와 장치별 인코더 품질 차이는 실기기에서 추가 확인해야 합니다.
- 물주기·일기 생성/삭제, 기록 목록 화면 구현은 후속 단계입니다.

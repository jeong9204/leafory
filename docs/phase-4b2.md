# Phase 4B-2 — 사진 일기

2026-10-25 구현·검증. 기존 Pretendard, 크림·세이지 스타일, 식물 CRUD, 빠른 관리 기록, Dexie v1 모델과 Repository 계약을 유지했다. 신규 라이브러리와 DB 마이그레이션은 없다. commit/push는 하지 않았다.

## 화면과 경로

- 식물 상세의 **일기 쓰기** → `/plants/:id/diary/new`.
- 저장 후 `/plants/:id/diary/:entryId`에서 날짜, 상태, 관찰 메모, 전체 사진을 순서대로 본다. 수정·삭제도 이 화면에서 진입한다.
- `/plants/:id/diary/:entryId/edit`는 기존 값과 사진을 복원한다. 사진 순서 변경·추가·삭제 후 다시 저장할 수 있다.
- 사진 일기 화면 전체에서 하단 네비게이션을 숨긴다. 기존 식물 등록 폼의 카드·입력·버튼 스타일을 재사용한다.
- 타임라인은 첫 사진, 제목, 상태, 사진 수, 본문과 일기 보기·수정 링크를 표시한다. 사진 탭에서도 해당 일기를 열 수 있다. 총 기록 수는 일기 수와 관리 이벤트 수의 합이며 사진 장수는 더하지 않는다.
- 날짜는 사용자 기기의 로컬 `YYYY-MM-DD`로 입력·보관하고 과거 날짜를 허용한다. 사진을 선택한 ISO 시각(`capturedAt`, 기존 사진 처리 정책)과 일기 날짜를 분리한다. 사진 탭의 일기 사진은 일기 날짜를 표시한다.
- 일기의 좋음/보통/걱정은 해당 관찰 시점의 상태다. 식물의 현재 상태나 물주기 필요 여부를 자동 변경하지 않는다.

## 사진·입력 정책

최대 **10장**, JPEG/PNG/WebP, 입력 장당 15MiB 이하. 기존 `preparePlantPhoto`를 재사용해 바이너리 시그니처를 확인하고 4,000만 화소 이하를 허용한다. 긴 변 최대 1600px, JPEG 품질 0.82→0.72→0.62로 장당 2MiB 이하를 목표로 압축하며 기준을 충족하지 못하면 안내한다. 투명도는 크림 배경으로 합성한다. 자세한 기존 정책은 [Phase 4A](phase-4a.md)를 참고한다.

갤러리는 여러 장, 카메라는 한 장씩 선택한다. 디코딩은 순차 실행해 고해상도 이미지의 동시 메모리 사용을 줄인다. 선택한 배치에 잘못된 파일이 있으면 그 배치는 추가하지 않고 기존 첨부 사진을 유지한다. 앞/뒤 이동 버튼은 키보드로도 사용할 수 있고 양 끝 이동은 비활성화한다. 첫 사진이 타임라인 썸네일이다.

일기 날짜와 상태를 입력하며 제목(선택)은 120자, 관찰 메모(선택)는 20,000자까지다. 사진 없이도 일기를 저장할 수 있다.

## 저장 안정성

`src/app/diary-service.ts`가 React와 분리된 `loadDiary`, `saveDiary`, `deleteDiary`를 제공한다.

```ts
const entry = await saveDiary(repositories, plantId, fields, photoDrafts)
const restored = await loadDiary(repositories, plantId, entry.id)
await saveDiary(repositories, plantId, updatedFields, reorderedPhotos, entry.id)
await deleteDiary(repositories, plantId, entry.id)
```

새 사진은 저장 전 메모리에만 존재한다. 기존 사진은 원래 ID를 유지하고 `sortOrder`만 수정한다. 사진 처리 완료 후 일기 생성/수정, 빠진 사진 삭제, 기존 사진 순서 수정, 새 Blob 저장을 **하나의 `runInTransaction`**에서 수행한다. 도중 실패하면 일기·사진·순서 변경을 모두 롤백한다. 다른 식물의 일기나 다른 일기의 사진 ID는 거부한다.

삭제는 확인창을 거쳐 기존 Diary Repository의 연결 사진 정리를 사용한다. 해당 일기의 사진만 삭제하며 다른 일기·별도 대표 사진·CareEvent는 보존한다. 삭제 사진을 대표 사진으로 가리키던 특수한 경우에는 기존 Repository가 참조도 해제한다.

성공 후 Provider revision으로 상세 타임라인·사진 탭·통계를 다시 조회한다. 처리/저장 중에는 입력과 제출을 비활성화하고 ref 잠금으로 중복 저장을 막는다. 실패하면 내용·선택 사진·순서를 유지하며 재시도할 수 있다. Blob URL은 기존 `PlantPhoto`가 사진 제거·교체·언마운트 때 해제한다. 이탈 확인은 필드·사진 추가/삭제/순서 변경과 처리 중 상태를 포함한다. 새로고침/탭 종료는 기존 `beforeunload` 확인을 사용한다.

## 검증 결과

`npm run check` 통과: 타입 검사, ESLint 경고 0, Prettier, **14개 파일 / 157개 테스트**, 프로덕션 빌드.

기존 140개 회귀 테스트를 유지하고 일기 버튼 활성화와 실제 라우팅에 대한 기대값만 갱신했다. 신규 서비스 10개 + UI 7개 테스트는 다음을 검증한다.

- 과거 날짜 일기 생성·조회·수정·삭제와 통계 갱신.
- 다중 사진 Blob 저장·DB 재개방·순서 복원, 재정렬·추가·삭제 및 첫 썸네일 변경.
- 일기 삭제 후 다른 일기·대표 사진·물주기 보존.
- 두 번째 사진 저장 실패, 수정 중 실패, 삭제 중 실패의 롤백.
- 잘못된 날짜·ID·장수·형식, 다른 일기 사진 ID/중복 ID 거부.
- 저장 중 중복 제출 방지, 저장 실패 시 내용·사진 유지와 재시도.
- 삭제 확인 취소·실패·재시도, 이탈 취소 시 입력 유지, Blob URL 해제.

Node 테스트에서는 fake-indexeddb를 독립 DB로 사용한다. jsdom Blob은 Node structuredClone 대상이 아니므로 새 UI 테스트의 Blob만 Node Blob으로 맞춰 실제 IndexedDB 복제를 검증한다. 제품 코드는 브라우저 Blob을 그대로 사용한다.

## 실제 브라우저 QA

기존 사용 데이터가 있는 `127.0.0.1:5173`와 분리해 `127.0.0.1:5174`에서 검증용 식물을 직접 등록했다. DB 주입·자동 시드는 없다.

1. 실제 생성 에셋 사진 두 장 선택 → 파일 검증·압축·미리보기 완료.
2. 날짜 2026-10-20, 상태 좋음, 제목·여러 줄 메모 입력. 사진 두 번째를 앞으로 옮겨 저장.
3. 새로고침 후 날짜·내용·사진 두 장 복원 및 이미지 디코딩 완료 확인.
4. 수정에서 순서 변경·한 장 삭제·제목 변경. 이탈 확인에서 계속 작성 선택 후 저장. 다시 새로고침해 사진 한 장과 수정 내용 복원 확인.
5. 타임라인의 첫 사진·상태·장수·총 기록 1개 및 사진 탭의 한 장 확인.
6. 기존 식물등 90분과 홈 물주기를 추가해 총 3개 확인.
7. 일기 삭제 후 총 2개, 물주기 날짜와 식물등 90분 보존. 새로고침 후에도 유지되며 사진 탭은 빈 상태.
8. 320×760, 390×844에서 작성·상세·타임라인 캡처. document scrollWidth가 viewport와 일치하고 가로 넘침·컨트롤 겹침 없음. Pretendard 유지, 폼 네비게이션 없음. 콘솔 오류/경고 없음.

검증 완료 후 5174에서 직접 등록한 식물과 연결 기록을 정리해 빈 상태로 복원했다. 5173의 기존 사용자 데이터는 변경하지 않았다.

저장 실패·롤백·중복 클릭은 자동 테스트의 지연/오류 주입으로 검증했다. 실기기 카메라 권한과 iOS/Android 키보드는 데스크톱 뷰포트 검사 범위 밖이다. 브라우저 저장 공간이 지워지면 데이터가 사라질 수 있으며 백업·서버 동기화는 이번 범위에 포함하지 않는다. 동시 편집은 기존처럼 마지막 저장이 적용되고 초안 자동 저장은 없다.

## 변경 파일

| 구분                  | 파일                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 일기 서비스·테스트    | `src/app/diary-service.ts`, `diary-service.test.ts`                                                                                                             |
| 일기 작성·수정·상세   | `src/pages/DiaryEditorPage.tsx`, `DiaryDetailPage.tsx`, `DiaryEditorPage.test.tsx`                                                                              |
| 다중 사진·삭제 확인   | `src/components/diary/DiaryPhotos.tsx`, `DeleteDiaryButton.tsx`                                                                                                 |
| 라우팅·네비게이션     | `src/app/routes.tsx`, `routes.test.tsx`, `AppLayout.tsx`                                                                                                        |
| 상세·타임라인·사진 탭 | `src/app/plant-service.ts`, `src/pages/PlantDetailPage.tsx`, `PlantDetailPage.test.tsx`, `src/components/plant-detail/PlantTimeline.tsx`, `PlantRecordTabs.tsx` |
| 스타일·문서           | `src/pages/plant-management.css`, `README.md`, 이 문서와 캡처                                                                                                   |

## 캡처

- [작성 320px](screenshots/phase4b2-editor-320.jpg) / [작성 390px](screenshots/phase4b2-editor-390.jpg)
- [일기 상세 320px](screenshots/phase4b2-diary-320.jpg) / [일기 상세 390px](screenshots/phase4b2-diary-390.jpg)
- [혼합 타임라인 320px](screenshots/phase4b2-timeline-320.jpg) / [혼합 타임라인 390px](screenshots/phase4b2-timeline-390.jpg)
- [삭제 확인 320px](screenshots/phase4b2-delete-320.jpg) / [삭제 후 관리 기록 보존](screenshots/phase4b2-after-delete-320.jpg)

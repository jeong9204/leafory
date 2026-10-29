# Phase 10 식물등 타이머

## 저장과 호환성

- Dexie v2는 v1의 plants, diaries, photos, careEvents를 그대로 두고 `timerState` 테이블(`id, plantId`)만 추가합니다. 마이그레이션에서 기존 데이터·사진 Blob을 변환하거나 초기화하지 않습니다.
- 타이머는 `id: grow-light` 하나만 저장합니다. `sessionId` UUID, 식물 ID, 시작 시각, running/paused, 현재 구간 시작 시각, 누적 밀리초, revision, 갱신 시각을 보관합니다.
- React는 `repositories.lightTimer`만 사용합니다. 시작·일시정지·재개 때 상태를 저장하고 화면의 1초 interval은 현재 시각으로 다시 그리기만 합니다. DB에 매초 쓰지 않습니다.
- 실행 시간은 `accumulatedMs + max(0, 현재 시각 - runningSince)`입니다. 앱 종료·백그라운드 정지 이후에도 복귀 시 다시 계산하며 일시정지는 누적하지 않습니다. 다른 창의 변경은 복귀 및 5초 조회로 확인합니다.
- ZIP 형식은 v1 그대로이며 기존 4개 테이블과 사진만 포함합니다. 진행 중·일시정지 타이머는 기기에만 남고 ZIP에는 포함되지 않습니다. 완료 후 백업을 권장합니다. 기존 ZIP을 v2 DB에 복원할 수 있습니다.

## API

```ts
const timer = await repositories.lightTimer.start(plantId)
const paused = await repositories.lightTimer.pause(
  timer.sessionId,
  timer.revision,
)
const resumed = await repositories.lightTimer.resume(
  paused.sessionId,
  paused.revision,
)
// 종료 전 먼저 pause해 확인하는 동안 시간을 고정합니다.
const stopped = await repositories.lightTimer.pause(
  resumed.sessionId,
  resumed.revision,
)
await repositories.lightTimer.finish(stopped.sessionId, stopped.revision)
// 기록 없이 취소: discard(sessionId, revision)
// 재실행 복구: get()
```

- 모든 쓰기는 Dexie 트랜잭션입니다. 시작은 고정 키와 트랜잭션으로 하나만 허용합니다. revision은 다른 창의 오래된 조작을 거부합니다.
- 종료 확인 시 사용 시간을 고정합니다. 돌아가기를 누르면 정지 상태를 유지하며 재개 버튼으로 계속 측정할 수 있습니다.
- 종료는 기존 형식의 `grow_light` CareEvent 생성과 타이머 삭제를 한 트랜잭션에서 처리합니다. 하나라도 실패하면 모두 롤백합니다. sessionId를 기록 ID로 사용해 완료 재요청은 동일한 기록을 반환합니다.
- `durationMinutes`는 기존 정책대로 양의 정수입니다. 누적 시간에서 분 미만은 버리고 실제 HH:mm:ss는 메모에 보존합니다. 1분 미만은 명시적으로 확인한 뒤 기록 없이 종료합니다.
- 완료 기록은 메모의 `식물등 타이머 자동 기록` 문구로 구분합니다. 별도 CareEvent 필드를 추가하지 않았으며 사용자가 메모를 수정하면 구분 문구도 바뀔 수 있습니다.
- 일시정지/종료한 시각을 `occurredAt`으로 저장합니다. 자정을 넘겨도 하나의 기록이며 전체 분량이 종료 날짜 통계에 반영됩니다. 날짜별 분할은 하지 않습니다. 일시정지 후 다음 날 완료를 확인해도 마지막 측정 종료 날짜를 유지합니다.

## 실패와 데이터 보호

- 버튼 중복 제출을 잠그고 저장 실패 시 진행 상태와 종료 확인 내용을 유지합니다. 다시 시도할 수 있습니다. 다른 창에서 상태가 달라지면 확인 창을 닫고 최신 상태를 조회합니다.
- 타이머 소유 식물 삭제는 차단합니다. 삭제 확인을 닫고 상세에서 종료 또는 기록 없이 취소한 뒤 다시 삭제합니다. 다른 식물은 삭제할 수 있습니다.
- 전체 교체 복원은 실행/정지 타이머가 있으면 트랜잭션 안에서 차단합니다. 백업 화면의 ‘타이머 식물로 이동’으로 종료/취소한 뒤 복원합니다. 기존 데이터는 차단 시 그대로 보존합니다.
- 기기 시각이 이전 저장 시각보다 뒤로 바뀌면 pause/resume을 거부하고 안내합니다. 시각을 바로잡거나 기록 없이 취소할 수 있습니다. 앞으로 바뀐 시각은 경과 시간에 영향을 줍니다. 서버 시계·실제 조명 제어·알림 기능은 제공하지 않습니다.
- 수동 식물등 기록, 기존 사진/일기/관리 이벤트는 타이머 조작으로 변경하지 않습니다.

## 검증

독립된 fake-indexeddb DB에서 실행·정지·재개·완료, 중복/오래된 조작, 닫기/재열기, 자정·연도 경계, 쓰기 실패·원자적 롤백·재시도, 식물 삭제 차단, ZIP v1 내보내기/복원, v1→v2 식물·Blob 보존을 검증합니다. UI 테스트는 통계/타임라인 갱신, 종료 확인 취소, 1분 미만 종료, 다른 식물 이동, 저장 실패, 삭제·복원 차단 후 취소 경로를 검증합니다.

실제 브라우저 QA는 사용자 DB와 별개인 `leafory-phase10-qa-20261027-resume`에 공개 샘플 식물 사진만 저장합니다. 320/390/402px 캡처는 `screenshots/phase-10/`에 보관합니다. 브라우저 viewport 검사이며 iPhone PWA 실기기 검사를 대신하지 않습니다. 실기기에서는 실행 중 홈으로 나가기/화면 잠금/앱 닫기 후 복구, 정지 상태 복구, 종료 확인 중 재실행, safe-area와 홈 인디케이터를 추가 확인합니다.

## 최종 결과와 변경 파일

- `npm run check`: 타입·린트·포맷·33개 파일 / 323개 테스트·빌드 통과. PWA 셸·지연 청크·폰트·아이콘 32개 precache 확인.
- 브라우저: 320/390/402px 가로 넘침 없음. 타이머 주요 버튼 높이 48px. 실행·정지 상태 새로고침 복구, 완료 후 2분 / 기록 1개 반영과 재실행 유지 확인. 페이지 끝에서 식물 메모 하단 743.8px, 고정 네비게이션 시작 768px로 겹침 없음(390×844).
- 일시정지 390px: [캡처](screenshots/phase-10/timer-paused-390.jpg)
- 실행 중 320px: [캡처](screenshots/phase-10/timer-running-320.jpg)
- 종료 확인 402px: [캡처](screenshots/phase-10/timer-confirm-402.jpg)
- 완료·통계·타임라인 390px: [캡처](screenshots/phase-10/timer-completed-390.jpg)

변경 파일:

- 도메인: `src/domain/models.ts`, `src/domain/repositories.ts`, `src/domain/light-timer.ts`
- 로컬 저장: `src/data/local/database.ts`, `src/data/local/repositories.ts`, `src/data/local/light-timer.ts`
- 화면: `src/components/timer/LightTimerCard.tsx`, `src/components/timer/light-timer.css`, `src/pages/PlantDetailPage.tsx`
- 삭제·복원 안내: `src/components/plants/DeletePlantDialog.tsx`, `src/pages/BackupPage.tsx`, `src/app/backup-service.ts`
- 테스트: `src/data/local/repositories.test.ts`, `src/data/local/light-timer.test.ts`, `src/components/timer/LightTimerCard.test.tsx`, `src/pages/BackupPage.test.tsx`
- 문서: `README.md`, 본 문서와 위 캡처 4장

브랜치는 `test/iphone-pwa`이며 커밋·push·배포를 실행하지 않았습니다. 임시 QA 진입 소스는 제거했으며 사용자 기본 DB는 열거나 초기화하지 않았습니다. 새 의존성은 추가하지 않았습니다.

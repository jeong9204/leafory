# Phase 5 — 로컬 데이터 백업·복원

2026-10-26. 기존 Pretendard·크림/세이지 스타일과 식물·관리 기록·사진 일기 기능을 유지했다. Dexie 스키마와 저장소 이름은 그대로다.

## 먼저 완료한 Git 정리

Phase 4B-2의 변경·미추적 파일과 비밀 키 패턴·환경변수·DB/임시 파일을 점검했다. 정상 동작하던 157개 테스트 및 전체 검사를 통과한 상태를 별도 커밋했다.

- 커밋: `cd8be0db64b43dbf268ff2dc0057ca953f3487b2`
- 메시지: `feat: implement plant photo diary`
- 원격: `https://github.com/jeong9204/leafory.git`, `main`
- Push 성공 후 원격 직접 조회로 커밋 해시 일치, ahead/behind 0/0과 깨끗한 작업 트리를 확인한 뒤 Phase 5를 시작했다.

Phase 5 변경은 commit/push하지 않았다. 기존 사용자 DB와 소스를 삭제·초기화하지 않았다.

## 사용법과 UI

홈 하단 **데이터 백업·복원** → `/backup`으로 이동한다. 기존 홈·상세·일기 레이아웃은 이 진입 링크 외에 변경하지 않았다.

1. 내보내기의 **백업 파일 만들기**를 누른다.
2. 파일 생성 후 **ZIP 다운로드**를 눌러 기기에 저장한다. 비동기 생성 뒤 별도의 사용자 클릭으로 다운로드하도록 해 모바일에서도 저장 동작을 분명히 했다. 파일 앱/다운로드 폴더에서 저장 완료를 확인한다.
3. 가져오기의 **백업 ZIP 선택**으로 파일을 고른다. ZIP과 메타데이터·사진·연결 관계를 검증할 뿐 이 단계에서는 DB를 변경하지 않는다.
4. 검증 완료 화면에서 백업 생성 시각과 식물·일기·사진·관리 기록 수를 확인한다.
5. **복원 내용 확인**에서 현재 데이터 개수와 전체 교체 위험을 확인한다. 현재 데이터를 먼저 내보내도록 권장하고, 동의 체크와 **전체 교체 복원**을 모두 거친 경우에만 저장한다. 취소는 아무것도 바꾸지 않는다.

전체 교체만 지원하며 병합·부분 복원은 없다. 복원은 빈 백업으로 전체 데이터를 비우는 경우에도 동일한 확인을 요구한다. 백업은 암호화되지 않은 개인 기록 파일이므로 안전한 보관 장소를 사용한다.

## ZIP 형식 v1

```text
leafory-backup-<UTC timestamp>.zip
├── metadata.json
└── photos/
    └── <photo UUID>.jpg | .png | .webp
```

```json
{
  "format": "leafory-backup",
  "formatVersion": 1,
  "createdAt": "2026-10-26T00:00:00.000Z",
  "data": {
    "plants": [],
    "diaries": [],
    "photos": [],
    "careEvents": []
  }
}
```

사진 메타데이터는 기존 `DiaryPhoto`의 `blob`을 제외한 필드에 `path`를 추가한다. 원본 Blob 바이트는 별도 파일로 보관하고 크기·MIME·시그니처를 검증한다. 원본 파일을 다시 압축/리사이징하지 않는다. ID·대표 사진·일기 사진 연결·정렬 순서·기록 시각을 보존한다. 일기 날짜는 로컬 `YYYY-MM-DD` 그대로이며, ISO 시각은 기존 저장소 규칙처럼 UTC 표현으로 정규화한다. 내보내기 시 이미 UTC인 시각은 복원 후에도 동일하다.

ZIP 생성·해제에는 `fflate@0.8.3`을 사용한다. 사진은 ZIP 내부 STORE 방식, JSON은 DEFLATE 방식이다. MIT 원문은 `public/licenses/fflate-MIT.txt`에 포함했다. ZIP 처리 코드는 백업 경로 진입 때만 로드되도록 분리했다.

## 검증과 제한

MVP는 메모리에서 처리하므로 다음 제한을 둔다.

- ZIP 파일과 압축 해제 데이터 합계 각각 최대 **100MiB**.
- `metadata.json` 최대 **10MiB**, 사진 장당 최대 **15MiB**.
- 컬렉션별 최대 10,000개, ZIP 최대 10,001개 항목.
- JPEG·PNG·WebP만 지원. ZIP64·분할 ZIP·암호화 ZIP·ZIP 주석·허용되지 않은 파일 경로/추가 파일은 지원하지 않는다. 앱에서 만든 표준 백업 파일을 대상으로 한다.

압축 해제 전 중앙/로컬 헤더, 항목 수·파일 크기·경로·중복 이름·데이터 범위를 검사한다. 해제 후 길이와 CRC32 무결성을 확인한다. 이후 버전·생성 시각·배열/필수 필드·날짜·UUID·상태·사진 파일 존재/MIME/시그니처·중복 ID·소속 관계·대표 사진 연결을 검증한다. 지원하지 않는 버전은 추정해서 가져오지 않는다.

내보낼 데이터 역시 스냅샷과 모델을 검증한다. 크기 제한을 초과하는 경우 기존 데이터는 그대로이며 백업 범위 확대/스트리밍 지원은 후속 작업이다. CRC는 파일 손상을 확인하는 체크섬이며 발신자 인증이나 암호화 기능은 아니다.

## 저장소와 안정성

- `Repositories.backup.snapshot()` — 4개 테이블을 하나의 읽기 트랜잭션으로 일관되게 조회.
- `Repositories.backup.counts()` — 복원 위험 안내용 현재 개수.
- `Repositories.backup.replace(data)` — 모델·참조를 재검증하고 4개 테이블 전체 clear/bulkAdd를 하나의 쓰기 트랜잭션으로 실행. 실패를 삼키지 않아 전체 롤백한다.
- `exportBackup(repositories)` — `{blob, filename, counts}`.
- `prepareBackup(blob)` — DB에 쓰지 않고 검증한 `{data, createdAt, counts, sizeBytes}`.
- `restoreBackup(repositories, prepared)` — 전체 교체를 호출하고 오류를 호출자에게 전달.

이미지 디코딩·ZIP 처리·파일 선택·사용자 확인은 DB 트랜잭션 밖에서 완료한다. ID와 타임스탬프를 새로 발급하는 CRUD를 복원에 재사용하지 않고 전체 스냅샷 계약으로 기존 ID와 연결을 보존한다. React 컴포넌트는 Dexie를 직접 호출하지 않는다.

ref 잠금과 버튼 비활성화로 내보내기/검증/복원의 중복 실행을 막는다. 처리 중 이탈은 기존 보호 훅으로 확인한다. 실패한 복원은 파일의 검증 결과를 유지해 재시도할 수 있고, 다운로드용 Blob URL은 파일 교체/페이지 종료 때 해제한다.

`navigator.storage.estimate()`를 사용할 수 있으면 남은 공간과 복원 크기를 비교해 경고한다. 이 추정치는 보장이 아니므로 공간이 충분해 보여도 IndexedDB 실패를 처리한다. QuotaExceededError는 원인 체인까지 확인해 공간 부족과 원본 보존을 안내한다. 브라우저 종료/메모리 부족에 대비해서는 복원 전 별도의 파일 백업을 실제로 다운로드하는 것이 필요하다.

## 테스트와 실제 브라우저 검증

`npm run check` 통과: 타입·린트·포맷, **16개 파일 / 188개 테스트**, 프로덕션 빌드. 기존 157개 테스트를 유지했다.

새 서비스/저장소 25개와 UI 6개 테스트에서 전체 데이터·빈 백업·Blob·시각/ID/관계/순서의 왕복 일치·DB 재개방, 손상 ZIP/CRC/크기/중복 경로, 잘못된 버전/구조/필드/관계/날짜/시간, 일부 쓰기 실패 후 전체 롤백, 동의/취소, 검증 실패 시 쓰기 금지, 중복 실행, 공간 부족과 재시도, 다운로드 URL 해제를 검증한다. ISO 오프셋 시각을 UTC로 복원하는 경우도 확인했다.

실제 브라우저는 기존 사용자 origin인 `127.0.0.1:5173`과 분리된 `127.0.0.1:5174`에서 검증했다.

1. 대표 사진이 있는 식물 1개, 사진 일기 1개, 사진 총 2개, 물주기·식물등 이벤트 2개를 UI로 직접 등록.
2. ZIP을 실제로 다운로드하고 파일의 JSON/사진 파일/버전/생성 시각과 CRC를 독립 ZIP 리더로 확인.
3. 추가 식물을 등록해 현재 2개 상태를 만든 뒤 다운로드한 원래 ZIP을 선택. 검증 단계에서는 2개가 유지됨을 확인.
4. 320px/390px에서 현재/백업 개수, 전체 교체 안내, 기본 취소 포커스와 미동의 복원 버튼 비활성 상태 확인.
5. 동의 후 복원 → 식물 1개·일기 1개·사진 2개·관리 이벤트 2개. 새로고침 후에도 유지.
6. 원래 식물 ID의 상세에서 대표 사진·일기 사진이 실제로 디코딩됐고, 총 기록 3개·물주기 날짜·식물등 90분·일기 본문이 보존됨을 확인. 백업 후 추가한 식물은 사라짐.
7. 손상된 ZIP을 실제로 선택 → 오류 안내, 원본 개수 유지, 복원 버튼 없음.
8. 320×760 / 390×844에서 가로 scrollWidth가 viewport와 일치함을 확인. 기존 Pretendard·카드 스타일 유지, 콘솔 오류/경고 없음.

검증 후 5174에서 직접 생성한 식물과 연결 기록만 정리해 초기 빈 상태로 되돌렸다. 기존 5173 사용자 데이터는 그대로 유지됐다. 다운로드한 검증용 ZIP은 Git에 포함하지 않았다.

실제 iOS/Android 파일 앱·저장 권한·다운로드 위치는 데스크톱 모바일 뷰포트로 완전히 대체할 수 없으므로 기기별 확인이 남는다. 대용량의 최대치 스트레스 테스트도 이번 작은 실제 브라우저 샘플과 구분한다. 서버 업로드·자동 백업·클라우드 동기화·암호화·병합은 구현하지 않았다.

## 변경 파일

| 구분               | 파일                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 스냅샷 계약·검증   | `src/domain/backup.ts`, `src/domain/repositories.ts`, `src/domain/README.md`                                     |
| 원자적 스냅샷·교체 | `src/data/local/repositories.ts`, `README.md`                                                                    |
| ZIP 헤더·크기·CRC  | `src/lib/backup-zip.ts`                                                                                          |
| 백업 서비스·테스트 | `src/app/backup-service.ts`, `backup-service.test.ts`                                                            |
| UI·테스트·스타일   | `src/pages/BackupPage.tsx`, `BackupPage.test.tsx`, `backup.css`                                                  |
| 진입·코드 분리     | `src/pages/HomePage.tsx`, `src/app/routes.tsx`, `AppLayout.tsx`, `src/main.tsx`                                  |
| 의존성·고지·문서   | `package.json`, `package-lock.json`, `public/licenses/fflate-MIT.txt`, `.gitignore`, `README.md`, 이 문서와 캡처 |

로컬 백업 파일의 우발적 커밋을 막기 위해 `leafory-backup-*.zip`을 Git에서 제외한다.

## 캡처

- [백업 관리 320px](screenshots/phase5-backup-320.jpg) / [390px](screenshots/phase5-backup-390.jpg)
- [검증 완료 미리보기 320px](screenshots/phase5-preview-320.jpg)
- [교체 확인 320px](screenshots/phase5-confirm-320.jpg) / [390px](screenshots/phase5-confirm-390.jpg)
- [복원 후 사진과 통계 390px](screenshots/phase5-restored-390.jpg)
- [손상 파일 오류·기존 개수 유지](screenshots/phase5-invalid-390.jpg)

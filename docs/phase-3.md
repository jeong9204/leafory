# Phase 3 — 데이터 모델과 Dexie 로컬 저장소

홈·상세 화면과 기존 목업·라우트·스타일은 변경하지 않았습니다.
이번 단계는 데이터 계층만 구현했으며 앱 시작 지점에서 DB를 생성하거나 Repository를 연결하지 않습니다.

## 변경 파일

| 파일                                               | 역할                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `src/domain/models.ts`                             | 네 모델, UUID·날짜 별칭, 생성·수정 입력, 구분 가능한 타임라인 타입 |
| `src/domain/repositories.ts`                       | CRUD·목록·조회·트랜잭션 인터페이스                                 |
| `src/domain/calendar.ts`                           | 사용자 로컬 날짜와 달력 일수 계산                                  |
| `src/domain/validation.ts`                         | 저장 경계에서 필수 필드·날짜·UUID·상태·시간·사진 검증              |
| `src/domain/errors.ts`                             | RepositoryError와 오류 코드                                        |
| `src/data/local/database.ts`                       | Dexie DB 클래스와 버전 1 스키마                                    |
| `src/data/local/repositories.ts`                   | 관계 검증, CRUD, 연쇄 삭제, 조회와 집계 구현                       |
| `src/data/local/repositories.test.ts`              | CRUD·조회·Blob·관계·롤백·재개방 테스트                             |
| `src/data/local/validation.test.ts`                | 잘못된 입력과 로컬 시간대·DST 경계 테스트                          |
| `src/domain/README.md`, `src/data/local/README.md` | 계층별 역할 안내                                                   |
| `package.json`, `package-lock.json`                | 개발 의존성 fake-indexeddb 6.2.6 추가                              |
| `README.md`, `docs/phase-3.md`                     | 프로젝트 상태와 API 사용 문서                                      |

## 모델

모든 ID와 외래 키는 UUID 문자열입니다. 기본 ID는 `crypto.randomUUID()`로 생성하며,
명시한 UUID도 허용합니다. 런타임에서도 UUID 형식을 검증합니다.

| 모델       | 필드                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Plant      | id, name, species?, acquiredAt?, status: healthy/observing/concern, memo?, coverPhotoId?, createdAt, updatedAt               |
| DiaryEntry | id, plantId, entryDate, condition: good/normal/concern, title?, content?, createdAt, updatedAt                               |
| DiaryPhoto | id, plantId, entryId?, blob: Blob, mimeType, capturedAt, createdAt, sortOrder                                                |
| CareEvent  | id, plantId, eventType: watering/grow_light/repotting/fertilizing, occurredAt, durationMinutes?, memo?, createdAt, updatedAt |

`LocalDate`, `IsoDateTime`, `UUID`는 문자열 타입 별칭이며 유효성은 Repository 경계에서 검사합니다.
`id`·`plantId`·`createdAt`·`updatedAt`은 수정 입력에서 제외하고 런타임에서도 임의 변경을 거부합니다.
선택 필드는 update 시 `undefined`로 지울 수 있습니다. 자식 기록을 다른 식물로 이동하지 않습니다.

사진은 Blob 자체와 MIME type을 저장합니다. 촬영 시각 `capturedAt`은 시간대가 포함된 ISO datetime,
생성 시각 `createdAt`은 저장 시각입니다. EXIF 추출이나 이미지 리사이즈는 이 계층의 역할에 포함하지 않습니다.
비어 있는 Blob, 이미지가 아닌 MIME, Blob.type과 다른 MIME, 음수/소수 정렬 순서는 거부합니다.

## DB 버전 1

기본 DB 이름은 `leafory`이고 생성자에 다른 이름을 전달할 수 있습니다.
모든 테이블은 자동 증가 키가 아닌 명시적 UUID 기본 키 `id`를 사용합니다.

| 테이블     | 기본 키와 인덱스 (`stores` 문자열)                       |
| ---------- | -------------------------------------------------------- |
| plants     | `id, createdAt`                                          |
| diaries    | `id, plantId, [plantId+entryDate]`                       |
| photos     | `id, plantId, entryId, [plantId+sortOrder]`              |
| careEvents | `id, plantId, [plantId+occurredAt], [plantId+eventType]` |

문자열에 나열하지 않은 필드도 저장됩니다. Blob과 긴 본문은 인덱싱하지 않습니다.
스키마를 바꿀 때는 기존 v1을 수정하는 대신 새 버전과 마이그레이션을 추가해야 합니다.

## Repository API

`createLocalRepositories(db)`가 `Repositories` 계약을 반환합니다.
각 API는 Promise를 반환하며 실패를 숨기거나 빈 배열로 바꾸지 않습니다.

| API                                            | 동작                                                  |
| ---------------------------------------------- | ----------------------------------------------------- |
| plants.create / getById / update / delete      | 식물 CRUD                                             |
| plants.list()                                  | 전체 식물, 생성 시각 내림차순                         |
| diaries.create / getById / update / delete     | 일기 CRUD                                             |
| diaries.listByPlant(plantId)                   | 일기 날짜 내림차순, 동률이면 생성 시각과 ID           |
| photos.create / getById / update / delete      | 이미지 Blob CRUD                                      |
| photos.listByPlant(plantId)                    | sortOrder 오름차순, 동률이면 생성 시각과 ID           |
| careEvents.create / getById / update / delete  | 관리 이벤트 CRUD                                      |
| careEvents.listByPlant(plantId)                | occurredAt 내림차순                                   |
| queries.recentTimeline(plantId, limit = 20)    | 일기와 관리 이벤트 통합 목록                          |
| queries.lastWateringAt(plantId)                | 최신 watering의 UTC ISO 시각 또는 undefined           |
| queries.daysSinceLastWatering(plantId, today?) | 최신 watering 기준 로컬 달력 경과 일수 또는 undefined |
| queries.growLightMinutes(plantId, date)        | 해당 로컬 날짜에 기록한 식물등 분 합계                |
| queries.totalRecordCount(plantId)              | 일기 수 + 관리 이벤트 수. 사진은 중복 계산하지 않음   |
| runInTransaction(work)                         | 여러 Repository 호출을 하나의 원자적 작업으로 실행    |

유효한 ID가 없는 `getById`는 undefined를 반환합니다. 없는 ID 수정·삭제, 없는 부모를 참조하는
생성·목록·집계는 NOT_FOUND입니다. 잘못된 UUID는 VALIDATION입니다.
동일한 ID 생성은 덮어쓰지 않고 CONFLICT를 반환합니다. ID는 테이블별로 유일합니다.

타임라인 항목은 `{ id, recordType, date, record }`입니다.
recordType은 `diary` 또는 `care_event`이며 원래 ID와 전체 원본 레코드를 유지합니다.
날짜는 일기의 entryDate 또는 이벤트 시각의 사용자 로컬 날짜입니다.
날짜 내림차순, 같은 날이면 이벤트 발생 시각/일기 생성 시각, 이후 타입·ID로 안정 정렬합니다.
날짜만 있는 일기에 가상의 촬영·발생 시각을 만들어 저장하지 않습니다.

## 날짜와 관리 정책

- entryDate와 acquiredAt은 시간대 없는 실제 달력 날짜 `YYYY-MM-DD`입니다.
- 일기를 쓸 날짜는 `localDateKey()`로 사용자 장치의 현지 날짜를 계산해 명시적으로 전달합니다.
- createdAt/updatedAt은 저장소가 생성합니다. occurredAt과 capturedAt도 입력 시 시간대를 요구하고 UTC로 정규화합니다.
- 날짜 표시용 문자열은 DB에 저장하지 않습니다. 표시 형식은 향후 UI 계층이 결정합니다.
- 이벤트의 날짜별 집계는 **조회 시 장치 시간대**를 기준으로 합니다. 시간대를 바꾸면 이벤트의 날짜 귀속도 바뀔 수 있고, 일기의 entryDate는 그대로입니다.
- grow_light는 durationMinutes에 양의 안전한 정수를 반드시 지정합니다. 소수 시간이나 시간 문자열은 저장하지 않습니다.
- 날짜별 식물등 합계는 **occurredAt이 속한 날짜에 기록된 사용 분**을 합산합니다. 시작/종료 세션 모델이 아니므로 자정을 넘는 사용 시간을 날짜별로 쪼개지 않습니다.
- 마지막 물주기는 createdAt이나 입력 순서가 아닌 watering 이벤트의 occurredAt으로 계산합니다. 수정·삭제 후에도 즉시 다시 조회합니다.
- 경과 일수는 시간 차이를 24시간으로 나누지 않고 로컬 달력 날짜 차이로 계산합니다. 기록이 없으면 undefined, 기준일보다 미래면 0입니다.
- 물을 주지 않은 기간만으로 물주기 필요 상태를 판단하거나 Plant.status를 변경하지 않습니다.
- Plant에는 마지막 물주기나 식물등 누적 시간을 중복 저장하지 않습니다.

## 관계·삭제·트랜잭션

IndexedDB에 외래 키 제약이 없으므로 Repository에서 부모 존재와 소유 관계를 검증합니다.
사진의 entryId와 식물의 coverPhotoId는 같은 식물에 속해야 합니다.

- 식물 삭제: 해당 식물의 모든 일기·사진(독립 사진 포함)·관리 이벤트를 함께 삭제
- 일기 삭제: 첨부 사진도 삭제, 삭제되는 사진을 가리키는 대표 사진 참조 해제
- 사진 삭제: 해당 대표 사진 참조 해제. 일기는 유지
- 대표 사진은 사진을 저장한 뒤 Plant.update로 연결. 대표 사진 참조 정리 시 Plant.updatedAt 갱신

각 CRUD는 네 테이블을 범위로 한 rw 트랜잭션으로 수행합니다. 외래 관계 확인과 저장 사이의 경쟁을 막고,
연쇄 삭제 중 예외가 발생하면 앞서 수행한 변경도 되돌립니다. 복합 조회도 r 트랜잭션 안에서 일관된 결과를 읽습니다.
현재 규모에 맞춰 단순한 전체 테이블 트랜잭션 범위를 사용하며, 대규모 데이터 최적화는 후속 작업입니다.

`runInTransaction` 안에서는 Repository 작업만 await하세요. 네트워크·파일 읽기·타이머 같은 외부 비동기 작업은
트랜잭션 전에 완료합니다. Dexie의 자동 커밋 때문에 트랜잭션 안에서 임의의 외부 await를 허용하지 않습니다.
오류는 트랜잭션 밖에서 처리하고, 콜백 내부에서 삼켜 부분 커밋하도록 만들지 않습니다.

## 사용 예시 (향후 조립 지점, 현재 UI에 연결하지 않음)

```ts
import { LeaforyDatabase } from '../src/data/local/database'
import { createLocalRepositories } from '../src/data/local/repositories'
import { localDateKey } from '../src/domain/calendar'
import { RepositoryError } from '../src/domain/errors'
import type { Repositories } from '../src/domain/repositories'

const db = new LeaforyDatabase('leafory')
const repositories: Repositories = createLocalRepositories(db)

const plant = await repositories.plants.create({
  name: '괴마옥',
  species: 'Euphorbia bupleurifolia',
  acquiredAt: localDateKey(),
  status: 'observing',
})
const entry = await repositories.diaries.create({
  plantId: plant.id,
  entryDate: localDateKey(),
  condition: 'good',
  title: '새잎 확인',
})
await repositories.careEvents.create({
  plantId: plant.id,
  eventType: 'grow_light',
  occurredAt: new Date().toISOString(),
  durationMinutes: 90,
})

// file: File은 파일 선택 단계에서 얻는 이미지. 파일 읽기/가공은 트랜잭션 전에 완료합니다.
async function attachPhoto(file: File) {
  return repositories.runInTransaction(async (tx) => {
    const photo = await tx.photos.create({
      plantId: plant.id,
      entryId: entry.id,
      blob: file,
      mimeType: file.type,
      capturedAt: new Date().toISOString(), // 추후 EXIF 촬영 시각을 전달할 수 있음
      sortOrder: 0,
    })
    await tx.plants.update(plant.id, { coverPhotoId: photo.id })
    return photo
  })
}

const timeline = await repositories.queries.recentTimeline(plant.id, 10)
for (const row of timeline) {
  if (row.recordType === 'diary') console.log(row.id, row.record.entryDate)
  else console.log(row.id, row.record.eventType)
}
const minutes = await repositories.queries.growLightMinutes(
  plant.id,
  localDateKey(),
)
const lastWatered = await repositories.queries.lastWateringAt(plant.id)
const days = await repositories.queries.daysSinceLastWatering(plant.id)
const total = await repositories.queries.totalRecordCount(plant.id)

try {
  await repositories.plants.delete(plant.id)
} catch (error) {
  if (error instanceof RepositoryError) {
    console.error(error.code, error.message, error.cause)
    // VALIDATION / NOT_FOUND / CONFLICT / STORAGE 별로 호출자가 처리
  } else throw error
}
db.close()
```

기존 ID와 UTC 저장 시각, 별도의 Repository 계약은 향후 서버 어댑터와 동기화 설계에 재사용할 수 있습니다.
현재는 원격 구현, 인증, 동기화 상태·삭제 tombstone·충돌 해결을 추가하지 않았습니다.

## 검증

- `npm run check`: 타입·린트·포맷·테스트·빌드 통과. 총 95개(기존 33개 + 신규 저장소 62개)
- 기존 홈·상세·라우팅·날짜 테스트 유지
- 각 저장소 테스트는 Node 환경과 fake-indexeddb 사용, 매 테스트 고유 DB를 생성하고 종료 시 삭제
- 식물/일기/관리 이벤트/사진 CRUD와 재개방 후 Blob 바이트 보존
- 과거 일기, 최신 물주기 재계산, 날짜·식물별 식물등 합산, 원본 ID·타입을 보존한 타임라인
- 식물·일기·사진 연쇄 삭제와 대표 사진 참조 정리
- 중복/없는/잘못된 ID, 다른 식물의 사진 연결, 필수 값·날짜·시각·분·MIME 검증
- 여러 저장 성공 및 중간 검증/삭제 실패 시 롤백, STORAGE 오류의 원인 보존
- 한국/미국/UTC 현지 날짜, 자정·DST·윤일·연도 경계

전체 검사: `npm run check`. 저장소만 검사: `npm test -- src/data/local/`.
기존 UI 소스·스타일·목업·라우트는 작업 전후 파일 해시로 변경 없음을 확인합니다.

설계 참고: [Dexie 트랜잭션](<https://dexie.org/docs/Dexie/Dexie.transaction()>),
[Dexie 모범 사례](https://dexie.org/docs/Tutorial/Best-Practices).

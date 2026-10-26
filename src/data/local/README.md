# Dexie 로컬 저장소

`database.ts`는 LeaforyDatabase와 버전 1 스키마를 정의합니다.
`repositories.ts`의 createLocalRepositories(db)는 도메인 Repository 계약을 구현합니다.
전역 DB 인스턴스를 만들지 않으므로 모듈을 추가하는 것만으로 DB가 열리거나 목업 UI가 변경되지 않습니다.

모든 저장과 복합 조회는 트랜잭션을 사용합니다. 호출자는 구체적 Dexie 테이블 대신
Repository 계약을 사용합니다. DB 생성과 종료는 향후 조립 지점에서 관리합니다.

테스트 파일은 Node 환경에서 fake-indexeddb를 사용하고 매 테스트마다 다른 DB 이름을
생성한 뒤 삭제합니다. UI 테스트도 Provider에 독립 Repository를 주입합니다.
Phase 4A에서는 `main.tsx`에서 실제 DB를 생성하고 Repository만 화면에 전달합니다.

스키마, 삭제 정책, API, 오류 처리와 예시는 [Phase 3 문서](../../../docs/phase-3.md)를 참고하세요.
실제 화면 연결과 사진 처리는 [Phase 4A 문서](../../../docs/phase-4a.md)를 참고하세요.

Phase 5의 `backup.snapshot()`은 4개 테이블을 하나의 읽기 트랜잭션으로 조회합니다.
`backup.replace()`는 데이터와 연결 관계를 재검증한 뒤 전체 삭제·삽입을 하나의 쓰기
트랜잭션으로 수행하며 실패 시 기존 데이터를 보존합니다. ID와 시각의 의미를 보존하고
ISO 시각은 기존 CRUD와 같이 UTC로 정규화합니다. [백업 형식과 정책](../../../docs/phase-5.md)을 참고하세요.

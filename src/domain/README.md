# 도메인

- `models.ts`: Plant, DiaryEntry, DiaryPhoto, CareEvent, 생성·수정 입력, 타임라인 타입
- `repositories.ts`: UI와 무관한 CRUD·목록·집계·트랜잭션 계약
- `validation.ts`: UUID, 실제 달력 날짜, ISO 시각, 필수 필드, Blob/MIME 검증
- `calendar.ts`: 사용자 장치의 로컬 날짜와 달력 기준 경과 일수
- `errors.ts`: 호출자가 구분할 수 있는 RepositoryError

React, Zustand, Dexie와 서버 SDK에 의존하지 않습니다.
상세 정책과 사용 예시는 [Phase 3 문서](../../docs/phase-3.md)를 참고하세요.
기존 UI의 한국 시간 날짜 유틸리티는 변경하지 않았습니다. 신규 저장소는 사용자 로컬 날짜를 사용합니다.

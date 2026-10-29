# 식물등 타이머 기록 표시 개선

기존 CareEvent 메모를 변경하지 않고 식물 상세 타임라인 표시 계층에서만 해석합니다. 제목 ‘식물등 N분’과 기존 수정·삭제 경로는 유지합니다.

## 표시 정책

- 관리 기록 중 식물등 이벤트에서만 기존 `식물등 타이머 자동 기록 / 실제 누적 HH:mm:ss / 시작 ISO / 측정 종료 ISO` 형식을 해석합니다. 줄바꿈 대신 공백인 이전 메모도 지원합니다.
- ‘타이머 기록’ 배지, 사용자 로컬 시간대의 시작~종료 시각, 실제 사용 시간(시·분·초)을 표시합니다. 사용 시간은 시작~종료 차이가 아닌 저장된 누적 시간을 사용하므로 일시정지 시간은 더하지 않습니다.
- 로컬 날짜가 다르면 양쪽 날짜를 표시합니다. 연도를 넘기면 양쪽 연도도 표시합니다. 한국어 표기만 지정하며 시간대를 한국으로 고정하지 않습니다.
- 메타데이터 다음의 사용자 메모는 별도로 표시하고 줄바꿈을 유지합니다. 원본 메모 전체는 기본적으로 접힌 ‘원본 기록 보기’에서 확인할 수 있습니다.
- 형식이 불완전하거나 날짜·시각·누적 시간이 유효하지 않으면 원문 전체를 기존 방식으로 표시합니다. 추측해서 내용을 삭제하지 않습니다. 사용자가 메타데이터 자체를 편집한 경우도 이 정책을 따릅니다.
- 수동 식물등 메모, 다른 관리 유형, 일기는 기존 표시 방식 그대로입니다.
- DB 스키마·Repository·CareEvent 구조·ZIP v1 형식·기존 사용자 데이터·사진 Blob을 변경하지 않습니다. 새 의존성은 없습니다.

## 변경 파일

- `src/lib/timer-record-display.ts`: 순수 파싱·시간대·기간 표시 함수
- `src/components/plant-detail/TimerRecordDescription.tsx`: 배지·사용 시간·사용자 메모·접힌 원문
- `src/components/plant-detail/PlantTimeline.tsx`: 식물등 관리 기록에서만 적용
- `src/pages/plant-detail.css`: 기존 컬러·Pretendard를 유지하는 국소 스타일
- `src/lib/timer-record-display.test.ts`, `src/components/plant-detail/TimerRecordDescription.test.tsx`: 신규 표시 검증
- `src/components/timer/LightTimerCard.test.tsx`: 완료 후 원문 대신 새 표시를 확인하도록 회귀 기대값 변경

## 브라우저 캡처

사용자 DB와 별개인 `leafory-timer-display-qa-20261029`에서 동일한 샘플 데이터를 사용했습니다. 기존 타이머 메모, 추가 사용자 메모, 수동 식물등 기록, 자정을 넘긴 기록을 함께 표시했습니다. 임시 QA 진입 소스는 검증 후 제거합니다. 캡처는 실제 Chrome 모바일 viewport이며 iPhone 실기기 캡처는 아닙니다.

- [수정 전 390px](screenshots/phase-10-timer-display/before-390.jpg)
- [수정 후 390px](screenshots/phase-10-timer-display/after-390.jpg)
- [수정 후 320px](screenshots/phase-10-timer-display/after-320.jpg)
- [수정 후 402px](screenshots/phase-10-timer-display/after-402.jpg)

320/390/402px에서 가로 넘침 없이 표시되며 원본 보기 터치 영역은 최소 44px입니다. 원본 펼치기·닫기 동작도 실제 브라우저에서 확인했습니다.

## 최종 검사

- 타입·린트·포맷·전체 35개 테스트 파일 / 344개 테스트·빌드·PWA precache 검증 통과.
- `TZ=America/New_York`로 표시 함수 테스트 16개를 별도 실행해 통과. 한국/뉴욕 시간대, 로컬 자정·연도 경계와 기본 사용자 시간대 적용을 검증했습니다.
- 기존 타이머 시작·정지·재개·종료, 식물 관리·일기·백업 회귀 테스트를 유지합니다. 표시 후와 ZIP 복원 후에도 원본 메모가 동일함을 검증했습니다.
- `test/iphone-pwa`의 미커밋 변경으로 남겼으며 커밋·Push·배포를 하지 않았습니다. main·Production 및 사용자 기본 IndexedDB를 변경하지 않았습니다. 홈 리디자인 변경은 작업 시작 시 없었습니다.

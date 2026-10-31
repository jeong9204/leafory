# Phase 11 — 최종 픽셀 책장 홈

## 적용 범위

승인된 2차 WebP 21종을 `public/pixel/refined/`에 적용했다. 총 22,220B이며
기존 `public/pixel/painted/` WebP 20종(3,900,178B)과 wood.svg는 보존한다.

- 식물 11종: evergreen, adenium, euphorbia-bupleurifolia, cactus, philodendron,
  monstera, trailing, default, rosemary, snake, succulent.
- 장식 10종: books, frame, lamp, cat, globe, lantern, house, spray, can, ivy.

이름표 → 관리 상태 → 화분 순서와 선반 바닥 정렬을 유지한다.
320px 2열, 390·402px 3열이며 등록 식물이 늘면 선반이 추가된다.
하단 안내 여백 50px / 15px / 50px, Pretendard와 홈·기록·캘린더 메뉴를 유지한다.
최근 기록은 도트 썸네일·날짜·제목·꺾쇠를 표시하고 식물 상세 링크를 유지한다.

## 출처 및 이미지 규격

Leafory용으로 새로 제작한 AI 생성 픽셀 일러스트다. 외부 스프라이트 팩,
참고 시안의 잘라낸 이미지 또는 사용자 사진/일기 Blob을 포함하지 않는다.
기존 authored SVG의 CC0 설명을 신규 AI 이미지의 독점 저작권 주장으로 확대하지 않는다.

식물은 64×64 논리 격자를 3배 확대한 192×192, 장식은 용도에 맞는 종횡비다.
무손실 WebP·투명 배경·알파 0/255·논리 픽셀당 3×3 블록·14~15 불투명 색을 사용한다.
좌상단 광원과 갈색 외곽선, 올리브·크림·테라코타 색상 계열을 맞췄다.
파일별 크기와 SHA-256은 [에셋 무결성 목록](phase-11-pwa-asset-optimization/asset-integrity.json)에 있다.

승인 원본과 비교한 해시를 `src/test/fixtures/refined-assets.sha256.json`에 고정했다.
21개 에셋 테스트는 이 해시를 사용하므로 로컬 `design/` 폴더가 없는 새 체크아웃에서도 실행된다.

## 표시 매핑과 데이터 보호

정확한 `Euphorbia bupleurifolia` 또는 학명이 없는 정확한 괴마옥/기존 카탈로그 별칭은
전용 euphorbia-bupleurifolia 그림으로 표시한다. 명시 학명이 별명보다 우선한다.
일반 선인장은 cactus, 미지원 식물은 default를 사용한다. 불명확한 유사 이름을 괴마옥으로 추정하지 않는다.
이 매핑은 장식 선택이며 사용자 이름·학명·DB·건강 상태를 수정하지 않는다.

첫 식물/헤더는 우선 로드하고 아래쪽 식물·장식은 lazy loading한다.
이미지는 pixelated/contain/bottom 정렬하고 덩굴은 비율 유지 수직 반복한다.
실패한 화분/장식 이미지는 default로 대체하며 기본 이미지까지 실패해도 재요청 루프를 만들지 않는다.
사용자 식물 사진은 홈에서 픽셀화하거나 변환하지 않으며 기존 상세·일기 Blob을 보존한다.

## 검증과 배포 자료

타입·린트·포맷·기존 기능 회귀를 포함한 417개 테스트·Production build·PWA 검증을 수행했다.
320·390·402px와 식물 0·1·2·3·6·9·12개 조합은 로컬 격리 QA에서 확인했다.
개인 데이터가 없는 합성 fixture를 사용했고 실제 사용자 저장소에는 접근하지 않았다.

원화 PNG, ZIP, 대용량 비교 캡처, design 검토 페이지와 시험 DB/QA 로그는 저장소에 포함하지 않는다.
해당 로컬 파일은 삭제하지 않고 보존하며 `.gitignore`로 제외한다.
public 원본은 기존 URL과 롤백을 위해 버전 관리한다.
PWA 캐시 제외 정책 및 실제 iPhone 점검 순서는 [캐시 최적화 문서](phase-11-pwa-asset-optimization.md)에 있다.

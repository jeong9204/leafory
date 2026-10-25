# 전체 UI Pretendard 통일

- 변경: `src/index.css`, `src/pages/plant-detail.css`, `src/pages/plant-management.css`의 명조체·Georgia·시스템 폰트 우선 지정을 제거하고 공통 `--font-sans`를 사용한다. `html`과 버튼·입력·선택·텍스트 영역에 상속도 명시한다.
- 계층: 본문/설명 400, 보조 라벨·상태·일반 네비게이션 500, 소제목·버튼·폼 라벨 600, 주요 제목·식물 이름·강조 숫자·활성 홈 700. 학명은 동일한 Pretendard에 Italic을 유지한다.
- 기존 색상·카드·간격·사진·레이아웃 수치는 유지했다. 긴 이름과 학명은 기존 줄바꿈 규칙으로 처리한다.
- 로컬 폰트: 기존 `pretendard@1.3.9`의 Variable WOFF2를 `main.tsx`에서 import한다. Vite 빌드에 약 2.06MB 폰트 파일이 포함되며 외부 폰트 서버 요청이 없다.
- 라이선스: 공식 [v1.3.9 라이선스 원문](https://github.com/orioncactus/pretendard/blob/v1.3.9/LICENSE)을 `public/licenses/Pretendard-OFL.txt`에 포함했다. 원래 저작권 고지와 SIL OFL 1.1을 보존하고 빌드 결과에도 복사한다. 폰트 파일은 수정하지 않았다.

## 검증

2026-10-25 `npm run check` 통과: 타입·린트·포맷, 기존 140개 테스트, 프로덕션 빌드. 폰트 선언 교체이므로 새 구현을 반복하는 단위 테스트는 추가하지 않았다.

실제 브라우저 320×760 / 390×844에서 홈·상세·식물 폼·빠른 관리 기록 폼을 확인했다. `document.fonts.check`로 400과 700의 로컬 폰트 로드를 확인했고, 제목·본문·버튼·입력의 computed font-family가 Pretendard로 일치했다. 홈의 computed weight는 400/500/600/700이었다. 상세 학명은 Italic을 유지했다.

긴 식물 이름 `몬스테라 폰트 확인`, 학명 `Monstera deliciosa`, 여러 줄 메모를 직접 입력해 줄바꿈을 확인했다. 320px에서는 긴 이름이 두 줄로 바뀌어도 사진·상태·물주기 영역과 겹치지 않았고, 홈·상세·폼의 document scrollWidth가 viewport와 일치했다. 390px에서도 가로 넘침과 텍스트 겹침이 없었다. 검증용 식물은 확인 후 정리했다.

- [홈 320px](screenshots/pretendard-home-320.jpg) / [홈 390px](screenshots/pretendard-home-390.jpg)
- [상세 320px](screenshots/pretendard-detail-320.jpg) / [상세 390px](screenshots/pretendard-detail-390.jpg)
- [입력 폼 320px](screenshots/pretendard-form-320.jpg)

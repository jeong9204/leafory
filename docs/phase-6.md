# Phase 6 — 식물 이름 기반 학명 추천

## 동작과 데이터 경계

등록·수정 폼의 이름 입력을 로컬 32종 카탈로그에서 검색합니다. 한국어 검색용 일반명·별칭,
현행 학명·확인한 이전 학명을 지원하며 NFKC 정규화, 대소문자·공백 정규화 후 정확 일치,
접두 일치, 부분 일치 순으로 정렬합니다. 빈 검색은 결과가 없습니다. 한 번에 5개를 표시하고
전체 후보 수와 검색어를 좁히라는 안내를 제공합니다. 외부 검색 요청이나 추가 의존성은 없습니다.

후보는 자동 선택하지 않습니다. `이 학명 선택` 버튼을 누를 때만 학명 필드를 채우며 이름,
상태, 메모, 날짜는 변경하지 않습니다. 학명은 선택 이후에도 직접 수정·삭제할 수 있고
후보를 고르지 않거나 학명을 비워 두어도 등록할 수 있습니다. 이름 변경, 폼 초기 진입,
검색 결과 갱신은 기존 학명을 수정하지 않습니다. 기존 저장된 잘못된 학명도 자동 교정하지 않습니다.

`src/data/catalog/`는 앱에 포함되는 참고 자료이고 Plant 모델, Repository, Dexie 사용자
데이터 및 백업 ZIP에는 추가되지 않습니다. DB 스키마는 버전 1 그대로입니다.

## 정확성·출처·재사용 고지

아래 학명은 2026-10-26 Kew **Plants of the World Online (POWO)**에서 각 종의
accepted 상태를 확인했습니다. 학명 저자명은 표시에서 생략했습니다. 과·재배 특성·진단
설명은 수집하지 않았으며 종 식별이나 품종 판별을 제공하지 않습니다.

분류 출처: Royal Botanic Gardens, Kew, Plants of the World Online;
The International Plant Names Index and World Checklist of Vascular Plants 2026.
POWO 분류 백본의 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) 고지에 따라
출처를 표시합니다. 원본에서 학명·동의어의 소규모 부분집합을 선별하고 한국어 검색 라벨과
설명을 별도로 작성했습니다. 출처의 사진이나 설명 본문은 복제하지 않았습니다.

한국어 이름은 검색 편의를 위한 Leafory의 일반명·유통명 라벨이며 공인 국명이나
일대일 종 대응표가 아닙니다. 같은 이름에 여러 종·교잡종·원예 품종이 유통될 수 있습니다.
예를 들어 [농촌진흥청 농사로의 몬스테라 안내](https://nongsaro.go.kr/portal/ps/psz/psza/contentSub.ps?cntntsNo=16449&menuId=PS00376&totalSearchYn=Y)는
Monstera deliciosa를 소개하지만, 앱은 몬스테라 검색에 M. adansonii도 별도 후보로 제공합니다.
다른 종류의 가능성을 배제하지 않으며 실물의 종 확인을 대신하지 않습니다.

스투키(angolensis / stuckyi), 스킨답서스(Epipremnum / Scindapsus),
극락조(reginae / nicolai), 고무나무(Ficus 4종)를 구분해서 제공합니다.
산세베리아·스파티필룸·안스리움·파키라 등의 후보도 유통 식물 전체의 확정 학명이 아닙니다.
카탈로그 밖의 종은 직접 입력할 수 있습니다.

이전 학명은 검색용 동의어에만 포함하고 선택 시 POWO 기준 현행 학명을 채웁니다.
예: Sansevieria cylindrica → Dracaena angolensis, Dypsis lutescens →
Chrysalidocarpus lutescens, Calathea orbifolia → Goeppertia orbifolia.
특히 현재 POWO는 Thaumatophyllum bipinnatifidum을 Philodendron bipinnatifidum의
동의어로 처리합니다. 다른 분류 체계·확인 시점과 차이가 있을 수 있어 셀렘 후보에 이를 명시합니다.
분류 변경 시 개별 출처와 확인 날짜를 다시 검토하며 기존 사용자 데이터는 마이그레이션하지 않습니다.

### 개별 종과 확인 근거

| 검색용 이름              | 현행 학명                   | 검색용 이전 학명                                     | 분류 출처                                                                         | 확인 날짜  |
| ------------------------ | --------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- |
| 몬스테라                 | Monstera deliciosa          | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:87478-1)    | 2026-10-26 |
| 몬스테라 아단소니        | Monstera adansonii          | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:87464-1)    | 2026-10-26 |
| 스킨답서스 · 골든포토스  | Epipremnum aureum           | Scindapsus aureus, Pothos aureus                     | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:87014-1)    | 2026-10-26 |
| 실버 스킨답서스          | Scindapsus pictus           | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:88905-1)    | 2026-10-26 |
| 필로덴드론 헤데라세움    | Philodendron hederaceum     | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:87797-1)    | 2026-10-26 |
| 셀렘                     | Philodendron bipinnatifidum | Thaumatophyllum bipinnatifidum, Philodendron selloum | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:77306988-1) | 2026-10-26 |
| 스파티필룸               | Spathiphyllum wallisii      | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:89011-1)    | 2026-10-26 |
| 안스리움                 | Anthurium andraeanum        | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:84549-1)    | 2026-10-26 |
| 금전수                   | Zamioculcas zamiifolia      | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:89402-1)    | 2026-10-26 |
| 산세베리아               | Dracaena trifasciata        | Sansevieria trifasciata                              | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:77164235-1) | 2026-10-26 |
| 스투키 · 실린드리카 후보 | Dracaena angolensis         | Sansevieria cylindrica, Sansevieria angolensis       | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:77182375-1) | 2026-10-26 |
| 스투키 · stuckyi 후보    | Dracaena stuckyi            | Sansevieria stuckyi                                  | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:77183329-1) | 2026-10-26 |
| 행운목                   | Dracaena fragrans           | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:534207-1)   | 2026-10-26 |
| 드라세나 레플렉사        | Dracaena reflexa            | Pleomele reflexa                                     | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:534338-1)   | 2026-10-26 |
| 인도고무나무             | Ficus elastica              | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:60458499-2) | 2026-10-26 |
| 떡갈고무나무             | Ficus lyrata                | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:853158-1)   | 2026-10-26 |
| 벤자민고무나무           | Ficus benjamina             | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:852486-1)   | 2026-10-26 |
| 벵갈고무나무             | Ficus benghalensis          | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:852482-1)   | 2026-10-26 |
| 홍콩야자                 | Heptapleurum arboricola     | Schefflera arboricola                                | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:90845-1)    | 2026-10-26 |
| 테이블야자               | Chamaedorea elegans         | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:54865-2)    | 2026-10-26 |
| 아레카야자               | Chrysalidocarpus lutescens  | Dypsis lutescens                                     | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:665962-1)   | 2026-10-26 |
| 파키라                   | Pachira aquatica            | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:179762-2)   | 2026-10-26 |
| 극락조 · 레기나에        | Strelitzia reginae          | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:798194-1)   | 2026-10-26 |
| 극락조 · 니콜라이        | Strelitzia nicolai          | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:798185-1)   | 2026-10-26 |
| 접란                     | Chlorophytum comosum        | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:532810-1)   | 2026-10-26 |
| 필레아 페페              | Pilea peperomioides         | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:855664-1)   | 2026-10-26 |
| 청페페                   | Peperomia obtusifolia       | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:679269-1)   | 2026-10-26 |
| 칼라데아 오르비폴리아    | Goeppertia orbifolia        | Calathea orbifolia                                   | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:60461168-2) | 2026-10-26 |
| 괴마옥                   | Euphorbia bupleurifolia     | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:345870-1)   | 2026-10-26 |
| 염좌                     | Crassula ovata              | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:273350-1)   | 2026-10-26 |
| 아데니움 · 오베숨        | Adenium obesum              | Adenium arabicum                                     | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:76369-1)    | 2026-10-26 |
| 아데니움 · 멀티플로룸    | Adenium multiflorum         | —                                                    | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:76366-1)    | 2026-10-26 |

아데니움 추가와 현재 전체 이름·별칭 목록은 [카탈로그 점검 보고](catalog-adenium-audit.md)를 참고하세요.

## 검증 결과

- `npm run check`: 타입 검사, ESLint, Prettier, Vitest, 프로덕션 빌드 통과.
- 총 207개 / 18개 파일 테스트 통과(기존 188개 유지, 신규 19개).
- 신규: 일반명·별칭·현행/이전 학명, 대소문자·공백·전각 문자·부분 검색,
  복수 후보, 빈 검색/미등록 이름, 키보드 후보 선택, 선택 없이 이름만 저장,
  선택 후 직접 수정, 이름 변경 시 기존 학명 유지, 저장 실패 시 입력 유지,
  기존 식물의 날짜·메모·상태 보존을 확인했습니다.
- 기존 백업·복원 서비스/화면, 식물·사진 관리, 관리 이벤트, 사진 일기 테스트도 통과했습니다.
- 실제 IAB 브라우저에서 320×740, 390×844 viewport로 확인했습니다.
  후보 선택 저장·수정 저장·새로고침 복원·학명 없이 등록·홈 반영을 확인했습니다.
  콘솔 오류/경고는 없었습니다. 사진·사용자 데이터를 외부로 전송하지 않았습니다.
- 원래 데이터가 있는 5173 origin 대신 `http://127.0.0.1:5174`를 사용했습니다.
  검증용 식물 2개(몬스테라, 학명 없는 스파티필룸)는 이 분리된 origin에만 남아 있습니다.
  원래 사용자 DB의 데이터를 삭제·변경하지 않았습니다.
- 320px와 390px 모두 문서 scrollWidth가 각각 viewport와 같고 추천 카드가 화면 밖으로
  넘치지 않았습니다. 긴 학명·설명은 카드 안에서 줄바꿈되고 버튼은 최소 48px 높이,
  출처 링크는 최소 44px입니다. 전체 폰트는 기존 로컬 Pretendard이며 학명 Italic을 유지합니다.
- 등록·수정 폼의 기존 사진 영역·입력 스타일·하단 네비게이션 숨김은 그대로입니다.
  이름과 학명 사이 추천 영역만 추가해 후보가 많을 때 세로 길이는 늘어납니다.
  홈·상세·백업 화면 소스와 DB 스키마는 수정하지 않았습니다.

### 실제 브라우저 캡처

| 화면              | 320px                                            | 390px                                                     |
| ----------------- | ------------------------------------------------ | --------------------------------------------------------- |
| 등록 전체         | [320px](screenshots/phase6-create-320.jpg)       | [390px](screenshots/phase6-create-390.jpg)                |
| 학명 후보 및 선택 | [긴 학명](screenshots/phase6-candidates-320.jpg) | [스투키 복수 후보](screenshots/phase6-candidates-390.jpg) |
| 기존 식물 수정    | [320px](screenshots/phase6-edit-320.jpg)         | [390px](screenshots/phase6-edit-390.jpg)                  |

[실제 저장 데이터가 반영된 홈 320px](screenshots/phase6-home-320.jpg)도 보관했습니다.

## Git 상태와 남은 한계

Phase 5는 `2bb298c703f6d39738b23b07bc05b33b744e7d6f`
(`feat: add local data backup and restore`)로 커밋하고 GitHub `main`에 push했습니다.
커밋 전 민감 파일·임시/빌드 파일을 점검했고 원격·로컬 커밋 일치를 확인했습니다.
Phase 6 변경은 요청에 따라 커밋·push하지 않았습니다.

카탈로그는 32종의 제한된 후보이며 사진 식별·품종 판별 기능이 아닙니다.
최대 5개 표시 이후에는 이름을 더 입력해야 합니다. 분류가 변경되거나 검색용 별칭이
추가될 때 개별 출처·확인 날짜를 다시 검토해야 합니다. 모바일 검증은 실제 브라우저의
viewport 검증이며 iOS/Android 실기기 및 가상 키보드 검증을 대체하지 않습니다.

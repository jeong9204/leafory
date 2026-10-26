# 식물 카탈로그 점검 및 아데니움 추가

점검 날짜: 2026-10-26. 점검 전 30종, 수정 후 32종입니다.
실제 데이터 파일은 `src/data/catalog/plants.json`, 검색 함수는
`src/data/catalog/search.ts`의 `searchPlantCatalog()`입니다.

## 원인과 검색 결과

기존 30종에는 Adenium속, 아데니움, 사막의 장미 이름·별칭·학명이 하나도 없었습니다.
수정 전 실제 검색 함수를 호출한 Vitest 3개로 각 빈 배열을 확인했습니다.
검색은 일반명·별칭·학명·동의어를 모두 대상으로 정확/접두/부분 일치를 수행하고 있으며
이 검색 로직에는 문제가 없었습니다. 이번 수정에서도 검색 코드는 변경하지 않았습니다.

| 검색어      | 수정 전 | 수정 후                             |
| ----------- | ------- | ----------------------------------- |
| 아데니움    | 0개     | Adenium obesum, Adenium multiflorum |
| Adenium     | 0개     | Adenium obesum, Adenium multiflorum |
| 사막의 장미 | 0개     | Adenium obesum, Adenium multiflorum |

## 추가 근거와 분류 정책

- [Kew POWO: Adenium obesum](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:76369-1): accepted species.
- [Kew POWO: Adenium multiflorum](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:76366-1): accepted species이며 A. obesum과 구분합니다.
- [Kew POWO: Adenium arabicum](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:76358-1): A. obesum의 동의어입니다.
  별도 종으로 중복 추가하지 않고 A. obesum의 검색용 동의어에 넣었습니다.
- [RHS의 Adenium속 안내](https://www.rhs.org.uk/plants/156456/adenium/details)는 속 수준에서 desert rose를 사용합니다.
  한국어 `사막의 장미`와 영어 `desert rose`는 여러 후보를 찾는 검색용 라벨로 사용합니다.
  공인 국명이나 종별 일대일 대응표를 뜻하지 않습니다.
- 두 후보 모두 출처 URL과 확인 날짜 2026-10-26을 포함합니다.
  현재 POWO는 Adenium속에서 6종을 인정하며 이번에는 2종만 추가했습니다.
  일반명만으로 이 두 종 중 하나나 교잡종·원예 품종을 확정하지 않습니다.
  다른 분류 체계에서는 종의 범위가 달라질 수 있습니다.

## 현재 전체 목록

1–30번은 기존 항목 그대로이고 31–32번만 추가했습니다. 별칭은 검색 편의를 위한 이름이며
분류학적 동의어와 구분합니다. 검색용 이전 학명은 별도 열에 표시했습니다.

| 번호 | 한국어 표시 이름         | 별칭                                                                                             | 학명                        | 검색용 이전 학명                                     |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------- |
| 1    | 몬스테라                 | 몬스테라 델리시오사                                                                              | Monstera deliciosa          | —                                                    |
| 2    | 몬스테라 아단소니        | 몬스테라, 아단소니                                                                               | Monstera adansonii          | —                                                    |
| 3    | 스킨답서스 · 골든포토스  | 스킨답서스, 골든포토스                                                                           | Epipremnum aureum           | Scindapsus aureus, Pothos aureus                     |
| 4    | 실버 스킨답서스          | 스킨답서스, 실버스킨, 픽투스                                                                     | Scindapsus pictus           | —                                                    |
| 5    | 필로덴드론 헤데라세움    | 헤데라세움, 하트잎 필로덴드론                                                                    | Philodendron hederaceum     | —                                                    |
| 6    | 셀렘                     | 셀로움, 필로덴드론 셀렘                                                                          | Philodendron bipinnatifidum | Thaumatophyllum bipinnatifidum, Philodendron selloum |
| 7    | 스파티필룸               | 스파티필름                                                                                       | Spathiphyllum wallisii      | —                                                    |
| 8    | 안스리움                 | 안수리움                                                                                         | Anthurium andraeanum        | —                                                    |
| 9    | 금전수                   | ZZ plant, 자미오쿨카스                                                                           | Zamioculcas zamiifolia      | —                                                    |
| 10   | 산세베리아               | 산세비에리아, 뱀식물                                                                             | Dracaena trifasciata        | Sansevieria trifasciata                              |
| 11   | 스투키 · 실린드리카 후보 | 스투키, 산세베리아 실린드리카, 실린드리카                                                        | Dracaena angolensis         | Sansevieria cylindrica, Sansevieria angolensis       |
| 12   | 스투키 · stuckyi 후보    | 스투키, 산세베리아 스투키                                                                        | Dracaena stuckyi            | Sansevieria stuckyi                                  |
| 13   | 행운목                   | 드라세나 프라그란스                                                                              | Dracaena fragrans           | —                                                    |
| 14   | 드라세나 레플렉사        | 레플렉사                                                                                         | Dracaena reflexa            | Pleomele reflexa                                     |
| 15   | 인도고무나무             | 고무나무, 인도 고무나무                                                                          | Ficus elastica              | —                                                    |
| 16   | 떡갈고무나무             | 고무나무, 떡갈 고무나무                                                                          | Ficus lyrata                | —                                                    |
| 17   | 벤자민고무나무           | 고무나무, 벤자민                                                                                 | Ficus benjamina             | —                                                    |
| 18   | 벵갈고무나무             | 고무나무, 벵갈 고무나무                                                                          | Ficus benghalensis          | —                                                    |
| 19   | 홍콩야자                 | 쉐플레라, 셰플레라, 홍콩 야자                                                                    | Heptapleurum arboricola     | Schefflera arboricola                                |
| 20   | 테이블야자               | 테이블 야자                                                                                      | Chamaedorea elegans         | —                                                    |
| 21   | 아레카야자               | 아레카 야자                                                                                      | Chrysalidocarpus lutescens  | Dypsis lutescens                                     |
| 22   | 파키라                   | 파키라 아쿠아티카                                                                                | Pachira aquatica            | —                                                    |
| 23   | 극락조 · 레기나에        | 극락조, 극락조화, 레기나에                                                                       | Strelitzia reginae          | —                                                    |
| 24   | 극락조 · 니콜라이        | 극락조, 니콜라이, 큰극락조                                                                       | Strelitzia nicolai          | —                                                    |
| 25   | 접란                     | 나비란                                                                                           | Chlorophytum comosum        | —                                                    |
| 26   | 필레아 페페              | 필레아 페페로미오이데스                                                                          | Pilea peperomioides         | —                                                    |
| 27   | 청페페                   | 페페로미아 옵투시폴리아, 페페로미아                                                              | Peperomia obtusifolia       | —                                                    |
| 28   | 칼라데아 오르비폴리아    | 오르비폴리아, 칼라테아 오르비폴리아                                                              | Goeppertia orbifolia        | Calathea orbifolia                                   |
| 29   | 괴마옥                   | 유포르비아 부플레우리폴리아                                                                      | Euphorbia bupleurifolia     | —                                                    |
| 30   | 염좌                     | 제이드플랜트, 크라슐라 오바타                                                                    | Crassula ovata              | —                                                    |
| 31   | 아데니움 · 오베숨        | 아데니움, 아데늄, 오베숨, 아데니움 오베숨, 아데니움 아라비쿰, 아라비쿰, 사막의 장미, desert rose | Adenium obesum              | Adenium arabicum                                     |
| 32   | 아데니움 · 멀티플로룸    | 아데니움, 아데늄, 멀티플로룸, 아데니움 멀티플로룸, 사막의 장미, desert rose                      | Adenium multiflorum         | —                                                    |

## 검증 및 변경 범위

- 기존 211개 테스트 유지. 카탈로그 종 수 기대값만 30 → 32로 갱신했습니다.
- 신규 검색 테스트 11개: 요청한 3개 검색어, 공백/대소문자/부분 일치,
  arabicum 동의어와 한국어 별칭, 종별 정확 검색을 확인합니다.
- 전체 222개 테스트(20개 파일), 타입·린트·포맷·빌드 통과.
- 빌드에는 기본 JS 청크 501.05kB(gzip 154.99kB)가 Vite 기본 500kB 기준을 넘는 크기 경고 1건이 있습니다. 빌드는 성공했으며 청크 분할은 이번 데이터 수정에 포함하지 않았습니다.
- 기존 30개 항목의 모든 필드가 수정 전 JSON과 동일한지 비교했습니다.
- 검색 코드·DB 스키마·Plant 등 데이터 모델 파일은 SHA-256 동일성을 확인했습니다.
- UI·Repository·DB 마이그레이션은 변경하지 않았고 앱 실행이나 사용자 DB 접근을 하지 않았습니다.
- 변경 파일: 카탈로그 JSON, 기존 카탈로그 테스트의 종 수, 신규 아데니움 검색 테스트,
  README, Phase 6 출처 목록, 출처 고지의 종 수, 이 점검 보고서.
- Git commit/push는 수행하지 않았습니다.

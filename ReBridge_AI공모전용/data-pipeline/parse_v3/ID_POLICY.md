# ID·문서 버전 정책 (parse_v3)

## 원칙
- ID는 **내용에서 결정적으로** 만든다: `접두어:` + sha1(구성요소 NFC 문자열을 \x1f 로 이은 것) 앞 16자(`common.h`).
  같은 입력을 다시 처리하면 같은 ID → `INSERT OR REPLACE` 로 중복 행이 생기지 않는다.
- 대학 ID는 앱의 `univId`(어디가 마스터)를 그대로 쓴다. 새로 만들지 않는다.
  이름은 `rawlib.targets()`(제외 16곳·NAME_OVERRIDES 반영)를 따른다. 출처: `university_campus.source_note`.
- 캠퍼스·학과·세부전형을 이름 한 문자열로 합치지 않는다. 원문 이름(`*_raw`)을 반드시 보관한다.

## 문서
| ID | 규칙 |
|---|---|
| `document_id` | `doc:` + 파일 sha256 앞 16자. **내용이 같으면 같은 문서**(폴더·대학·연도가 달라도) |
| `file_id` | `file:` + h(RAW 상대경로). 물리 파일 한 개 |
- 해시가 다르면 이름이 같아도 다른 버전이다. 지우거나 합치지 않는다.
- 변환본(형식 통일 때 만든 `*_변환.pdf|xlsx`)은 `converted_from` 으로 원본 문서를 가리킨다. 표 구조가 살아 있는 원본(HTML·XLS)이 있으면 입시결과 파서는 원본을 읽는다.
- `_원본형식/` 보관본은 `document_file.is_original_format_archive=1`.
- 학년도: `academic_years_claimed`(manifest 폴더) 와 `academic_years_detected`(본문 'NNNN학년도') 를 따로 둔다. 폴더 연도만으로 확정하지 않는다(`year_check`).
- 요강과 시행계획이 충돌하면 `supersedes_document_id`·`document_status` 로 기록하고, 불명확하면 사실 행을 pending.

## 사실 행
| 테이블 | ID 구성 |
|---|---|
| outcome | `out:` h(document_id, univId, 표 위치키(p쪽t표 / s시트 / t표), 행 번호, 열 번호) |
| evidence(입시결과) | `ev:` + outcome ID 뒷부분 |
| candidate | `cand:` h(document_id, univId, 종류, 쪽, 위치) |
| program | `prog:` h(univId, 학년도, 캠퍼스, 모집단위 원문) |
| offering | `off:` h(univId, 학년도, 시기, 차수, 군, 캠퍼스, 전형 원문, 모집단위 원문, 정원구분, document_id) |
| eligibility_rule | `elig:` h(univId, 학년도, 범위, 전형 원문, 모집단위 원문, document_id) / 조건 `cond:` h(규칙ID, 로컬키) |
| evaluation_component | 규칙 `evr:` h(univId, 학년도, 전형, 모집단위범위, document_id) / 요소 `evc:` h(규칙, 단계, 요소, 대상, 로컬키) |
| conversion_rule | `conv:` h(univId, 학년도, document_id, 첫 근거 쪽, 입력종류, 출력종류, 적용전형, 로컬키) / 항목 `citem:` |
| csat_minimum | `csat:` h(univId, 학년도, 전형, 모집단위, 원문 앞 120자, document_id) |
| schedule_event | `evt:` … / document_requirement `req:` … |
- 에이전트 병합은 `merge_log(agent, univId, 테이블, ID)` 로 추적하고, 같은 에이전트·대학을 다시 병합하면 그 행을 지우고 다시 넣는다.

## 쪽 번호
- `page_index` = PDF 내부 순서 **0부터**. `printed_page_label` = 인쇄 쪽수(문자열, 모르면 NULL).
- 통합 프롬프트·제안서의 ‘PDF 86쪽’ 같은 표기는 1부터 센 번호다(page_index 85).
- XLSX 는 page_index = 시트 순서(0부터), 셀은 `evidence.sheet_cell`('시트!B12').

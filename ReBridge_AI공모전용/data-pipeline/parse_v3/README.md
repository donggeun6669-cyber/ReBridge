# parse_v3 — RAW 원문 파싱·중간 구조화·검수 작업대 (2026-09-20 시작)

검정고시생 입시 탐색용 데이터를 **RAW 원문에서 처음부터** 다시 뽑는 작업대다.
앱 데이터(`Application_main_codes/src/data`), 점수 엔진, 화면, RAW 원본, 수집 manifest 는 **읽기만** 한다.
기준 문서: DEAN `03_PROJECTS/Gumgomentor/ReBridge/2026-09-19_ClaudeCode_RAW파싱_통합프롬프트.md`,
`2026-09-19_RAW_추출필드와_입시판정_제안.md`.

## 무엇이 어디에

| 경로 | 내용 | 정본? |
|---|---|---|
| `schema.sql` | 14개 논리 테이블 + 보조 테이블(문서 파일·처리 이력·후보·병합 기록) | — |
| `work/parse_v3.sqlite` | **정본 작업대** | 정본 |
| `work/text_cache.sqlite` | 쪽별 텍스트층(`page_text`) + 로컬 OCR(`page_ocr`) | 재생성 가능 캐시 |
| `work/agent_out/<ID>/` | 에이전트 임시 출력(JSONL). 병합 전에는 사실 아님 | 정본 아님 |
| `work/render/` | 쪽 이미지(눈 확인용) | 캐시 |
| `exports/` | 정본에서 만든 검토용 CSV/JSONL | 파생 |
| `reports/` | 인벤토리·검수·시험 대조·최종 보고 | 파생 |
| `DATA_DICTIONARY.md`, `ID_POLICY.md` | 필드·상태값·ID 규칙 | — |
| `AGENT_CONTRACT.md` | 에이전트 추출 규약 | — |
| `후속_앱반영_필수규칙.md` | 앱 연결 때 지킬 규칙(이번엔 작성만) | — |

`work/`는 크기 때문에 `.gitignore` 되어 있다(커밋하지 않음).

## 실행 순서 (모두 이 폴더에서, 다시 돌려도 중복 행이 생기지 않는다)

```bash
python3 inventory.py          # 1. 문서 목록·해시·텍스트층·변환본 연결·못 구한 칸 (--force 로 텍스트 다시)
swiftc -O ocr_vision.swift -o work/bin/ocr_vision   # 한 번만 (macOS Vision, 무료·오프라인)
python3 ocr.py                # 2. 이미지 쪽 OCR (이미 한 쪽은 건너뜀 → 중단 후 그대로 다시 실행하면 이어짐)
python3 parse_results.py      # 3. 입시결과 표 → outcome (문서별 처리 이력이 있으면 건너뜀, --force 로 다시)
python3 candidates.py         # 4. 요강·시행계획 전 문서 후보 구간(자격·최저·환산·일정·서류·평가)
python3 merge_agent.py T1     # 5. 에이전트 출력 검증·병합 (같은 에이전트·대학은 지우고 다시 넣음)
python3 main_review.py        # 5-1. **병합 직후 반드시** — 메인이 원문을 직접 보고 고친 값 다시 적용
python3 trial_check.py        # 6. 10개 대학 시험 사례 대조 → reports/trial_report.md
python3 validate.py           # 7. 무결성·중복·근거·타입·구간·집단 분리 검사 → reports/validation_report.md
python3 export.py             # 8. 검토용 내보내기(exports/)

# 기계 추출(2026-09-20 신설) — 아직 시험 단계라 정본 병합은 하지 않는다
python3 extract_offerings.py --dry    # 요강 모집인원표 → offerings.jsonl (산수 검산 통과분만)
python3 regression_merge.py           # 병합기 회귀검사(임시 폴더에서 돌아 정본을 건드리지 않는다)
```

## 안전장치 (2026-09-20 추가)

| 장치 | 하는 일 |
|---|---|
| 필드 이름 검사 | 규약에 없는 이름이면 그 레코드를 **병합하지 않고** 보고한다. 뜻을 확인한 이름만 `ALIAS` 로 옮긴다 |
| 행 수 대조 | 병합 뒤 `원본 줄 수 = 정본 행 수` 를 확인한다. 다르면 실패로 보고 |
| 자연키 충돌 | 내용이 같으면 한 행, 다르면 순번(`#2 #3 …`)을 붙여 **전부 보존** |
| 자리 없는 칸 | 버리지 않고 `extension_fact` 에 원문과 함께 남긴다 |
| `main_review.py` | 메인이 원문을 직접 보고 고친 값. **병합 직후 반드시 다시 돌린다** |
| `regression_merge.py` | 위 장치들이 실제로 작동하는지 7개 항목으로 검사 |
| 스냅샷 | 고치기 전 `work/snapshots/` 에 SQLite 백업 기능으로 일관된 사본을 만든다 |

배경: 2026-09-20 교차점검에서 인계 출력물의 필드 이름이 달라 광운대 29행→4행 등으로 줄어든 것이 확인됐다.
자연키가 좁아 계명대 '일반전형' 818명 행이 905명 행에 덮어써진 것도 같은 날 발견했다. 둘 다 병합기는 '성공'이라고 보고했다.

원문 조회: `python3 lookup.py docs|search|page|pages|render|tables …` (자세한 사용법은 파일 머리말).

## 상태값 (섞지 않는다)

- `value_status` — 값 자체: confirmed / not_published / not_applicable / not_found / unreadable / conflict / pending
- `review_status` — 검수 이력: unreviewed / auto_validated(기계 검사 통과) / agent_extracted(에이전트 추출, 근거 원문 기계 대조 통과) /
  main_crosschecked(메인이 원문·쪽 이미지를 직접 대조) / human_confirmed(사람) / ocr(이미지 표를 OCR 좌표로 복원 — 사람 확인 전 계산·비교 금지) /
  held(보류) / rejected
- `calc_approval` — 계산에 써도 되는가: approved / blocked / pending (환산·최저 규칙에만)
- `classification_status`(입시결과) — 집단·측정항목·통계 분류가 열 제목으로 분명했는가: auto_classified / pending

**에이전트 검수는 사람 검수가 아니다.** human_confirmed 는 사람이 본 경우에만 쓴다.

## 비용

유료 API·유료 OCR 호출 0. OCR 은 macOS Vision(로컬). 에이전트는 Claude Code 세션 안의 서브에이전트만.
